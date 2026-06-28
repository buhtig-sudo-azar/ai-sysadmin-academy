import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { autoSeedIfNeeded } from '@/lib/auto-seed'

export async function GET() {
  try {
    // Автосидинг: если БД пустая, наполняем её Markdown-контентом.
    // ВАЖНО: не await-им результат! Запускаем в фоне, чтобы не блокировать
    // ответ /api/stats. Иначе на Vercel serverless запрос к /api/stats
    // ждёт завершения сидинга (10-30 сек) и падает по таймауту 10 сек,
    // из-за чего фронтенд показывает «Не удалось загрузить данные».
    //
    // Пользователь увидит пустую страницу при первом заходе, но через
    // 10-30 секунд (после завершения фонового сидинга) обновит страницу —
    // и вопросы появятся.
    //
    // Идемпотентно — если данные уже есть, ничего не делает.
    autoSeedIfNeeded().catch(err => {
      console.error('[stats] Background auto-seed failed:', err)
    })

    const [totalQuestions, totalCategories, totalTags, totalExplanations, difficultyBreakdown] = await Promise.all([
      db.question.count({ where: { isPublished: true } }),
      db.category.count(),
      db.tag.count(),
      db.aiExplanation.count(),
      db.question.groupBy({
        by: ['difficulty'],
        _count: { difficulty: true },
        where: { isPublished: true },
      }),
    ])

    const categoryStats = await db.category.findMany({
      include: { _count: { select: { questions: true } } },
      orderBy: { order: 'asc' },
    })

    const recentQuestions = await db.question.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    })

    const totalUsers = await db.user.count()
    const totalProgress = await db.progress.count()

    return NextResponse.json({
      totalQuestions,
      totalCategories,
      totalTags,
      totalExplanations,
      totalUsers,
      totalProgress,
      difficultyBreakdown: difficultyBreakdown.map((d) => ({
        difficulty: d.difficulty,
        count: d._count.difficulty,
      })),
      beginner: difficultyBreakdown.find(d => d.difficulty === 'beginner')?._count.difficulty ?? 0,
      intermediate: difficultyBreakdown.find(d => d.difficulty === 'intermediate')?._count.difficulty ?? 0,
      advanced: difficultyBreakdown.find(d => d.difficulty === 'advanced')?._count.difficulty ?? 0,
      categoryStats,
      recentQuestions,
    })
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
