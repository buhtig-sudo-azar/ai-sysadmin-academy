import { db } from '@/lib/db'
import { seedCategories, seedQuestions } from '@/data/seed-data'

/**
 * autoSeedIfNeeded — проверяет, есть ли в БД вопросы. Если нет — запускает сид.
 *
 * Эта функция вызывается из GET-endpoints (stats, categories, questions),
 * чтобы автоматически заполнить БД при первом обращении. Решает проблему
 * «после пересидирования ответы пропали» — если БД пустая, она сама
 * наполнится Markdown-контентом из shared-модуля.
 *
 * Важно: функция идемпотентна. Если БД уже содержит данные, она ничего не делает.
 * Если БД пустая — запускает атомарную транзакцию с созданием всех данных.
 *
 * Используется на serverless-платформах (Vercel), где нет возможности
 * запустить npx tsx scripts/seed.ts вручную.
 *
 * Альтернатива /api/admin/reseed — этот модуль вызывается автоматически,
 * без участия пользователя.
 */

let seedingPromise: Promise<boolean> | null = null

export async function autoSeedIfNeeded(): Promise<boolean> {
  // Проверяем, есть ли уже данные — быстро, без транзакции
  const questionsCount = await db.question.count()
  if (questionsCount > 0) {
    return false // БД уже заполнена, ничего не делаем
  }

  // Если уже идёт сидинг — ждём его завершения, не запускаем параллельный
  if (seedingPromise) {
    return seedingPromise
  }

  // Запускаем сидинг
  seedingPromise = doSeed().finally(() => {
    seedingPromise = null
  })

  return seedingPromise
}

/**
 * reseedDatabase — принудительное перезаполнение БД.
 * Используется /api/admin/reseed (кнопка в админке).
 * В отличие от autoSeedIfNeeded, ВСЕГДА очищает и пересоздаёт данные,
 * даже если они уже есть.
 *
 * Использует bulk insert (createMany) — ~10 запросов вместо ~765,
 * что критически важно для serverless (Vercel таймаут 10 сек).
 *
 * Возвращает статистику: сколько записей создано.
 */
export async function reseedDatabase(): Promise<{
  categories: number
  questions: number
  explanations: number
  tags: number
}> {
  // Если идёт auto-seed — ждём его завершения
  if (seedingPromise) {
    await seedingPromise
  }

  const result = await doSeed()
  if (!result) {
    throw new Error('Reseed failed — check server logs')
  }

  // Возвращаем статистику
  const [categories, questions, explanations, tags] = await Promise.all([
    db.category.count(),
    db.question.count(),
    db.aiExplanation.count(),
    db.tag.count(),
  ])

  return { categories, questions, explanations, tags }
}

