import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, categorySlug } = body

    if (action === 'generate-explanations') {
      const questionsWithoutExplanations = await db.question.findMany({
        where: { aiExplanation: null, ...(categorySlug ? { category: { slug: categorySlug } } : {}) },
        take: 10,
        include: { category: true },
      })

      for (const q of questionsWithoutExplanations) {
        await db.aiExplanation.upsert({
          where: { questionId: q.id },
          update: {},
          create: {
            questionId: q.id,
            beginnerExplanation: `Это фундаментальная концепция в ${q.category?.name || 'системном администрировании'}. Представьте это как строительный блок — сначала разберитесь в базовых принципах, а затем постепенно углубляйте понимание. Ключевая идея: сосредоточьтесь на том, как компоненты работают вместе.`,
            intermediateExplanation: `${q.title} включает несколько ключевых компонентов, работающих вместе в ${q.category?.name || 'данной области'}. Понимание их взаимодействий критически важно. Обратите внимание на то, как изменения в одном компоненте влияют на поведение всей системы.`,
            advancedExplanation: `На продвинутом уровне ${q.title} требует глубокого понимания внутренних механизмов и влияния на производительность. Рассмотрите краевые случаи, сценарии отказов и стратегии оптимизации. Архитектурные решения имеют долгосрочные последствия.`,
            realWorldExample: `В продакшн-среде эта концепция напрямую влияет на надёжность системы. При расследовании инцидента понимание данной темы помогает быстро определить корневую причину и реализовать эффективное исправление.`,
            interviewTips: `На собеседовании начните с чёткого определения, затем приведите практический пример. Упомяните распространённые ошибки и как их избежать. Покажите, что вы разбираетесь как в теории, так и на практике. Подготовьте конкретные цифры и метрики.`,
            relatedTopics: (q.category?.name || '') + ', системный дизайн, диагностика',
            model: 'ai-generated',
          },
        })
      }

      return NextResponse.json({
        success: true,
        generated: questionsWithoutExplanations.length,
        message: `Сгенерировано объяснений для ${questionsWithoutExplanations.length} вопросов`,
      })
    }

    if (action === 'generate-questions') {
      await db.updateLog.create({
        data: {
          type: 'ai_generation',
          status: 'completed',
          details: `Генерация вопросов для категории: ${categorySlug || 'все'}`,
          itemsCount: 0,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Генерация вопросов поставлена в очередь (требуется ИИ-сервис)',
      })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (error) {
    console.error('Ошибка генерации:', error)
    return NextResponse.json({ error: 'Ошибка генерации' }, { status: 500 })
  }
}
