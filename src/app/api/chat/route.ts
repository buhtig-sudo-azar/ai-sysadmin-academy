import { NextRequest, NextResponse } from 'next/server'

let cachedFreeModels: string[] = []
let lastFetchTime = 0
const CACHE_TTL = 5 * 60 * 1000
const MODEL_TIMEOUT_MS = 8000

function getFallbackModels(): string[] {
  return [
    'moonshotai/kimi-k2.6:free',
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-4-scout:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-26b-a4b-it:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'deepseek/deepseek-r1-0528:free',
  ]
}

async function getFreeModels(): Promise<string[]> {
  const now = Date.now()
  if (cachedFreeModels.length > 0 && now - lastFetchTime < CACHE_TTL) return cachedFreeModels
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return cachedFreeModels.length > 0 ? cachedFreeModels : getFallbackModels()
    const data = await res.json()
    cachedFreeModels = (data?.data || [])
      .filter((m: { id: string }) => m.id.endsWith(':free') && !m.id.includes('content-safety'))
      .map((m: { id: string }) => m.id)
    lastFetchTime = now
    return cachedFreeModels.length > 0 ? cachedFreeModels : getFallbackModels()
  } catch {
    return cachedFreeModels.length > 0 ? cachedFreeModels : getFallbackModels()
  }
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout))
}

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, model: clientModel, apiToken, max_tokens: clientMaxTokens, temperature: clientTemperature } = await req.json()

    const apiKey = apiToken || process.env.OPENROUTER_API_KEY
    const preferredModel = clientModel || 'moonshotai/kimi-k2.6:free'
    const maxTokens = clientMaxTokens ?? 2048
    const temperature = clientTemperature !== undefined ? Math.max(0, Math.min(2, clientTemperature)) : 0.7

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API ключ не настроен. Добавьте свой токен OpenRouter или задайте OPENROUTER_API_KEY.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    const allMessages = [
      { role: 'system', content: systemPrompt || 'Ты — полезный AI-ассистент. Отвечай на русском языке.' },
      ...messages,
    ]

    const freeModels = await getFreeModels()
    const modelsToTry = preferredModel
      ? [preferredModel, ...freeModels.filter(m => m !== preferredModel)]
      : freeModels

    let lastError = ''
    const rateLimitedModels: string[] = []

    for (const model of modelsToTry) {
      try {
        const response = await fetchWithTimeout(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://sysadmin-academy.app',
              'X-Title': 'AI SysAdmin Academy',
            },
            body: JSON.stringify({ model, messages: allMessages, stream: true, stream_options: { include_usage: true }, max_tokens: maxTokens, temperature }),
          },
          MODEL_TIMEOUT_MS,
        )

        if (response.ok) {
          const modelInfoEvent = `data: ${JSON.stringify({ type: 'model_info', model, rateLimited: rateLimitedModels })}\n\n`
          const encoder = new TextEncoder()
          const infoChunk = encoder.encode(modelInfoEvent)
          const originalStream = response.body
          if (!originalStream) return new Response(JSON.stringify({ error: 'Нет потока ответа' }), { status: 500, headers: { 'Content-Type': 'application/json' } })

          const combinedStream = new ReadableStream({
            async start(controller) {
              controller.enqueue(infoChunk)
              const reader = originalStream.getReader()
              try { while (true) { const { done, value } = await reader.read(); if (done) break; controller.enqueue(value) } controller.close() }
              catch (err) { controller.error(err) }
            },
          })

          return new Response(combinedStream, {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Model-Used': model, 'X-Rate-Limited-Models': rateLimitedModels.join(','), 'X-Max-Tokens': String(maxTokens), 'X-Temperature': String(temperature) },
          })
        }

        if (response.status === 429) rateLimitedModels.push(model)
        lastError = await response.text().catch(() => 'неизвестная ошибка')
        continue
      } catch (fetchError: unknown) {
        lastError = fetchError instanceof Error ? fetchError.message : 'ошибка запроса'
        continue
      }
    }

    return new Response(JSON.stringify({ error: 'Все модели недоступны', details: lastError, rateLimitedModels }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
