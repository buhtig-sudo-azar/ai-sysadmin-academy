import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const syncState = await db.syncState.findFirst()
    const recentLogs = await db.updateLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return NextResponse.json({ syncState, recentLogs })
  } catch (error) {
    console.error('Failed to fetch sync state:', error)
    return NextResponse.json({ error: 'Failed to fetch sync state' }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Simulate sync start
    const syncState = await db.syncState.findFirst()
    if (syncState) {
      await db.syncState.update({
        where: { id: syncState.id },
        data: { status: 'syncing', lastSyncAt: new Date() },
      })
    }

    await db.updateLog.create({
      data: {
        type: 'github_sync',
        status: 'completed',
        details: 'Synced from GitHub repository',
        itemsCount: 0,
      },
    })

    // Reset sync state
    if (syncState) {
      await db.syncState.update({
        where: { id: syncState.id },
        data: { status: 'idle' },
      })
    }

    return NextResponse.json({ success: true, message: 'Sync completed' })
  } catch (error) {
    console.error('Sync failed:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
