import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reseedDatabase } from '@/lib/auto-seed'

/**
 * /api/admin/reseed — перезаполняет БД тестовыми данными из shared-модуля.
 *
 * ВАЖНО: использет bulk insert (createMany) — ~10 запросов вместо ~765.
 * Это критически важно для Vercel serverless (таймаут 10 сек на Hobby).
 * Раньше здесь был цикл из 765 отдельных запросов, который падал по
 * таймауту и оставлял БД пустой (DELETE выполнялся, CREATE — нет).
 *
 * Логика делегируется в reseedDatabase() из src/lib/auto-seed.ts,
 * чтобы избежать дублирования кода между auto-seed и ручным reseed.
 *
 * Безопасность: в production защищён через ADMIN_RESEED_TOKEN (env).
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
  console.log('[reseed] Starting reseed via bulk insert...')

  try {
    // 2. Делегируем в reseedDatabase — использует bulk insert (быстро)
    const stats = await reseedDatabase()
    const elapsed = Date.now() - startTime
    console.log(`[reseed] Done in ${elapsed}ms`, stats)

    // 3. Логируем успешную операцию
    try {
      await db.updateLog.create({
        data: {
          type: 'reseed_via_api',
          status: 'completed',
          details: `Перезаполнение через /api/admin/reseed (bulk): ${stats.categories} кат., ${stats.questions} вопр. (${elapsed}ms)`,
          itemsCount: stats.questions,
        },
      })
    } catch (logErr) {
      console.error('[reseed] Failed to write updateLog:', logErr)
    }

    return NextResponse.json({
      success: true,
      message: 'База данных перезаполнена Markdown-контентом (bulk insert)',
      stats: {
        ...stats,
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
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/reseed',
    method: 'POST',
    description: 'Перезаполняет БД через bulk insert (createMany) — быстро, без таймаутов',
    auth: 'Требуется заголовок X-Admin-Token, если задана переменная окружения ADMIN_RESEED_TOKEN',
    runtime: 'nodejs',
    maxDuration: 60,
  })
}
