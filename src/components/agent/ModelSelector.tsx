'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useModelStore, type ModelRateLimit } from '@/lib/model-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check, ChevronsUpDown, Cpu, Key, Eye, EyeOff, Trash2, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Clock, Zap, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

/* ===== Rate Limit Indicator with text ===== */
function RateLimitIndicator({ rateLimit, compact = false }: { rateLimit?: ModelRateLimit; compact?: boolean }) {
  if (!rateLimit || !rateLimit.checkedAt) {
    return compact ? <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" /> : (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" /> не проверена
      </span>
    )
  }
  if (rateLimit.available) {
    const latencyStr = rateLimit.latency ? `${Math.round(rateLimit.latency)}ms` : ''
    return compact ? <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> : (
      <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
        <Zap className="h-3 w-3" /> доступна {latencyStr && <span className="text-muted-foreground">({latencyStr})</span>}
      </span>
    )
  }
  const reasonMap: Record<string, string> = {
    rate_limited: 'лимит исчерпан',
    not_found: 'не найдена',
    error: 'ошибка',
  }
  const reason = rateLimit.reason ? reasonMap[rateLimit.reason] || rateLimit.reason : 'недоступна'
  return compact ? <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" /> : (
    <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
      <Ban className="h-3 w-3" /> {reason}
    </span>
  )
}

/* ===== API Token Input ===== */
export function ApiTokenInput() {
  const { apiToken, setApiToken, clearApiToken } = useModelStore()
  const [inputValue, setInputValue] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => { if (isExpanded && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100) }, [isExpanded])

  const handleSave = () => {
    const token = inputValue.trim()
    if (!token) return
    setApiToken(token)
    setIsValid(null); setInputValue(''); setIsExpanded(false)
    toast({ title: 'Токен сохранён', description: 'Ваш API-токен будет использоваться для запросов к моделям.' })
  }

  const handleVerify = async () => {
    if (!apiToken) return
    setIsVerifying(true); setIsValid(null)
    try {
      const res = await fetch('/api/models/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'moonshotai/kimi-k2.6:free', apiToken }) })
      const data = await res.json()
      setIsValid(data.available === true || data.reason === 'rate_limited')
      toast({
        title: data.available ? 'Токен работает' : 'Токен не прошёл проверку',
        description: data.available
          ? `Модель доступна, задержка: ${data.latency ? Math.round(data.latency) + 'ms' : 'N/A'}`
          : `Причина: ${data.reason === 'rate_limited' ? 'лимит запросов' : data.reason || 'неизвестно'}`,
      })
    } catch {
      setIsValid(false)
      toast({ title: 'Ошибка проверки', description: 'Не удалось проверить токен' })
    }
    finally { setIsVerifying(false) }
  }

  const handleRemove = () => { clearApiToken(); setIsValid(null); toast({ title: 'Токен удалён', description: 'Теперь используется общий токен.' }) }

  const hasToken = apiToken.length > 0
  const maskedToken = hasToken ? apiToken.slice(0, 6) + '...' + apiToken.slice(-4) : ''

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1.5">
          <Key className="h-3.5 w-3.5 text-primary" /> API-токен OpenRouter
        </span>
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
          Получить ключ <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
      {!isExpanded && !hasToken && (
        <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs font-medium border-dashed border-primary/30 hover:border-primary/50" onClick={() => setIsExpanded(true)}>
          <Key className="h-3.5 w-3.5 text-primary" /> Добавить свой токен
        </Button>
      )}
      {!isExpanded && hasToken && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border bg-muted/30 text-xs">
              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
              <span className="font-mono text-muted-foreground truncate flex-1">{showToken ? apiToken : maskedToken}</span>
              <button onClick={() => setShowToken(!showToken)} className="p-0.5 hover:text-foreground transition-colors">
                {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
            <Button variant="outline" size="sm" className="h-8 px-2 text-xs gap-1" onClick={handleVerify} disabled={isVerifying}>
              {isVerifying ? <span className="h-3 w-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                : isValid === true ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                : isValid === false ? <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                : <Zap className="h-3.5 w-3.5" />}
              Проверить
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 hover:text-destructive" onClick={handleRemove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {isExpanded && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="sk-or-v1-..." type={showToken ? 'text' : 'password'} className="text-xs h-8 font-mono"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } if (e.key === 'Escape') { setIsExpanded(false); setInputValue('') } }} />
            <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={!inputValue.trim()}><Key className="h-3 w-3" /> Сохранить</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setIsExpanded(false); setInputValue('') }}>Отмена</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Токен хранится только в браузере (localStorage).</p>
        </div>
      )}
    </div>
  )
}

