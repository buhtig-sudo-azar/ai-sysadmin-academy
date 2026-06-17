import { create } from 'zustand'

const STORAGE_KEY = 'sysadmin-academy-model'
const RATE_LIMIT_KEY = 'sysadmin-academy-rate-limits'
const TOKEN_KEY = 'sysadmin-academy-api-token'

const DEFAULT_MODEL = 'moonshotai/kimi-k2.6:free'

export interface ModelRateLimit {
  available: boolean
  reason?: 'rate_limited' | 'not_found' | 'error' | null
  remaining?: number | null
  limit?: number | null
  latency?: number | null
  checkedAt?: number
}

export interface FreeModel {
  id: string
  name: string
  label: string
}

interface ModelState {
  currentModel: string
  apiToken: string
  availableModels: FreeModel[]
  isLoadingModels: boolean
  modelsError: string | null
  isApplying: boolean
  isCheckingAll: boolean
  rateLimits: Record<string, ModelRateLimit>
  setCurrentModel: (model: string) => void
  setApiToken: (token: string) => void
  clearApiToken: () => void
  fetchAvailableModels: () => Promise<void>
  checkModel: (modelId: string) => Promise<ModelRateLimit>
  checkAllModels: () => Promise<void>
  markModelRateLimited: (modelId: string) => void
  setIsApplying: (v: boolean) => void
  getModelForRequest: () => string
  getTokenForRequest: () => string
  _hydrate: () => void
}

function loadFromLS(key: string, fallback: string = ''): string {
  if (typeof window === 'undefined') return fallback
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function saveToLS(key: string, value: string) {
  if (typeof window === 'undefined') return
  try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key) } catch { /* */ }
}
function loadRateLimits(): Record<string, ModelRateLimit> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const now = Date.now()
    const cleaned: Record<string, ModelRateLimit> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const rl = v as ModelRateLimit
      if (rl.checkedAt && now - rl.checkedAt < 10 * 60 * 1000) cleaned[k] = rl
    }
    return cleaned
  } catch { return {} }
}
function saveRateLimits(limits: Record<string, ModelRateLimit>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(limits)) } catch { /* */ }
}

export const useModelStore = create<ModelState>((set, get) => ({
  currentModel: DEFAULT_MODEL,
  apiToken: '',
  availableModels: [],
  isLoadingModels: false,
  modelsError: null,
  isApplying: false,
  isCheckingAll: false,
  rateLimits: {},

  setCurrentModel: (model) => { saveToLS(STORAGE_KEY, model); set({ currentModel: model }) },
  setApiToken: (token) => { saveToLS(TOKEN_KEY, token); set({ apiToken: token }) },
  clearApiToken: () => { saveToLS(TOKEN_KEY, ''); set({ apiToken: '' }) },

  fetchAvailableModels: async () => {
    if (get().isLoadingModels || get().availableModels.length > 0) return
    set({ isLoadingModels: true, modelsError: null })
    try {
      const res = await fetch('/api/models')
      if (!res.ok) throw new Error('Не удалось загрузить модели')
      const data = await res.json()
      set({ availableModels: data.models || [], isLoadingModels: false })
    } catch (error) {
      set({ modelsError: error instanceof Error ? error.message : 'Ошибка', isLoadingModels: false })
    }
  },

  checkModel: async (modelId: string): Promise<ModelRateLimit> => {
    const token = get().apiToken
    try {
      const res = await fetch('/api/models/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, apiToken: token || undefined }),
      })
      const data = await res.json()
      const result: ModelRateLimit = {
        available: data.available ?? false,
        reason: data.reason ?? null,
        remaining: data.rateLimit?.remaining ?? null,
        limit: data.rateLimit?.limit ?? null,
        latency: data.latency ?? null,
        checkedAt: Date.now(),
      }
      set((s) => {
        const updated = { ...s.rateLimits, [modelId]: result }
        saveRateLimits(updated)
        return { rateLimits: updated }
      })
      return result
    } catch {
      const result: ModelRateLimit = { available: false, reason: 'error', checkedAt: Date.now() }
      set((s) => {
        const updated = { ...s.rateLimits, [modelId]: result }
        saveRateLimits(updated)
        return { rateLimits: updated }
      })
      return result
    }
  },

  checkAllModels: async () => {
    set({ isCheckingAll: true })
    const models = get().availableModels
    for (let i = 0; i < models.length; i++) {
      await get().checkModel(models[i].id)
      if (i < models.length - 1) await new Promise(r => setTimeout(r, 200))
    }
    set({ isCheckingAll: false })
  },

  markModelRateLimited: (modelId) => {
    set((s) => {
      const updated = { ...s.rateLimits, [modelId]: { available: false, reason: 'rate_limited' as const, checkedAt: Date.now() } }
      saveRateLimits(updated)
      return { rateLimits: updated }
    })
  },

  setIsApplying: (v) => set({ isApplying: v }),
  getModelForRequest: () => get().currentModel,
  getTokenForRequest: () => get().apiToken,

  _hydrate: () => {
    const model = loadFromLS(STORAGE_KEY, DEFAULT_MODEL)
    const apiToken = loadFromLS(TOKEN_KEY)
    const rateLimits = loadRateLimits()
    set({ currentModel: model, apiToken, rateLimits })
  },
}))
