import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const category = searchParams.get('category')
    const difficulty = searchParams.get('difficulty')
    const tag = searchParams.get('tag')

    if (!q && !category && !difficulty && !tag) {
      return NextResponse.json({ questions: [], total: 0 })
    }

    const where: Record<string, unknown> = { isPublished: true }

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
        { answer: { contains: q } },
      ]
    }
    if (category) where.categoryId = category
    if (difficulty) where.difficulty = difficulty
    if (tag) {
      where.tags = { some: { tag: { slug: tag } } }
    }

    const questions = await db.question.findMany({
      where,
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
      orderBy: { views: 'desc' },
      take: 50,
    })

    return NextResponse.json({ questions, total: questions.length })
  } catch (error) {
    console.error('Search failed:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
