import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'demo-user'

    // For demo, we use the first user
    const user = await db.user.findFirst()
    if (!user) {
      return NextResponse.json({ progress: [], stats: { total: 0, mastered: 0, learning: 0 } })
    }

    const progress = await db.progress.findMany({
      where: { userId: user.id },
      include: { question: { include: { category: true } } },
    })

    const stats = {
      total: progress.length,
      mastered: progress.filter((p) => p.status === 'mastered').length,
      learning: progress.filter((p) => p.status === 'learning').length,
      needsReview: progress.filter((p) => p.status === 'needs_review').length,
    }

    // Category progress
    const categoryProgress = await db.category.findMany({
      include: {
        _count: { select: { questions: true } },
        questions: {
          include: {
            progress: { where: { userId: user.id } },
          },
        },
      },
    })

    const categoryStats = categoryProgress.map((cat) => ({
      id: cat.id,
      name: cat.name,
      total: cat._count.questions,
      mastered: cat.questions.filter((q) => q.progress.some((p) => p.status === 'mastered')).length,
      learning: cat.questions.filter((q) => q.progress.some((p) => p.status === 'learning')).length,
    }))

    return NextResponse.json({ progress, stats, categoryStats, user })
  } catch (error) {
    console.error('Failed to fetch progress:', error)
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionId, status, score } = body

    const user = await db.user.findFirst()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const progress = await db.progress.upsert({
      where: {
        userId_questionId: { userId: user.id, questionId },
      },
      update: {
        status,
        score,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
      create: {
        userId: user.id,
        questionId,
        status,
        score,
        attempts: 1,
        lastAttemptAt: new Date(),
      },
    })

    // Update user XP
    const xpGain = status === 'mastered' ? 50 : status === 'learning' ? 20 : 10
    await db.user.update({
      where: { id: user.id },
      data: { xp: { increment: xpGain } },
    })

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Failed to update progress:', error)
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
  }
}
