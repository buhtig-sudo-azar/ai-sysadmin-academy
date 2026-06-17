'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useModelStore, type ModelRateLimit } from '@/lib/model-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check, ChevronsUpDown, Cpu, Key, Eye, EyeOff, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

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
    } catch { setIsValid(false) }
    finally { setIsVerifying(false) }
  }

  const handleRemove = () => { clearApiToken(); setIsValid(null); toast({ title: 'Токен удалён', description: 'Теперь используется общий токен.' }) }

  const hasToken = apiToken.length > 0
  const maskedToken = hasToken ? apiToken.slice(0, 6) + '...' + apiToken.slice(-4) : ''

  return (
    <div className="space-y-2">
      {!isExpanded && !hasToken && (
        <div className="space-y-1.5">
          <Button variant="outline" size="sm" className={cn('w-full gap-2 h-8 text-xs font-medium border-dashed border-primary/30 hover:border-primary/50')} onClick={() => setIsExpanded(true)}>
            <Key className="h-3.5 w-3.5 text-primary" /> Свой токен OpenRouter
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Получить бесплатно: <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openrouter.ai/keys</a>
          </p>
        </div>
      )}
      {!isExpanded && hasToken && (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border bg-muted/30 text-xs">
            <Key className="h-3 w-3 text-green-500 shrink-0" />
            <span className="font-mono text-muted-foreground truncate flex-1">{showToken ? apiToken : maskedToken}</span>
            <button onClick={() => setShowToken(!showToken)} className="p-0.5 hover:text-foreground transition-colors">
              {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? <span className="h-3 w-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              : isValid === true ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              : isValid === false ? <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              : <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 hover:text-destructive" onClick={handleRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
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
          <p className="text-[10px] text-muted-foreground">Токен хранится только в браузере. <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openrouter.ai/keys</a></p>
        </div>
      )}
    </div>
  )
}

/* ===== Rate Limit Indicator ===== */
function RateLimitIndicator({ rateLimit }: { rateLimit?: ModelRateLimit }) {
  if (!rateLimit || !rateLimit.checkedAt) return <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
  if (rateLimit.available) return <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
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
    toast({ title: 'Проверка завершена', description: 'Все модели проверены' })
  }

  const currentLabel = availableModels.find(m => m.id === currentModel)?.label || currentModel
  const isCustomModel = !availableModels.find(m => m.id === currentModel)
  const limitedCount = Object.values(rateLimits).filter(r => !r.available).length

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between h-8 text-xs gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Cpu className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{currentLabel}</span>
              {isCustomModel && <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">своя</Badge>}
              {apiToken && <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">свой ключ</Badge>}
              {limitedCount > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{limitedCount} лимит</Badge>}
            </div>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Поиск модели..." />
            <CommandList>
              <CommandEmpty>Модель не найдена</CommandEmpty>
              <CommandGroup heading="Бесплатные модели">
                {isLoadingModels ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">Загрузка моделей...</div>
                ) : (
                  availableModels.map((model) => (
                    <CommandItem key={model.id} value={model.id} onSelect={() => applyModel(model.id)} className="flex items-center gap-2 text-xs">
                      <Check className={cn('h-3 w-3 shrink-0', currentModel === model.id ? 'opacity-100' : 'opacity-0')} />
                      <RateLimitIndicator rateLimit={rateLimits[model.id]} />
                      <span className="flex-1 truncate">{model.label}</span>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t p-2 space-y-2">
            {!showCustom ? (
              <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1 border-dashed" onClick={() => setShowCustom(true)}>
                Ввести свою модель
              </Button>
            ) : (
              <div className="flex gap-1">
                <Input value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="vendor/model:free" className="text-xs h-7 font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit() }} />
                <Button size="sm" className="h-7 text-xs px-2 shrink-0" onClick={handleCustomSubmit} disabled={!customInput.trim()}>OK</Button>
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full text-xs h-7 gap-1" onClick={handleCheckAll} disabled={isCheckingAll}>
              <RefreshCw className={cn('h-3 w-3', isCheckingAll && 'animate-spin')} /> Проверить доступность
            </Button>
          </div>
          <div className="border-t p-2">
            <ApiTokenInput />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