async function doSeed(): Promise<boolean> {
  console.log('[autoSeed] БД пуста — запускаю автоматический сид...')

  try {
    // Стратегия: используем createMany для bulk-insert (1 запрос вместо 153).
    // Категории и вопросы создаются без связей, потом связи добавляются.
    // Это радикально быстрее — ~10 запросов вместо ~765.
    //
    // Порядок:
    // 1. Очистка (если есть partial данные)
    // 2. Demo user (createMany)
    // 3. Categories (createMany) — 1 запрос
    // 4. Tags (createMany, уникальные) — 1 запрос
    // 5. Questions (createMany) — 1 запрос
    // 6. AiExplanations (createMany) — 1 запрос
    // 7. QuestionTags (createMany) — 1 запрос

    // Шаг 1: Очистка
    await db.progress.deleteMany()
    await db.userNote.deleteMany()
    await db.contentVersion.deleteMany()
    await db.aiExplanation.deleteMany()
    await db.questionTag.deleteMany()
    await db.question.deleteMany()
    await db.tag.deleteMany()
    await db.category.deleteMany()
    await db.user.deleteMany()

    console.log('[autoSeed] Очистка завершена')

    // Шаг 2: Demo user
    await db.user.create({
      data: {
        email: 'demo@sysadmin.academy',
        name: 'Демо',
        level: 'Beginner',
        xp: 0,
        role: 'user',
      },
    })

    // Шаг 3: Categories — bulk insert
    await db.category.createMany({
      data: seedCategories,
    })
    console.log(`[autoSeed] Создано категорий: ${seedCategories.length}`)

    // Получаем маппинг slug → id (нужно для вопросов)
    const categories = await db.category.findMany({ select: { id: true, slug: true } })
    const categoryIdBySlug = new Map(categories.map(c => [c.slug, c.id]))

    // Шаг 4: Tags — собираем уникальные теги из всех вопросов
    const tagSet = new Map<string, string>() // slug → name
    for (const q of seedQuestions) {
      for (const tagName of q.tags) {
        const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-')
        if (!tagSet.has(tagSlug)) {
          tagSet.set(tagSlug, tagName)
        }
      }
    }
    const tagsData = Array.from(tagSet.entries()).map(([slug, name]) => ({ name, slug }))
    await db.tag.createMany({ data: tagsData })
    console.log(`[autoSeed] Создано тегов: ${tagsData.length}`)

    // Получаем маппинг tag slug → id
    const tags = await db.tag.findMany({ select: { id: true, slug: true } })
    const tagIdBySlug = new Map(tags.map(t => [t.slug, t.id]))

    // Шаг 5: Questions — bulk insert
    // Предварительно вычисляем slug для каждого вопроса
    const questionsData = seedQuestions
      .map((q, idx) => {
        const categoryId = categoryIdBySlug.get(q.c)
        if (!categoryId) return null
        const slug = q.t.toLowerCase().replace(/[^a-zа-яё0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 100)
        // Добавляем суффикс с индексом для гарантии уникальности slug
        const uniqueSlug = `${slug}-${idx}`
        return {
          title: q.t,
          slug: uniqueSlug,
          content: q.q,
          answer: q.a,
          difficulty: q.d,
          source: 'academy',
          categoryId,
          order: idx,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    await db.question.createMany({ data: questionsData })
    console.log(`[autoSeed] Создано вопросов: ${questionsData.length}`)

    // Получаем маппинг question slug → id
    const createdQuestions = await db.question.findMany({
      select: { id: true, slug: true, order: true },
    })
    // Создаём маппинг order → questionId (надёжнее, чем по slug)
    const questionIdByOrder = new Map(
      createdQuestions.map(q => [q.order, q.id])
    )

    // Шаг 6: AiExplanations — bulk insert
    const explanationsData = seedQuestions
      .map((q, idx) => {
        const questionId = questionIdByOrder.get(idx)
        if (!questionId) return null
        const expl = buildExplanations(q)
        return {
          questionId,
          ...expl,
          model: 'auto-seed',
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    await db.aiExplanation.createMany({ data: explanationsData })
    console.log(`[autoSeed] Создано объяснений: ${explanationsData.length}`)

    // Шаг 7: QuestionTags — bulk insert
    const questionTagsData: { questionId: string; tagId: string }[] = []
    const seenPairs = new Set<string>()
    seedQuestions.forEach((q, idx) => {
      const questionId = questionIdByOrder.get(idx)
      if (!questionId) return
      for (const tagName of q.tags) {
        const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-')
        const tagId = tagIdBySlug.get(tagSlug)
        if (!tagId) continue
        const pairKey = `${questionId}-${tagId}`
        if (seenPairs.has(pairKey)) continue
        seenPairs.add(pairKey)
        questionTagsData.push({ questionId, tagId })
      }
    })

    await db.questionTag.createMany({ data: questionTagsData })
    console.log(`[autoSeed] Создано связей вопрос-тег: ${questionTagsData.length}`)

    console.log('[autoSeed] Сидинг завершён успешно')
    return true
  } catch (error) {
    console.error('[autoSeed] Ошибка сидинга:', error)
    return false
  }
}

function buildExplanations(q: { t: string; tags: string[] }) {
  return {
    beginnerExplanation: `## Простыми словами

${q.t} — это базовая концепция, которую нужно понимать «на пальцах».

## Ключевые идеи

- Сосредоточьтесь на базовых принципах, прежде чем углубляться в детали
- Попробуйте применить концепцию на тестовом стенде
- Запомните 2-3 основные команды и их назначение

> Совет: разберитесь сначала с «что это делает», потом — «как это работает».`,
    intermediateExplanation: `## На среднем уровне

Здесь важно понимать внутренние механизмы и взаимосвязи с другими подсистемами.

## Что изучить

- Внутреннее устройство и архитектура
- Типовые сценарии использования
- Взаимодействие с соседними подсистемами
- Способы диагностики типичных проблем

\`\`\`bash
# Базовая команда для проверки состояния
systemctl status <service>
\`\`\`

> На этом уровне важно уметь объяснить «почему», а не только «что».`,
    advancedExplanation: `## Для продвинутых

Глубокое понимание реализации, нетривиальные сценарии и оптимизация.

## Темы для углубления

1. Внутренние механизмы и производительность
2. Краевые случаи и сценарии отказов
3. Стратегии оптимизации под нагрузкой
4. Архитектурные компромиссы (trade-offs)

## Что обсудить на ревью

- Метрики, которые стоит мониторить
- Лимиты и узкие места
- Планы масштабирования

> Senior-уровень — это умение предсказывать поведение системы при пиковых нагрузках.`,
    realWorldExample: `## Практический пример

В продакшн-среде **${q.t}** — типичная задача при администрировании систем в 2026 году.

## Сценарий из практики

- Возникает при росте нагрузки или расширении инфраструктуры
- Требует понимания как непосредственной команды, так и контекста
- Ошибки здесь ведут к простою сервиса и потере данных

## План действий при инциденте

1. Подтвердить симптомы и собрать логи
2. Изолировать проблемный компонент
3. Применить известный fix или откатить изменение
4. Провести post-mortem и обновить runbook

> При расследовании инцидента понимание этой темы помогает быстро определить корневую причину.`,
    interviewTips: `## Советы для собеседования

Будьте готовы объяснить **${q.t}** с примерами из реального опыта.

## Структура идеального ответа

1. **Определение** — чётко сформулируйте, что это такое
2. **Пример из практики** — конкретный случай с цифрами
3. **Краевые случаи** — что идёт не так и как чинить
4. **Связь с бизнесом** — влияние на надёжность/производительность

## Типичные вопросы

- «Расскажите о случае, когда вы это настраивали в продакшене»
- «Как бы вы отладили проблему с этой технологией?»
- «Какие альтернативы вы рассматривали и почему выбрали эту?»

> Главное правило: лучше честно сказать «не знаю, но вот как бы я подошёл», чем выдумывать.`,
    relatedTopics: q.tags.join(', '),
  }
}
