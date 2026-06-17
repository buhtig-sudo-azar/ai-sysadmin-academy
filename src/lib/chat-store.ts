import { create } from 'zustand'
import { useModelStore } from '@/lib/model-store'

export interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ChatState {
  messages: ChatMsg[]
  isLoading: boolean
  activeCategory: string | null
  addMessage: (msg: Omit<ChatMsg, 'id' | 'timestamp'>) => void
  appendToLastMessage: (content: string) => void
  setLoading: (v: boolean) => void
  setActiveCategory: (slug: string | null) => void
  clearMessages: () => void
  sendMessage: (text: string, systemPrompt: string, isRetry?: boolean) => Promise<void>
  retryLastMessage: () => Promise<void>
}

let currentAbortController: AbortController | null = null
let lastSendParams: { text: string; systemPrompt: string } | null = null

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  activeCategory: null,

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, { ...msg, id: crypto.randomUUID(), timestamp: Date.now() }] })),

  appendToLastMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant') msgs[msgs.length - 1] = { ...last, content: last.content + content }
      return { messages: msgs }
    }),

  setLoading: (v) => set({ isLoading: v }),
  setActiveCategory: (slug) => set({ activeCategory: slug }),
  clearMessages: () => set({ messages: [] }),

  retryLastMessage: async () => {
    if (!lastSendParams) return
    const { text, systemPrompt } = lastSendParams
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant') msgs.pop()
      return { messages: msgs }
    })
    await get().sendMessage(text, systemPrompt, true)
  },

  sendMessage: async (text: string, systemPrompt: string, isRetry = false) => {
    const trimmed = text.trim()
    if (!trimmed || get().isLoading) return

    if (currentAbortController) { currentAbortController.abort(); currentAbortController = null }

    const currentMessages = get().messages
    if (!isRetry) lastSendParams = { text: trimmed, systemPrompt }
    if (!isRetry) get().addMessage({ role: 'user', content: trimmed })
    get().setLoading(true)

    const controller = new AbortController()
    currentAbortController = controller

    try {
      const chatMessages = [
        ...currentMessages,
        ...(isRetry ? [] : [{ role: 'user' as const, content: trimmed }]),
      ].map(m => ({ role: m.role, content: m.content }))

      const { currentModel, apiToken } = useModelStore.getState()

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatMessages, systemPrompt, model: currentModel, apiToken: apiToken || undefined }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Ошибка сервера' }))
        get().addMessage({ role: 'assistant', content: `Не удалось получить ответ: ${errData.error || response.statusText}` })
        get().setLoading(false)
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) { get().addMessage({ role: 'assistant', content: 'Не удалось прочитать ответ' }); get().setLoading(false); return }

      get().addMessage({ role: 'assistant', content: '' })

      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (controller.signal.aborted) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'model_info') {
                if (parsed.rateLimited && Array.isArray(parsed.rateLimited)) {
                  for (const modelId of parsed.rateLimited) useModelStore.getState().markModelRateLimited(modelId)
                }
                continue
              }
              const content = parsed.choices?.[0]?.delta?.content
              if (content) { fullContent += content; get().appendToLastMessage(content) }
            } catch { /* incomplete JSON */ }
          }
        }
      }

      if (!fullContent) get().appendToLastMessage('Не удалось получить ответ. Попробуйте другую модель.')
    } catch (error) {
      if (controller.signal.aborted) return
      get().addMessage({ role: 'assistant', content: 'Произошла ошибка сети. Проверьте подключение и попробуйте снова.' })
    } finally {
      if (currentAbortController === controller) currentAbortController = null
      get().setLoading(false)
    }
  },
}))
