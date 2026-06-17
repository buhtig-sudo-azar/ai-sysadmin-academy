import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const difficulty = searchParams.get('difficulty')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const mode = searchParams.get('mode') // 'learning' or 'interview'

    const where: Record<string, unknown> = { isPublished: true }

    if (categoryId) where.categoryId = categoryId
    if (difficulty) where.difficulty = difficulty
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { answer: { contains: search } },
      ]
    }

    const [questions, total] = await Promise.all([
      db.question.findMany({
        where,
        include: {
          category: true,
          tags: { include: { tag: true } },
          aiExplanation: mode === 'learning',
        },
        orderBy: { order: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.question.count({ where }),
    ])

    return NextResponse.json({ questions, total, page, limit })
  } catch (error) {
    console.error('Failed to fetch questions:', error)
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}