/* ===== Model Selector ===== */
export function ModelSelector() {
  const { currentModel, availableModels, isLoadingModels, isCheckingAll, rateLimits, apiToken, setCurrentModel, fetchAvailableModels, checkAllModels, setIsApplying, _hydrate } = useModelStore()
  const [open, setOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const { toast } = useToast()

  useEffect(() => { _hydrate() }, [_hydrate])
  useEffect(() => { if (open && availableModels.length === 0) fetchAvailableModels() }, [open, availableModels.length, fetchAvailableModels])

  const applyModel = (model: string) => {
    setIsApplying(true); setCurrentModel(model); setOpen(false)
    toast({ title: 'Модель применена', description: `Активна: ${model}` })
    setIsApplying(false)
  }

  const handleCustomSubmit = () => {
    const model = customInput.trim()
    if (!model) return
    applyModel(model); setCustomInput(''); setShowCustom(false)
  }

  const handleCheckAll = async () => {
    toast({ title: 'Проверка моделей...', description: 'Опрашиваем все бесплатные модели' })
    await checkAllModels()
    const available = Object.values(rateLimits).filter(r => r.available).length
    const total = Object.keys(rateLimits).length
    toast({ title: 'Проверка завершена', description: `Доступно: ${available}/${total} моделей` })
  }

  const currentLabel = availableModels.find(m => m.id === currentModel)?.label || currentModel
  const isCustomModel = !availableModels.find(m => m.id === currentModel)
  const limitedCount = Object.values(rateLimits).filter(r => !r.available && r.checkedAt).length
  const availableCount = Object.values(rateLimits).filter(r => r.available).length

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between h-8 text-xs gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Cpu className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{currentLabel}</span>
              {isCustomModel && <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">своя</Badge>}
              {apiToken && <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">ключ</Badge>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {availableCount > 0 && <span className="text-[9px] text-green-600 dark:text-green-400">{availableCount}</span>}
              {limitedCount > 0 && <span className="text-[9px] text-red-600 dark:text-red-400">/{limitedCount}</span>}
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          {/* Header */}
          <div className="px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Бесплатные модели</span>
              <div className="flex items-center gap-1">
                {availableCount > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{availableCount} доступно</Badge>}
                {limitedCount > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{limitedCount} лимит</Badge>}
              </div>
            </div>
          </div>
          <Command>
            <CommandInput placeholder="Поиск модели..." />
            <CommandList className="max-h-[240px]">
              <CommandEmpty>Модель не найдена</CommandEmpty>
              <CommandGroup>
                {isLoadingModels ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">Загрузка моделей...</div>
                ) : (
                  availableModels.map((model) => (
                    <CommandItem key={model.id} value={model.id} onSelect={() => applyModel(model.id)} className="flex items-center gap-2 text-xs py-2">
                      <Check className={cn('h-3 w-3 shrink-0', currentModel === model.id ? 'opacity-100' : 'opacity-0')} />
                      <RateLimitIndicator rateLimit={rateLimits[model.id]} compact />
                      <span className="flex-1 truncate">{model.label}</span>
                      {rateLimits[model.id]?.latency && (
                        <span className="text-[9px] text-muted-foreground shrink-0">{Math.round(rateLimits[model.id].latency!)}ms</span>
                      )}
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
          {/* Selected model status */}
          {rateLimits[currentModel]?.checkedAt && (
            <div className="px-3 py-1.5 border-t bg-muted/20">
              <RateLimitIndicator rateLimit={rateLimits[currentModel]} />
            </div>
          )}
          {/* Custom model + check */}
          <div className="border-t p-2 space-y-2">
            {!showCustom ? (
              <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1 border-dashed" onClick={() => setShowCustom(true)}>
                + Добавить свою модель
              </Button>
            ) : (
              <div className="flex gap-1">
                <Input value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="vendor/model-name:free" className="text-xs h-7 font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit() }} />
                <Button size="sm" className="h-7 text-xs px-2 shrink-0" onClick={handleCustomSubmit} disabled={!customInput.trim()}>OK</Button>
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full text-xs h-7 gap-1" onClick={handleCheckAll} disabled={isCheckingAll}>
              <RefreshCw className={cn('h-3 w-3', isCheckingAll && 'animate-spin')} />
              {isCheckingAll ? 'Проверяем...' : 'Проверить доступность всех'}
            </Button>
          </div>
          {/* API Token */}
          <div className="border-t p-2">
            <ApiTokenInput />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
