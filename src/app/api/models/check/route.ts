import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { model, apiToken } = await req.json()
    if (!model || typeof model !== 'string') return NextResponse.json({ error: 'Модель обязательна' }, { status: 400 })

    const apiKey = apiToken || process.env.OPENROUTER_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API ключ не настроен' }, { status: 500 })

    const startTime = Date.now()
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://sysadmin-academy.app', 'X-Title': 'SysAdmin Academy Probe' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1, stream: false }),
    })

    const latency = Date.now() - startTime
    const rateLimitLimit = response.headers.get('x-ratelimit-limit')
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining')
    const rateLimitReset = response.headers.get('x-ratelimit-reset')

    if (response.ok) {
      return NextResponse.json({ available: true, model, latency, rateLimit: { limit: rateLimitLimit ? parseInt(rateLimitLimit, 10) : null, remaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : null, reset: rateLimitReset || null } })
    }

    if (response.status === 429) {
      return NextResponse.json({ available: false, model, reason: 'rate_limited', rateLimit: { limit: rateLimitLimit ? parseInt(rateLimitLimit, 10) : null, remaining: 0, reset: rateLimitReset || null } })
    }

    return NextResponse.json({ available: false, model, reason: response.status === 404 ? 'not_found' : 'error' })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ошибка' }, { status: 500 })
  }
}
