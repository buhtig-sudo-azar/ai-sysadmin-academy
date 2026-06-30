import { NextRequest, NextResponse } from 'next/server'
import {
  labTools,
  attackPayloads,
  defaultSecurityRules,
  simulateLlm,
  createLabContext,
  type SecurityRule,
} from '@/data/llm-security/lab-data'

/**
 * /api/llm-security/chat — API для учебного LLM-чата.
 *
 * Параметры запроса:
 *  - message: string — сообщение пользователя
 *  - mode: 'vulnerable' | 'protected' — режим работы
 *  - enabledRules?: string[] — список включённых правил (для protected-режима)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, mode = 'vulnerable', enabledRules } = body as {
      message: string
      mode: 'vulnerable' | 'protected'
      enabledRules?: string[]
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Поле "message" обязательно' }, { status: 400 })
    }

    const ctx = createLabContext()

    let rules: SecurityRule[]
    if (mode === 'vulnerable') {
      rules = defaultSecurityRules.map(r => ({ ...r, enabled: false }))
    } else {
      rules = defaultSecurityRules.map(r => ({
        ...r,
        enabled: enabledRules ? enabledRules.includes(r.id) : true,
      }))
    }

    const response = simulateLlm(message, labTools, rules, ctx)

    return NextResponse.json({
      success: true,
      response: {
        text: response.text,
        toolCall: response.toolCall,
        detectedAttack: response.detectedAttack,
      },
      auditLog: ctx.auditLog,
      mode,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[llm-security/chat] Error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/llm-security/chat',
    method: 'POST',
    description: 'Учебный LLM-чат для демонстрации Prompt Injection атак и защитных мер',
    modes: {
      vulnerable: 'Все защитные правила отключены — можно эксплуатировать уязвимости',
      protected: 'Включены security rules',
    },
    availableTools: labTools.map(t => ({ name: t.name, description: t.description, privilege: t.privilege })),
    attackPayloads: attackPayloads.length,
    securityRules: defaultSecurityRules.map(r => ({ id: r.id, name: r.name, type: r.type })),
  })
}
