import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedCategories, seedQuestions } from '@/data/seed-data'

/**
 * /api/admin/reseed — перезаполняет БД тестовыми данными из shared-модуля.
 *
 * ВАЖНО про serverless-таймауты:
 *  - Vercel Hobby: 10 секунд на function
 *  - Vercel Pro: 60 секунд (по умолчанию), до 300 секунд с maxDuration
 *  - 86 вопросов × ~3 запроса к БД на каждый = ~260 запросов
 *  - При 30ms на запрос = ~8 секунд — вписываемся в 10с, но рискованно
 *
 * Решение: используем $transaction для группировки операций в одну
 * серверную транзакцию. Это в разы быстрее и атомарно — либо все данные
 * создаются, либо ни одно (если что-то упадёт, откатывается).
 *
 * Также добавлен maxDuration = 60 секунд (поддерживается на Vercel).
 */

// Force dynamic — иначе Vercel может закешировать ответ
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // секунд — Vercel Pro позволяет до 300

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
  console.log('[reseed] Starting reseed...')

  try {
    // 2. Атомарная транзакция — либо всё проходит, либо откатывается.
    //    Это критически важно: если произойдёт таймаут посередине, БД
    //    останется в прежнем состоянии (старые данные не удалятся).
    const result = await db.$transaction(async (tx) => {
      console.log('[reseed] Cleaning tables...')
      // Очищаем в порядке зависимостей
      await tx.progress.deleteMany()
      await tx.userNote.deleteMany()
      await tx.contentVersion.deleteMany()
      await tx.aiExplanation.deleteMany()
      await tx.questionTag.deleteMany()
      await tx.question.deleteMany()
      await tx.tag.deleteMany()
      await tx.category.deleteMany()
      await tx.user.deleteMany()

      console.log('[reseed] Creating demo user...')
      await tx.user.create({
        data: {
          email: 'demo@sysadmin.academy',
          name: 'Демо',
          level: 'Beginner',
          xp: 0,
          role: 'user',
        },
      })

      console.log('[reseed] Creating categories...')
      // Создаём категории и сохраняем маппинг slug → id
      const categoryIds = new Map<string, string>()
      for (const cat of seedCategories) {
        const created = await tx.category.create({ data: cat })
        categoryIds.set(cat.slug, created.id)
      }

      console.log('[reseed] Creating questions, tags, explanations...')
      const tagCache = new Map<string, string>() // slug → id
      let createdQuestions = 0
      let createdExplanations = 0
      let createdTags = 0

      for (const q of seedQuestions) {
        const categoryId = categoryIds.get(q.c)
        if (!categoryId) {
          console.error(`[reseed] Категория не найдена: ${q.c}`)
          continue
        }

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

        // Теги
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
            createdTags++
          }
          try {
            await tx.questionTag.create({
              data: { questionId: question.id, tagId },
            })
          } catch {
            // ignore unique constraint violations
          }
        }

        // AI-объяснение
        const expl = buildExplanations(q)
        await tx.aiExplanation.create({
          data: {
            questionId: question.id,
            ...expl,
            model: 'reseed-api',
          },
        })
        createdExplanations++
        createdQuestions++
      }

      return {
        categories: seedCategories.length,
        questions: createdQuestions,
        explanations: createdExplanations,
        tags: createdTags,
      }
    }, {
      // Явно задаём таймаут транзакции — должен быть меньше maxDuration
      timeout: 50_000, // 50 секунд
    })

    const elapsed = Date.now() - startTime
    console.log(`[reseed] Done in ${elapsed}ms`)

    // Логируем успешную операцию
    try {
      await db.updateLog.create({
        data: {
          type: 'reseed_via_api',
          status: 'completed',
          details: `Перезаполнение через /api/admin/reseed: ${result.categories} кат., ${result.questions} вопр. (${elapsed}ms)`,
          itemsCount: result.questions,
        },
      })
    } catch (logErr) {
      console.error('[reseed] Failed to write updateLog:', logErr)
    }

    return NextResponse.json({
      success: true,
      message: 'База данных перезаполнена Markdown-контентом',
      stats: {
        ...result,
        elapsedMs: elapsed,
      },
    })
  } catch (error) {
    console.error('[reseed] FAILED:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    const elapsed = Date.now() - startTime

    // Логируем ошибку
    try {
      await db.updateLog.create({
        data: {
          type: 'reseed_via_api',
          status: 'failed',
          details: `${errMsg} (after ${elapsed}ms)`,
        },
      })
    } catch { /* ignore */ }

    return NextResponse.json({
      success: false,
      error: 'Перезаполнение не удалось',
      details: errMsg,
      elapsedMs: elapsed,
      // Подсказка для пользователя, если это таймаут
      hint: elapsed > 9000
        ? 'Похоже на таймаут serverless-функции. Перейдите на Vercel Pro или запустите сид локально: npx tsx scripts/seed.ts'
        : undefined,
    }, { status: 500 })
  }
}

export async function GET() {
  // Проверяем, что данные доступны (без обращения к БД)
  return NextResponse.json({
    endpoint: '/api/admin/reseed',
    method: 'POST',
    description: 'Перезаполняет БД тестовыми данными из shared-модуля с Markdown-форматированием',
    auth: 'Требуется заголовок X-Admin-Token, если задана переменная окружения ADMIN_RESEED_TOKEN',
    questionsAvailable: seedQuestions.length,
    categoriesAvailable: seedCategories.length,
    runtime: 'nodejs',
    maxDuration: 60,
    usage: 'curl -X POST https://your-app/api/admin/reseed [-H "X-Admin-Token: secret"]',
  })
}
