import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedCategories, seedQuestions } from '@/data/seed-data'

/**
 * /api/admin/reseed — перезаполняет БД тестовыми данными из shared-модуля.
 *
 * Этот endpoint позволяет перезапустить сид прямо из браузера, без
 * доступа к SSH/CLI. Используется для применения обновлённого контента
 * (например, Markdown-форматирования ответов и AI-объяснений).
 *
 * Важно: данные берутся из src/data/seed-data.ts, который бандлится с
 * приложением. Это работает на serverless-платформах (Vercel), где
 * fs.readFileSync недоступен.
 *
 * Безопасность: в production нужно защитить этот endpoint через
 * ADMIN_RESEED_TOKEN (переменная окружения). Если переменная не задана —
 * разрешаем без проверки (для dev-окружения).
 *
 * Логика:
 *  1. Проверяем токен (если задан ADMIN_RESEED_TOKEN)
 *  2. Очищаем все таблицы контента (порядок важен из-за foreign keys)
 *  3. Создаём demo-пользователя
 *  4. Создаём категории и вопросы с Markdown-контентом
 *  5. Возвращаем отчёт: сколько создано
 */

// Шаблоны AI-объяснений в Markdown (должны совпадать с scripts/seed.ts)
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

export async function POST(request: NextRequest) {
  // 1. Проверяем токен администратора (если задан в env)
  const expectedToken = process.env.ADMIN_RESEED_TOKEN
  if (expectedToken) {
    const providedToken = request.headers.get('x-admin-token')
    if (providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Неверный или отсутствующий токен администратора' }, { status: 401 })
    }
  }

  const startTime = Date.now()

  try {
    // 2. Очищаем таблицы (порядок важен из-за foreign keys)
    // Сначала удаляем зависимые таблицы, потом главные.
    await db.progress.deleteMany()
    await db.userNote.deleteMany()
    await db.contentVersion.deleteMany()
    await db.aiExplanation.deleteMany()
    await db.questionTag.deleteMany()
    await db.question.deleteMany()
    await db.tag.deleteMany()
    await db.category.deleteMany()
    await db.user.deleteMany()
    // SyncState и UpdateLog не трогаем — это служебные таблицы

    // 3. Создаём demo-пользователя
    await db.user.create({
      data: {
        email: 'demo@sysadmin.academy',
        name: 'Демо',
        level: 'Beginner',
        xp: 0,
        role: 'user',
      },
    })

    // 4. Создаём категории
    let createdCategories = 0
    for (const cat of seedCategories) {
      await db.category.create({ data: cat })
      createdCategories++
    }

    // 5. Создаём вопросы с тегами и AI-объяснениями
    let createdQuestions = 0
    let createdExplanations = 0
    let createdTags = 0
    const tagCache = new Map<string, string>() // slug → id

    for (const q of seedQuestions) {
      const category = await db.category.findUnique({ where: { slug: q.c } })
      if (!category) {
        console.error(`Категория не найдена: ${q.c}`)
        continue
      }

      const slug = q.t.toLowerCase().replace(/[^a-zа-яё0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 100)

      const question = await db.question.create({
        data: {
          title: q.t,
          slug,
          content: q.q,
          answer: q.a,
          difficulty: q.d,
          source: 'academy',
          categoryId: category.id,
        },
      })

      // Теги
      for (const tagName of q.tags) {
        const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-')
        let tagId = tagCache.get(tagSlug)
        if (!tagId) {
          const tag = await db.tag.upsert({
            where: { slug: tagSlug },
            update: { name: tagName },
            create: { name: tagName, slug: tagSlug },
          })
          tagId = tag.id
          tagCache.set(tagSlug, tagId)
          createdTags++
        }
        await db.questionTag.create({
          data: { questionId: question.id, tagId },
        }).catch(() => { /* ignore unique constraint violations */ })
      }

      // AI-объяснение
      const expl = buildExplanations(q)
      await db.aiExplanation.create({
        data: {
          questionId: question.id,
          ...expl,
          model: 'reseed-api',
        },
      })
      createdExplanations++
      createdQuestions++
    }

    const elapsed = Date.now() - startTime

    // 6. Логируем операцию
    await db.updateLog.create({
      data: {
        type: 'reseed_via_api',
        status: 'completed',
        details: `Перезаполнение через /api/admin/reseed: ${createdCategories} кат., ${createdQuestions} вопр. (${elapsed}ms)`,
        itemsCount: createdQuestions,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'База данных перезаполнена Markdown-контентом',
      stats: {
        categories: createdCategories,
        questions: createdQuestions,
        explanations: createdExplanations,
        tags: createdTags,
        elapsedMs: elapsed,
      },
    })
  } catch (error) {
    console.error('Reseed failed:', error)
    // Логируем ошибку
    try {
      await db.updateLog.create({
        data: {
          type: 'reseed_via_api',
          status: 'failed',
          details: error instanceof Error ? error.message : 'Неизвестная ошибка',
        },
      })
    } catch { /* ignore */ }
    return NextResponse.json({
      success: false,
      error: 'Перезаполнение не удалось',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/reseed',
    method: 'POST',
    description: 'Перезаполняет БД тестовыми данными из shared-модуля с Markdown-форматированием',
    auth: 'Требуется заголовок X-Admin-Token, если задана переменная окружения ADMIN_RESEED_TOKEN',
    questionsCount: seedQuestions.length,
    categoriesCount: seedCategories.length,
    usage: 'curl -X POST https://your-app/api/admin/reseed [-H "X-Admin-Token: secret"]',
  })
}
