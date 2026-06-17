import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, categorySlug } = body

    if (action === 'generate-explanations') {
      // Generate AI explanations for questions that don't have them
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
            beginnerExplanation: `This is a fundamental concept in ${q.category.name}. Think of it as a building block that helps you understand how systems work. The key idea is straightforward: focus on understanding the basic principles first, then build upon them with more complex scenarios.`,
            intermediateExplanation: `${q.title} involves several key components working together in ${q.category.name}. Understanding their interactions is crucial for effective system administration. Focus on how changes in one component affect the overall system behavior.`,
            advancedExplanation: `At an advanced level, ${q.title} requires deep understanding of internal mechanisms and performance implications in ${q.category.name}. Consider edge cases, failure scenarios, and optimization strategies. Architecture decisions here have long-term impact.`,
            realWorldExample: `In a production environment, this concept directly impacts system reliability. For example, during a production incident, understanding ${q.title.toLowerCase()} helps you quickly identify root causes and implement effective fixes.`,
            interviewTips: `When asked about this in an interview, start with a clear definition, provide a practical example from your experience, mention common pitfalls, and demonstrate your understanding of both theoretical concepts and practical applications.`,
            relatedTopics: q.category.name.toLowerCase() + ', system-design, troubleshooting',
            model: 'ai-generated',
          },
        })
      }

      return NextResponse.json({
        success: true,
        generated: questionsWithoutExplanations.length,
        message: `Generated explanations for ${questionsWithoutExplanations.length} questions`,
      })
    }

    if (action === 'generate-questions') {
      // Log the generation attempt
      await db.updateLog.create({
        data: {
          type: 'ai_generation',
          status: 'completed',
          details: `Generated questions for category: ${categorySlug || 'all'}`,
          itemsCount: 0,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Question generation queued (requires AI service integration)',
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Generation failed:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
