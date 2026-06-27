import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { seedCategories, seedQuestions } from '@/data/seed-data'

/**
 * POST /api/admin/reseed — перезапускает сид в production-БД.
 *
 * Этот endpoint позволяет применить новые Markdown-ответы без прямого
 * доступа к БД — достаточно вызвать его через HTTPS на production-домене.
 *
 * Логика:
 *   1. Создаёт/обновляет демо-пользователя (нужен для /api/progress)
 *   2. Создаёт/обновляет все 20 категорий (upsert по slug)
 *   3. Создаёт/обновляет все 86 вопросов (upsert по slug) с новыми
 *      Markdown-ответами — update перезаписывает поле `answer`
 *   4. Создаёт/обновляет теги и связи QuestionTag
 *   5. Создаёт/обновляет AI-объяснения (upsert по questionId) — update
 *      перезаписывает все 5 Markdown-полей (beginner/intermediate/advanced/
 *      realWorld/interview)
 *
 * Возвращает статистику: сколько категорий/вопросов/объяснений создано
 * и обновлено.
 *
 * Безопасность: endpoint не защищён авторизацией (это демо-проект).
 * На production стоит добавить проверку admin-токена.
 */
export async function POST() {
  const stats = {
    categoriesCreated: 0,
    categoriesUpdated: 0,
    questionsCreated: 0,
    questionsUpdated: 0,
    explanationsCreated: 0,
    explanationsUpdated: 0,
    errors: [] as string[],
  }

  try {
    // 1. Демо-пользователь
    await db.user.upsert({
      where: { email: 'demo@sysadmin.academy' },
      update: { name: 'Демо' },
      create: {
        email: 'demo@sysadmin.academy',
        name: 'Демо',
        level: 'Beginner',
        xp: 0,
        role: 'user',
      },
    })

    // 2. Категории
    for (const cat of seedCategories) {
      const existing = await db.category.findUnique({ where: { slug: cat.slug } })
      if (existing) {
        await db.category.update({
          where: { id: existing.id },
          data: { name: cat.name, description: cat.description, icon: cat.icon, order: cat.order },
        })
        stats.categoriesUpdated++
      } else {
        await db.category.create({ data: cat })
        stats.categoriesCreated++
      }
    }

    // 3. Вопросы + теги + AI-объяснения
    for (const q of seedQuestions) {
      const category = await db.category.findUnique({ where: { slug: q.c } })
      if (!category) {
        stats.errors.push(`Category not found: ${q.c}`)
        continue
      }

      const slug = q.t.toLowerCase().replace(/[^a-zа-яё0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 100)

      // Upsert вопроса — update перезаписывает answer новым Markdown-версией
      const question = await db.question.upsert({
        where: { slug },
        update: {
          title: q.t,
          content: q.q,
          answer: q.a,
          difficulty: q.d,
          categoryId: category.id,
        },
        create: {
          title: q.t, slug, content: q.q, answer: q.a, difficulty: q.d,
          source: 'academy', categoryId: category.id,
        },
      })

      // Считаем, был ли это create или update
      const existing = await db.question.findUnique({ where: { slug } })
      if (existing && existing.createdAt.getTime() === existing.updatedAt.getTime()) {
        // Только что создан
        stats.questionsCreated++
      } else {
        stats.questionsUpdated++
      }

      // Теги
      for (const tagName of q.tags) {
        const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-')
        const tag = await db.tag.upsert({
          where: { slug: tagSlug },
          update: { name: tagName },
          create: { name: tagName, slug: tagSlug },
        })
        await db.questionTag.upsert({
          where: { questionId_tagId: { questionId: question.id, tagId: tag.id } },
          update: {},
          create: { questionId: question.id, tagId: tag.id },
        })
      }

      // AI-объяснение — update перезаписывает все 5 Markdown-полей
      const existingExpl = await db.aiExplanation.findUnique({ where: { questionId: question.id } })
      const explanationData = buildExplanationData(q.t, q.tags)

      if (existingExpl) {
        await db.aiExplanation.update({
          where: { questionId: question.id },
          data: explanationData,
        })
        stats.explanationsUpdated++
      } else {
        await db.aiExplanation.create({
          data: { questionId: question.id, ...explanationData },
        })
        stats.explanationsCreated++
      }
    }

    // Лог
    await db.updateLog.create({
      data: {
        type: 'reseed_api',
        status: 'completed',
        details: `Reseed via API: ${stats.categoriesCreated + stats.categoriesUpdated} cats, ${stats.questionsCreated + stats.questionsUpdated} questions, ${stats.explanationsCreated + stats.explanationsUpdated} explanations`,
        itemsCount: stats.questionsCreated + stats.questionsUpdated,
      },
    })

    return NextResponse.json({
      success: true,
      stats,
      message: `Reseed complete: ${stats.questionsCreated + stats.questionsUpdated} questions updated with Markdown answers`,
    })
  } catch (error) {
    console.error('Reseed failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats,
    }, { status: 500 })
  }
}

/**
 * Строит данные AI-объяснения для вопроса.
 * Все 5 полей оформлены в Markdown для красивого рендера через MarkdownContent.
 */
function buildExplanationData(title: string, tags: string[]) {
  return {
    beginnerExplanation: `## Простыми словами

${title} — это базовая концепция, которую нужно понимать «на пальцах».

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

В продакшн-среде **${title}** — типичная задача при администрировании систем в 2026 году.

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

Будьте готовы объяснить **${title}** с примерами из реального опыта.

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
    relatedTopics: tags.join(', '),
  }
}
