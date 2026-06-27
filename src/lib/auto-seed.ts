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

async function doSeed(): Promise<boolean> {
  console.log('[autoSeed] БД пуста — запускаю автоматический сид...')

  try {
    await db.$transaction(async (tx) => {
      // На всякий случай — если есть partial-данные, очищаем
      await tx.progress.deleteMany()
      await tx.userNote.deleteMany()
      await tx.contentVersion.deleteMany()
      await tx.aiExplanation.deleteMany()
      await tx.questionTag.deleteMany()
      await tx.question.deleteMany()
      await tx.tag.deleteMany()
      await tx.category.deleteMany()
      await tx.user.deleteMany()

      // Demo-пользователь
      await tx.user.create({
        data: {
          email: 'demo@sysadmin.academy',
          name: 'Демо',
          level: 'Beginner',
          xp: 0,
          role: 'user',
        },
      })

      // Категории
      const categoryIds = new Map<string, string>()
      for (const cat of seedCategories) {
        const created = await tx.category.create({ data: cat })
        categoryIds.set(cat.slug, created.id)
      }

      // Вопросы + теги + объяснения
      const tagCache = new Map<string, string>()
      for (const q of seedQuestions) {
        const categoryId = categoryIds.get(q.c)
        if (!categoryId) continue

        const slug = q.t.toLowerCase().replace(/[^a-zа-яё0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 100)

        const question = await tx.question.create({
          data: {
            title: q.t,
            slug,
            content: q.q,
            answer: q.a,
            difficulty: q.d,
            source: 'academy',
            categoryId,
          },
        })

        for (const tagName of q.tags) {
          const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-')
          let tagId = tagCache.get(tagSlug)
          if (!tagId) {
            const tag = await tx.tag.upsert({
              where: { slug: tagSlug },
              update: { name: tagName },
              create: { name: tagName, slug: tagSlug },
            })
            tagId = tag.id
            tagCache.set(tagSlug, tagId)
          }
          try {
            await tx.questionTag.create({
              data: { questionId: question.id, tagId },
            })
          } catch {
            // ignore unique constraint
          }
        }

        const expl = buildExplanations(q)
        await tx.aiExplanation.create({
          data: {
            questionId: question.id,
            ...expl,
            model: 'auto-seed',
          },
        })
      }
    }, { timeout: 50_000 })

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
