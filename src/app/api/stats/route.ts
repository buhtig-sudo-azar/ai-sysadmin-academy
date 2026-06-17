import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const [totalQuestions, totalCategories, totalTags, difficultyBreakdown] = await Promise.all([
      db.question.count({ where: { isPublished: true } }),
      db.category.count(),
      db.tag.count(),
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
      totalUsers,
      totalProgress,
      difficultyBreakdown: difficultyBreakdown.map((d) => ({
        difficulty: d.difficulty,
        count: d._count.difficulty,
      })),
      categoryStats,
      recentQuestions,
    })
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
