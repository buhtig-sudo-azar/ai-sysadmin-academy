'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppStore, DIFFICULTY_COLORS, DIFFICULTY_LABELS, LEVELS, getLevelForXP, getNextLevel, getProgressToNextLevel, type AppView } from '@/lib/store'
import { useChatStore } from '@/lib/chat-store'
import { chatPrompts, defaultPrompt } from '@/data/chat-prompts'
import { ModelSelector } from '@/components/agent/ModelSelector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownContent } from '@/components/ui/markdown'
import {
  Terminal, Network, Code, Shield, Box, Blocks, Layers, Play, Cloud, CloudRain,
  CloudSun, GitBranch, Activity, Database, Globe, Search, BookOpen,
  BarChart3, Settings, Sun, Moon, Menu, ChevronRight, ChevronLeft, Star, Target,
  Brain, Zap, Clock, TrendingUp, Award, RefreshCw, Sparkles, Send, CheckCircle2,
  XCircle, HelpCircle, ArrowRight, Eye, Lightbulb,
  Trophy, LayoutDashboard, FolderOpen, Mic, Cpu, User, X, MessageSquare,
  Minimize2, Maximize2, Shrink, ArrowUp, HardDrive, Server, Lock, Wrench
} from 'lucide-react'

interface Category { id: string; name: string; slug: string; description: string; icon: string; order: number; _count?: { questions: number } }
interface Tag { id: string; name: string; slug: string }
interface AiExplanation { id: string; beginnerExplanation?: string; intermediateExplanation?: string; advancedExplanation?: string; realWorldExample?: string; interviewTips?: string; relatedTopics?: string }
interface Question { id: string; title: string; slug: string; content: string; answer: string; difficulty: string; source: string; views: number; categoryId: string; category?: Category; tags?: { tag: Tag }[]; aiExplanation?: AiExplanation | null }
interface Stats { totalQuestions: number; totalCategories: number; totalTags: number; difficultyBreakdown: { difficulty: string; count: number }[]; categoryStats: Category[]; recentQuestions: Question[] }

const ICON_MAP: Record<string, React.ReactNode> = {
  Terminal: <Terminal className="h-5 w-5" />, Network: <Network className="h-5 w-5" />, Code: <Code className="h-5 w-5" />, Shield: <Shield className="h-5 w-5" />,
  Container: <Box className="h-5 w-5" />, Blocks: <Blocks className="h-5 w-5" />, Layers: <Layers className="h-5 w-5" />, Play: <Play className="h-5 w-5" />,
  Cloud: <Cloud className="h-5 w-5" />, CloudRain: <CloudRain className="h-5 w-5" />, CloudSun: <CloudSun className="h-5 w-5" />, GitBranch: <GitBranch className="h-5 w-5" />,
  Activity: <Activity className="h-5 w-5" />, Database: <Database className="h-5 w-5" />, Globe: <Globe className="h-5 w-5" />,
  Settings: <Wrench className="h-5 w-5" />, HardDrive: <HardDrive className="h-5 w-5" />, Server: <Server className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />, Lock: <Lock className="h-5 w-5" />,
}

const NAV_ITEMS: { view: AppView; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Главная', icon: <LayoutDashboard className="h-4 w-4" /> },
  { view: 'categories', label: 'Категории', icon: <FolderOpen className="h-4 w-4" /> },
  { view: 'search', label: 'Поиск', icon: <Search className="h-4 w-4" /> },
  { view: 'learning', label: 'Обучение', icon: <BookOpen className="h-4 w-4" /> },
  { view: 'interview', label: 'Собеседование', icon: <Mic className="h-4 w-4" /> },
  { view: 'mentor', label: 'ИИ-наставник', icon: <Brain className="h-4 w-4" /> },
  { view: 'progress', label: 'Мой прогресс', icon: <BarChart3 className="h-4 w-4" /> },
  { view: 'admin', label: 'Админ-панель', icon: <Settings className="h-4 w-4" /> },
]

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: 'Главная', categories: 'Категории', questions: 'Вопросы', search: 'Поиск',
  learning: 'Режим обучения', interview: 'Режим собеседования', mentor: 'ИИ-наставник',
  progress: 'Мой прогресс', admin: 'Админ-панель',
}

export default function Home() {
  const { currentView, navigateToView, darkMode, toggleDarkMode, selectedCategory } = useAppStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMinimized, setChatMinimized] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(false)

  // Slug выбранной категории — нужен для передачи в AgentChatPopup,
  // чтобы ИИ-наставник использовал специализированный системный промпт
  // (chatPrompts в src/data/chat-prompts.ts) именно для текущего раздела.
  // Например, при открытии категории Docker чат будет отвечать только по Docker.
  const currentCategorySlug = useMemo(
    () => categories.find(c => c.id === selectedCategory)?.slug ?? null,
    [categories, selectedCategory]
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) { document.documentElement.classList.add('dark'); useAppStore.setState({ darkMode: true }) }
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [catRes, statsRes] = await Promise.all([fetch('/api/categories'), fetch('/api/stats')])
      setCategories(await catRes.json()); setStats(await statsRes.json())
    } catch (err) { console.error('Ошибка загрузки:', err) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { loadData() }, [loadData])

  // Scroll to top detection — use main element scroll
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const handleScroll = () => { setShowScrollTop(el.scrollTop > 300) }
    el.addEventListener('scroll', handleScroll, { passive: true })
    // Also re-check on view change
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [currentView])

  const scrollToTop = () => {
    const el = mainRef.current
    if (el) {
      el.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setShowScrollTop(false)
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView stats={stats} categories={categories} loading={loading} onOpenChat={() => setChatOpen(true)} />
      case 'categories': return <CategoriesView categories={categories} />
      case 'questions': return <QuestionsView />
      case 'search': return <SearchView categories={categories} />
      case 'learning': return <LearningView categories={categories} />
      case 'interview': return <InterviewView categories={categories} />
      case 'mentor': return <MentorView categories={categories} />
      case 'progress': return <ProgressView />
      case 'admin': return <AdminView />
      default: return <DashboardView stats={stats} categories={categories} loading={loading} onOpenChat={() => setChatOpen(true)} />
    }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-3 sm:p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <Cpu className="h-4 w-4 text-white" />
          </div>
          {!sidebarCollapsed && <div><h1 className="font-bold text-sm">ИИ Сисадмин</h1><p className="text-[10px] text-muted-foreground">Академия</p></div>}
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button key={item.view} onClick={() => { navigateToView(item.view); setMobileMenuOpen(false) }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentView === item.view ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
            {item.icon}
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      {!sidebarCollapsed && (
        <div className="p-2 border-t space-y-2">
          <ModelSelector />
          {!stats && <div className="text-[10px] text-muted-foreground text-center px-2">Июнь 2026</div>}
          {stats && <div className="text-[10px] text-muted-foreground text-center px-2">{stats.totalQuestions} вопросов • Июнь 2026</div>}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col border-r bg-card transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
        <SidebarContent />
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 border-t hover:bg-muted transition-colors flex items-center justify-center">
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-56 p-0">
          <SheetHeader className="sr-only"><SheetTitle>Меню навигации</SheetTitle></SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 sm:h-14 border-b bg-card flex items-center px-3 sm:px-4 gap-2 sm:gap-3 sticky top-0 z-40">
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileMenuOpen(true)}><Menu className="h-4 w-4" /></Button>
          <div className="flex-1 min-w-0"><h2 className="font-semibold text-sm sm:text-lg truncate">{VIEW_TITLES[currentView]}</h2></div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatOpen(!chatOpen)}><MessageSquare className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleDarkMode}>{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        </header>
        <main ref={mainRef} className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">{renderContent()}</main>
      </div>

      {/* Scroll to top */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 hover:scale-110 transition-all duration-300 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        aria-label="Наверх"
      >
        <ArrowUp className="h-5 w-5" />
      </button>

      {/* Agent Chat Popup — передаём slug текущей категории, чтобы ИИ-наставник
          в чате использовал подходящий системный промпт (например, для docker,
          kubernetes и т.д.), отвечая строго в контексте изучаемого раздела. */}
      <AgentChatPopup open={chatOpen} onClose={() => { setChatOpen(false); setChatMinimized(false); setChatExpanded(false) }}
        minimized={chatMinimized} onMinimize={() => setChatMinimized(true)} onRestore={() => setChatMinimized(false)}
        expanded={chatExpanded} onExpand={() => setChatExpanded(p => !p)} currentCategorySlug={currentCategorySlug} />
    </div>
  )
}

/* ============ AGENT CHAT POPUP ============ */
function AgentChatPopup({ open, onClose, minimized, onMinimize, onRestore, expanded, onExpand, currentCategorySlug }: {
  open: boolean; onClose: () => void; minimized: boolean; onMinimize: () => void; onRestore: () => void; expanded: boolean; onExpand: () => void; currentCategorySlug: string | null
}) {
  const { messages, isLoading, clearMessages, sendMessage, retryLastMessage } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages])

  if (!open) return null

  const systemPrompt = currentCategorySlug ? (chatPrompts[currentCategorySlug] || defaultPrompt) : defaultPrompt

  const handleSubmit = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(text, systemPrompt)
  }

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null
  const lastIsError = lastMsg?.role === 'assistant' && (lastMsg.content.includes('Не удалось') || lastMsg.content.includes('Ошибка') || lastMsg.content.includes('недоступны'))

  // Minimized bubble
  if (minimized) return (
    <button onClick={onRestore} className="fixed bottom-20 right-4 z-50 group">
      <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 opacity-50 group-hover:opacity-80 transition-opacity" />
      <span className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
        <Brain className="h-6 w-6 text-white" />
      </span>
      {messages.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-bold">{messages.length}</span>}
      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
    </button>
  )

  return (
    <div className={`fixed z-50 flex flex-col bg-background border shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ease-in-out
      ${expanded ? 'sm:bottom-4 sm:right-4 sm:top-4 sm:w-[calc(100vw-2rem)] sm:max-h-[calc(100vh-2rem)] max-sm:inset-2 max-sm:max-h-[calc(100vh-1rem)]'
        : 'sm:bottom-20 sm:right-4 sm:w-[400px] sm:max-h-[550px] max-sm:inset-x-2 max-sm:bottom-16 max-sm:top-auto max-sm:max-h-[70vh]'}
      animate-in slide-in-from-bottom-4 fade-in duration-200`}>
      {/* Header */}
      <div className="relative flex items-center gap-3 px-3 py-2.5 border-b shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-600/10" />
        <div className="relative flex items-center gap-2.5 w-full">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold truncate">Сисадмин-наставник</h3>
            <p className="text-xs text-muted-foreground truncate">AI-ассистент по сисадмину и DevOps</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onExpand}>{expanded ? <Shrink className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMinimize}><Minimize2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 min-h-0 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6 px-2">
            <div className="p-3 rounded-full bg-emerald-500/10 mb-3"><Brain className="h-6 w-6 text-emerald-600" /></div>
            <p className="text-sm font-medium mb-1">Привет! Я ваш ИИ-наставник</p>
            <p className="text-xs text-muted-foreground mb-4">Задайте вопрос по Linux, Docker, K8s, сетям, безопасности...</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['Как работает загрузка Linux?', 'Объясните сеть Docker', 'Что такое cgroups v2?', 'Как харденинговать сервер?'].map(q => (
                <button key={q} onClick={() => { setInput(q) }} className="text-xs px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">{q}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'}`}>
                  {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
                </div>
                <div className={`flex-1 min-w-0 rounded-lg px-3 py-2 text-sm break-words leading-relaxed ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {msg.role === 'user'
                    ? <span className="whitespace-pre-wrap">{msg.content}</span>
                    // Сообщения ассистента рендерим как Markdown — с разделением на блоки,
                    // подсветкой кода, заголовками и списками для удобного чтения.
                    : <MarkdownContent size="sm" className="[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">{msg.content}</MarkdownContent>}
                </div>
              </div>
            ))}
            {isLoading && !messages[messages.length - 1]?.content && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse"><Brain className="h-4 w-4" /> Думаю...</div>
            )}
            {!isLoading && lastIsError && (
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={retryLastMessage}><RefreshCw className="h-3 w-3" /> Повторить</Button>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-2.5 border-t">
        <div className="flex gap-2">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            placeholder="Задайте вопрос..." className="min-h-[38px] max-h-20 resize-none text-sm" rows={1} disabled={isLoading} />
          <Button size="icon" onClick={handleSubmit} disabled={isLoading || !input.trim()} className="shrink-0 h-[38px] w-[38px]"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}

/* ============ ГЛАВНАЯ ============ */
function DashboardView({ stats, categories, loading, onOpenChat }: { stats: Stats | null; categories: Category[]; loading: boolean; onOpenChat: () => void }) {
  // navigateToView — сбрасывает контекст (нет конкретного вопроса/категории),
  // это нужно для кнопок «Обучение» / «Собеседование» на главной,
  // чтобы пользователь начинал с чистого режима, а не с устаревшего выбора.
  // openCategory — устанавливает выбранную категорию и открывает список вопросов.
  const { navigateToView, openCategory } = useAppStore()
  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>
  if (!stats) return <div>Не удалось загрузить данные</div>
  return (
    <div className="space-y-6 max-w-7xl">
      <Card className="border-0 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">ИИ Академия Сисадмина</h1>
          <p className="text-emerald-100 text-xs sm:text-sm md:text-base mb-4">Современная образовательная платформа. {stats.totalQuestions} вопросов с ИИ-объяснениями. Июнь 2026.</p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigateToView('learning')} className="gap-1"><BookOpen className="h-3 w-3 sm:h-4 sm:w-4" /> Обучение</Button>
            <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10" onClick={() => navigateToView('interview')}><Mic className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Собеседование</Button>
            <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10" onClick={onOpenChat}><Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Чат с ИИ</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        {[{ l: 'Вопросов', v: stats.totalQuestions, i: <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" /> },
          { l: 'Категорий', v: stats.totalCategories, i: <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600" /> },
          { l: 'Тегов', v: stats.totalTags, i: <Star className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" /> },
          { l: 'С ИИ', v: stats.difficultyBreakdown.reduce((a, b) => a + b.count, 0), i: <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" /> }
        ].map((s, i) => (
          <Card key={i}><CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3"><div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">{s.i}</div><div><div className="text-lg sm:text-2xl font-bold">{s.v}</div><div className="text-[10px] sm:text-xs text-muted-foreground">{s.l}</div></div></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm sm:text-base">Распределение по сложности</CardTitle></CardHeader>
        <CardContent><div className="space-y-2 sm:space-y-3">{stats.difficultyBreakdown.map((d) => (
          <div key={d.difficulty} className="flex items-center gap-2 sm:gap-3">
            <Badge className={DIFFICULTY_COLORS[d.difficulty] || ''} variant="secondary">{DIFFICULTY_LABELS[d.difficulty] || d.difficulty}</Badge>
            <div className="flex-1"><Progress value={(d.count / stats.totalQuestions) * 100} className="h-2" /></div>
            <span className="text-xs sm:text-sm font-medium w-6 sm:w-8 text-right">{d.count}</span>
          </div>
        ))}</div></CardContent>
      </Card>
      <div>
        <h3 className="font-semibold text-base sm:text-lg mb-3">Категории</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {categories.map((cat) => (
            <Card key={cat.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openCategory(cat.id)}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">{ICON_MAP[cat.icon] || <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5" />}</div>
                <div className="min-w-0"><div className="font-medium text-xs sm:text-sm truncate">{cat.name}</div><div className="text-[10px] sm:text-xs text-muted-foreground">{cat._count?.questions || 0} вопр.</div></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============ КАТЕГОРИИ ============ */
function CategoriesView({ categories }: { categories: Category[] }) {
  // openCategory — устанавливает категорию и переключает на список вопросов.
  const { openCategory } = useAppStore()
  return (
    <div className="max-w-5xl space-y-4">
      <div><h2 className="text-lg sm:text-xl font-bold">Все категории</h2><p className="text-xs sm:text-sm text-muted-foreground">Выберите область для изучения</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {categories.map((cat) => (
          <Card key={cat.id} className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30" onClick={() => openCategory(cat.id)}>
            <CardHeader className="pb-2"><div className="flex items-center gap-3"><div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">{ICON_MAP[cat.icon] || <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6" />}</div><div><CardTitle className="text-sm sm:text-base">{cat.name}</CardTitle><CardDescription className="text-xs">{cat._count?.questions || 0} вопросов</CardDescription></div></div></CardHeader>
            <CardContent className="pt-0"><p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{cat.description}</p><div className="mt-2 sm:mt-3 flex items-center text-xs text-primary">Начать <ArrowRight className="h-3 w-3 ml-1" /></div></CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ============ ВОПРОСЫ ============ */
function QuestionsView() {
  // selectedCategory из store — это категория, выбранная пользователем
  // (например, при клике на карточку категории). Локальный selectedCategory
  // не нужен — мы работаем напрямую с глобальным состоянием, чтобы
  // переход «Изучить» / «Практика» наследовал категорию.
  const { selectedCategory, setSelectedCategory, navigateToView } = useAppStore()
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [difficulty, setDifficulty] = useState('all')
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  useEffect(() => { fetch('/api/categories').then(r => r.json()).then(setCategories) }, [])
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (selectedCategory) params.set('categoryId', selectedCategory)
    if (difficulty !== 'all') params.set('difficulty', difficulty)
    params.set('page', page.toString()); params.set('limit', '20')
    fetch(`/api/questions?${params}`).then(r => r.json()).then(data => { if (!cancelled) { setQuestions(data.questions || []); setTotal(data.total || 0); setLoading(false) } }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedCategory, difficulty, page])
  return (
    <div className="max-w-4xl space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Кнопка «К категориям» — возвращает в раздел категорий и сбрасывает фильтр.
            Это контекстно-корректный переход: иконка ChevronLeft у пользователя
            ассоциируется с «назад», и раньше она лишь очищала фильтр, оставляя
            пользователя в том же виде — это было неинтуитивно. */}
        <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory(null); navigateToView('categories') }}><ChevronLeft className="h-4 w-4 mr-1" /> К категориям</Button>
        {categories.find(c => c.id === selectedCategory) && <Badge variant="secondary" className="text-xs">{categories.find(c => c.id === selectedCategory)?.name}</Badge>}
      </div>
      {/* Контекстно-зависимые действия раздела: «Изучить раздел» и «Практика раздела».
          Эти кнопки переключают в режим обучения / собеседования, наследуя выбранную
          категорию (selectedCategory уже установлен в store). Никакого явного
          setSelectedQuestion — пользователь начинает с первого вопроса в категории. */}
      {selectedCategory && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={() => navigateToView('learning')}><BookOpen className="h-3 w-3" /> Изучить раздел</Button>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => navigateToView('interview')}><Mic className="h-3 w-3" /> Практика раздела</Button>
        </div>
      )}
      <div className="flex gap-1.5 sm:gap-2 flex-wrap">{[['all', 'Все'], ['beginner', 'Начальный'], ['intermediate', 'Средний'], ['advanced', 'Продвинутый']].map(([d, l]) => (
        <Button key={d} variant={difficulty === d ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => { setDifficulty(d); setPage(1) }}>{l}</Button>
      ))}</div>
      <div className="text-xs sm:text-sm text-muted-foreground">Найдено: {total}</div>
      {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 sm:h-20 rounded-lg bg-muted animate-pulse" />)}</div>
        : <div className="space-y-2">{questions.map(q => <QuestionCard key={q.id} question={q} />)}</div>}
    </div>
  )
}

function QuestionCard({ question }: { question: Question }) {
  // openQuestion — устанавливает выбранный вопрос и переключает в нужный режим
  // (learning или interview), сохраняя контекст категории. Раньше тут использовался
  // setView, который очищал selectedQuestion — поэтому «Изучить» / «Практика»
  // открывали первый вопрос из списка, а не тот, на который кликнули.
  const { openQuestion } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
              <Badge className={DIFFICULTY_COLORS[question.difficulty] || ''} variant="secondary">{DIFFICULTY_LABELS[question.difficulty] || question.difficulty}</Badge>
              {question.category && <Badge variant="outline" className="text-[10px] sm:text-xs">{question.category.name}</Badge>}
            </div>
            <h3 className="font-medium text-xs sm:text-sm">{question.title}</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">{question.content}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronLeft className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        </div>
        {expanded && <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t"><div className="text-xs sm:text-sm bg-muted/50 rounded-lg p-3 max-h-60 overflow-y-auto"><MarkdownContent size="sm">{question.answer}</MarkdownContent></div>
          <div className="mt-2 sm:mt-3 flex gap-1.5 sm:gap-2">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openQuestion(question.id, 'learning')}><BookOpen className="h-3 w-3 mr-1" /> Изучить</Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openQuestion(question.id, 'interview')}><Mic className="h-3 w-3 mr-1" /> Практика</Button>
          </div></div>}
      </CardContent>
    </Card>
  )
}

/* ============ ПОИСК ============ */
function SearchView({ categories }: { categories: Category[] }) {
  const [query, setQuery] = useState(''); const [results, setResults] = useState<Question[]>([]); const [category, setCategory] = useState(''); const [difficulty, setDifficulty] = useState('')
  useEffect(() => {
    let cancelled = false; const params = new URLSearchParams()
    if (query) params.set('q', query); if (category) params.set('category', category); if (difficulty) params.set('difficulty', difficulty)
    if (!query && !category && !difficulty) return
    fetch(`/api/search?${params}`).then(r => r.json()).then(data => { if (!cancelled) setResults(data.questions || []) }).catch(() => { if (!cancelled) setResults([]) })
    return () => { cancelled = true }
  }, [query, category, difficulty])
  return (
    <div className="max-w-4xl space-y-3 sm:space-y-4">
      <div><h2 className="text-lg sm:text-xl font-bold">Поиск</h2><p className="text-xs sm:text-sm text-muted-foreground">Поиск по вопросам, ответам и тегам</p></div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Поиск..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 text-sm" /></div>
      <div className="flex gap-2 flex-wrap">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-xs border rounded-md px-2 py-1.5 bg-background"><option value="">Все категории</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="text-xs border rounded-md px-2 py-1.5 bg-background"><option value="">Все уровни</option><option value="beginner">Начальный</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select>
      </div>
      {results.length > 0 ? <div className="space-y-2"><div className="text-xs text-muted-foreground">{results.length} результатов</div>{results.map(q => <QuestionCard key={q.id} question={q} />)}</div>
        : query ? <div className="text-center py-6 text-sm text-muted-foreground">По запросу &quot;{query}&quot; ничего не найдено</div>
        : <div className="text-center py-10 text-muted-foreground"><Search className="h-10 w-10 mx-auto mb-2 opacity-20" /><p className="text-sm">Начните вводить</p></div>}
    </div>
  )
}

/* ============ ОБУЧЕНИЕ ============ */
function LearningView({ categories }: { categories: Category[] }) {
  // selectedQuestion — из store (если пользователь кликнул «Изучить» на конкретном вопросе).
  // selectedCategory (из store) — контекст категории, выбранный пользователем
  // (например, из карточки категории). Раньше локальный selectedCategory
  // инициализировался пустой строкой, из-за чего контекст категории терялся
  // при переходе из QuestionsView в LearningView.
  const { selectedQuestion, setSelectedQuestion, selectedCategory: storeCategoryId, setSelectedCategory: setStoreCategory } = useAppStore()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [explanationTab, setExplanationTab] = useState('beginner')
  const [difficulty, setDifficulty] = useState('')
  // Локальный фильтр категории синхронизирован с store: при первом монтировании
  // берём значение из store, чтобы сохранить контекст. Пользователь может
  // изменить его через селектор — изменение сохраняется в store.
  const [selectedCategory, setSelectedCategory] = useState(storeCategoryId || '')

  useEffect(() => {
    const params = new URLSearchParams(); params.set('mode', 'learning')
    if (selectedCategory) params.set('categoryId', selectedCategory); if (difficulty) params.set('difficulty', difficulty); params.set('limit', '50')
    fetch(`/api/questions?${params}`).then(r => r.json()).then(data => setQuestions(data.questions || []))
  }, [selectedCategory, difficulty])

  // current — это вычисляемое значение (derived state), а не эффект.
  // Если выбран конкретный вопрос (selectedQuestion), показываем его;
  // иначе — вопрос по текущему индексу. Это устраняет необходимость в эффекте,
  // который синхронизировал бы selectedQuestion и currentIdx.
  // find вернёт undefined, если вопрос не найден — тогда компонент покажет заглушку.
  const current = selectedQuestion
    ? questions.find(q => q.id === selectedQuestion) ?? questions[currentIdx]
    : questions[currentIdx]

  const markProgress = async (status: string) => {
    if (!current) return
    await fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: current.id, status, score: status === 'mastered' ? 100 : 50 }) })
    setShowAnswer(false)
    // Сбрасываем selectedQuestion, чтобы после перехода к следующему вопросу
    // навигация «Назад» / «Далее» работала по currentIdx, а не пыталась
    // снова найти устаревший selectedQuestion.
    setSelectedQuestion(null)
    setCurrentIdx(i => Math.min(i + 1, questions.length - 1))
  }
  // При смене фильтра категории синхронизируем store, чтобы другие виды
  // (например, Interview при переключении) наследовали этот выбор.
  const onCategoryChange = (val: string) => {
    setSelectedCategory(val)
    setStoreCategory(val || null)
    setCurrentIdx(0)
    setSelectedQuestion(null)
  }
  return (
    <div className="max-w-4xl space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h2 className="text-lg sm:text-xl font-bold">Обучение</h2><p className="text-xs text-muted-foreground">Вопрос {currentIdx + 1} из {questions.length}</p></div>
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          <select value={selectedCategory} onChange={(e) => onCategoryChange(e.target.value)} className="text-xs border rounded-md px-2 py-1.5 bg-background"><option value="">Все</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setCurrentIdx(0); setSelectedQuestion(null) }} className="text-xs border rounded-md px-2 py-1.5 bg-background"><option value="">Все</option><option value="beginner">Начальный</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select>
        </div>
      </div>
      {current && (
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 flex-wrap"><Badge className={DIFFICULTY_COLORS[current.difficulty]} variant="secondary">{DIFFICULTY_LABELS[current.difficulty]}</Badge>{current.category && <Badge variant="outline" className="text-[10px] sm:text-xs">{current.category.name}</Badge>}</div>
            <CardTitle className="text-sm sm:text-lg">{current.title}</CardTitle><CardDescription className="text-xs sm:text-sm">{current.content}</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
            {!showAnswer ? <Button size="sm" onClick={() => setShowAnswer(true)} className="gap-1"><Lightbulb className="h-3 w-3 sm:h-4 sm:w-4" /> Показать ответ</Button> : (
              <><div className="text-xs sm:text-sm bg-muted/50 rounded-lg p-3 sm:p-4 border max-h-72 overflow-y-auto"><MarkdownContent size="sm">{current.answer}</MarkdownContent></div>
                {current.aiExplanation && (<div><h4 className="font-semibold text-xs sm:text-sm mb-1.5 sm:mb-2 flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-purple-500" /> ИИ-объяснение</h4>
                  <Tabs value={explanationTab} onValueChange={setExplanationTab}><TabsList className="w-full justify-start flex-wrap h-auto gap-0.5"><TabsTrigger value="beginner" className="text-[10px] sm:text-xs">Для новичков</TabsTrigger><TabsTrigger value="intermediate" className="text-[10px] sm:text-xs">Средний</TabsTrigger><TabsTrigger value="advanced" className="text-[10px] sm:text-xs">Продвинутый</TabsTrigger><TabsTrigger value="practical" className="text-[10px] sm:text-xs">Практика</TabsTrigger><TabsTrigger value="interview" className="text-[10px] sm:text-xs">Собеседование</TabsTrigger></TabsList>
                    <TabsContent value="beginner" className="mt-1.5 sm:mt-2"><div className="text-xs sm:text-sm bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2.5 sm:p-3 border border-emerald-200 dark:border-emerald-800"><MarkdownContent size="sm">{current.aiExplanation.beginnerExplanation ?? ''}</MarkdownContent></div></TabsContent>
                    <TabsContent value="intermediate" className="mt-1.5 sm:mt-2"><div className="text-xs sm:text-sm bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5 sm:p-3 border border-amber-200 dark:border-amber-800"><MarkdownContent size="sm">{current.aiExplanation.intermediateExplanation ?? ''}</MarkdownContent></div></TabsContent>
                    <TabsContent value="advanced" className="mt-1.5 sm:mt-2"><div className="text-xs sm:text-sm bg-rose-50 dark:bg-rose-950/20 rounded-lg p-2.5 sm:p-3 border border-rose-200 dark:border-rose-800"><MarkdownContent size="sm">{current.aiExplanation.advancedExplanation ?? ''}</MarkdownContent></div></TabsContent>
                    <TabsContent value="practical" className="mt-1.5 sm:mt-2"><div className="text-xs sm:text-sm bg-teal-50 dark:bg-teal-950/20 rounded-lg p-2.5 sm:p-3 border border-teal-200 dark:border-teal-800"><MarkdownContent size="sm">{current.aiExplanation.realWorldExample ?? ''}</MarkdownContent></div></TabsContent>
                    <TabsContent value="interview" className="mt-1.5 sm:mt-2"><div className="text-xs sm:text-sm bg-purple-50 dark:bg-purple-950/20 rounded-lg p-2.5 sm:p-3 border border-purple-200 dark:border-purple-800"><MarkdownContent size="sm">{current.aiExplanation.interviewTips ?? ''}</MarkdownContent></div></TabsContent>
                  </Tabs></div>)}
                <Separator /><div><p className="text-xs text-muted-foreground mb-1.5">Насколько хорошо поняли?</p>
                  <div className="flex gap-1.5 sm:gap-2 flex-wrap"><Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => markProgress('needs_review')}><XCircle className="h-3 w-3 text-rose-500" /> Повторить</Button><Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => markProgress('learning')}><Clock className="h-3 w-3 text-amber-500" /> Изучаю</Button><Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => markProgress('mastered')}><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Освоено</Button></div></div></>
            )}
          </CardContent>
        </Card>
      )}
      {/* Только кнопка «Далее» — в режиме обучения пользователь движется вперёд.
          Кнопка «Назад» была лишней: после markProgress (Повторить/Изучаю/Освоено)
          уже происходит переход к следующему вопросу, и «Назад» дублировал эту логику.
          Когда ответов больше нет — кнопка скрывается. */}
      <div className="flex justify-end">{currentIdx < questions.length - 1 && <Button variant="outline" size="sm" onClick={() => { setShowAnswer(false); setSelectedQuestion(null); setCurrentIdx(i => Math.min(i + 1, questions.length - 1)) }}>Следующий вопрос <ArrowRight className="h-3 w-3 ml-1" /></Button>}</div>
    </div>
  )
}

/* ============ СОБЕСЕДОВАНИЕ ============ */
function InterviewView({ categories }: { categories: Category[] }) {
  // selectedQuestion из store: если пользователь кликнул «Практика» на конкретном
  // вопросе, нужно открыть именно его, а не первый вопрос в списке.
  // selectedCategory из store — контекст выбранной категории, чтобы переход
  // «Практика» из QuestionsView наследовал категорию.
  const { selectedQuestion, setSelectedQuestion, selectedCategory: storeCategoryId, setSelectedCategory: setStoreCategory } = useAppStore()
  const [selectedCategory, setSelectedCategory] = useState(storeCategoryId || '')
  const [questions, setQuestions] = useState<Question[]>([]); const [currentIdx, setCurrentIdx] = useState(0)
  const [userAnswer, setUserAnswer] = useState(''); const [feedback, setFeedback] = useState(''); const [score, setScore] = useState<number | null>(null); const [showAnswer, setShowAnswer] = useState(false)
  const [totalScore, setTotalScore] = useState(0); const [answered, setAnswered] = useState(0)
  useEffect(() => { const params = new URLSearchParams(); if (selectedCategory) params.set('categoryId', selectedCategory); params.set('limit', '20'); fetch(`/api/questions?${params}`).then(r => r.json()).then(data => setQuestions(data.questions || [])) }, [selectedCategory])

  // current — это вычисляемое значение (derived state): если есть selectedQuestion
  // (пользователь кликнул «Практика» на конкретном вопросе), показываем его;
  // иначе — вопрос по текущему индексу. Без эффекта, чтобы не было каскадных рендеров.
  const current = selectedQuestion
    ? questions.find(q => q.id === selectedQuestion) ?? questions[currentIdx]
    : questions[currentIdx]

  const submitAnswer = async () => {
    if (!current || !userAnswer.trim()) return
    try { const res = await fetch('/api/ai-mentor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userAnswer, context: current.title, mode: 'interview' }) }); const data = await res.json(); setFeedback(data.response); const s = Math.min(Math.floor(userAnswer.length / 10) + current.answer.toLowerCase().split(' ').filter(w => userAnswer.toLowerCase().includes(w)).length * 3, 100); setScore(s); setTotalScore(t => t + s); setAnswered(a => a + 1) }
    catch { setFeedback('Ошибка при оценке.') }
  }
  const nextQ = () => {
    // Переход к следующему вопросу сбрасывает selectedQuestion — иначе
    // useEffect выше снова вернул бы нас к этому же вопросу.
    setSelectedQuestion(null)
    setCurrentIdx(i => Math.min(i + 1, questions.length - 1)); setUserAnswer(''); setFeedback(''); setScore(null); setShowAnswer(false)
  }
  const onCategoryChange = (val: string) => {
    setSelectedCategory(val)
    setStoreCategory(val || null)
    setCurrentIdx(0); setAnswered(0); setTotalScore(0)
    setSelectedQuestion(null)
  }
  return (
    <div className="max-w-4xl space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h2 className="text-lg sm:text-xl font-bold">Собеседование</h2><p className="text-xs text-muted-foreground">Практика ответов</p></div>
        <div className="flex gap-2 items-center">{answered > 0 && <Badge variant="secondary" className="text-[10px] sm:text-xs"><Trophy className="h-3 w-3 mr-1" /> {Math.round(totalScore / answered)}/100</Badge>}
          <select value={selectedCategory} onChange={(e) => onCategoryChange(e.target.value)} className="text-xs border rounded-md px-2 py-1.5 bg-background"><option value="">Все</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>
      {current ? (
        <Card><CardHeader className="p-3 sm:p-6"><div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 flex-wrap"><Badge className={DIFFICULTY_COLORS[current.difficulty]} variant="secondary">{DIFFICULTY_LABELS[current.difficulty]}</Badge>{current.category && <Badge variant="outline" className="text-[10px] sm:text-xs">{current.category.name}</Badge>}<Badge variant="secondary" className="ml-auto text-[10px] sm:text-xs">В {currentIdx + 1}/{questions.length}</Badge></div>
          <CardTitle className="text-sm sm:text-lg">{current.title}</CardTitle><CardDescription className="text-xs sm:text-sm">{current.content}</CardDescription></CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-3">
            <Textarea placeholder="Напишите ответ..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} rows={4} className="resize-y text-sm" />
            <div className="flex gap-1.5 sm:gap-2"><Button size="sm" onClick={submitAnswer} disabled={!userAnswer.trim() || !!feedback} className="gap-1 text-xs"><Send className="h-3 w-3" /> Отправить</Button><Button variant="outline" size="sm" onClick={() => setShowAnswer(!showAnswer)} className="text-xs"><Eye className="h-3 w-3 mr-1" /> {showAnswer ? 'Скрыть' : 'Эталон'}</Button></div>
            {score !== null && <div className="space-y-2"><div className="flex items-center gap-2"><span className="font-semibold text-xs sm:text-sm">Оценка:</span><Badge className={score >= 70 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : score >= 40 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'}>{score}/100</Badge></div><div className="text-xs sm:text-sm bg-muted/50 rounded-lg p-3"><MarkdownContent size="sm">{feedback}</MarkdownContent></div></div>}
            {showAnswer && <div className="text-xs sm:text-sm bg-muted/50 rounded-lg p-3 border"><p className="font-semibold mb-1">Эталон:</p><MarkdownContent size="sm">{current.answer}</MarkdownContent></div>}
          </CardContent>
        </Card>
      ) : <div className="text-center py-10 text-muted-foreground"><Mic className="h-10 w-10 mx-auto mb-2 opacity-20" /><p className="text-sm">Выберите категорию</p></div>}
      {current && <div className="flex justify-end"><Button variant="outline" size="sm" onClick={nextQ} disabled={currentIdx >= questions.length - 1} className="text-xs">Далее <ArrowRight className="h-3 w-3 ml-1" /></Button></div>}
    </div>
  )
}

/* ============ ИИ-НАСТАВНИК ============ */
function MentorView({ categories }: { categories: Category[] }) {
  const { messages, isLoading, clearMessages, sendMessage, retryLastMessage } = useChatStore()
  // selectedCategory из store: если пользователь пришёл из категории, ИИ-наставник
  // должен использовать специализированный системный промпт для этого раздела.
  // Например, при переходе из категории «Docker» вопросы будут идти по Docker.
  const { selectedCategory } = useAppStore()
  const currentCategorySlug = useMemo(
    () => categories.find(c => c.id === selectedCategory)?.slug ?? null,
    [categories, selectedCategory]
  )
  const [input, setInput] = useState('')
  const sending = isLoading
  const send = async () => {
    if (!input.trim() || sending) return
    const t = input.trim()
    setInput('')
    // Выбираем системный промпт: специализированный для раздела или дефолтный.
    const systemPrompt = currentCategorySlug ? (chatPrompts[currentCategorySlug] || defaultPrompt) : defaultPrompt
    await sendMessage(t, systemPrompt)
  }
  return (
    <div className="max-w-3xl h-[calc(100vh-7rem)] sm:h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-2 sm:mb-3"><h2 className="text-lg sm:text-xl font-bold flex items-center gap-2"><Brain className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" /> ИИ-наставник</h2>
        <p className="text-xs text-muted-foreground">
          {currentCategorySlug
            ? `Контекст: ${categories.find(c => c.slug === currentCategorySlug)?.name ?? 'раздел'}`
            : 'Задавайте вопросы по сисадмину и DevOps'}
        </p>
      </div>
      <ScrollArea className="flex-1 border rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 bg-card">
        <div className="space-y-3">
          {messages.length === 0 && <div className="text-center py-6 text-sm text-muted-foreground"><Brain className="h-8 w-8 mx-auto mb-2 opacity-20" /><p>Здравствуйте! Задайте вопрос о Linux, Docker, K8s, сетях...</p></div>}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white ${msg.role === 'user' ? 'bg-primary' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                {msg.role === 'user' ? <User className="h-3 w-3" /> : <Brain className="h-3 w-3" />}
              </div>
              <div className={`flex-1 min-w-0 rounded-lg px-3 py-2 text-xs sm:text-sm break-words leading-relaxed ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {msg.role === 'user'
                  ? <span className="whitespace-pre-wrap">{msg.content}</span>
                  // Сообщения ассистента в ИИ-наставнике рендерим как Markdown
                  // для красивого разделения на блоки (команды, списки, заголовки).
                  : <MarkdownContent size="sm">{msg.content}</MarkdownContent>}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse"><Brain className="h-3 w-3" /> Думаю...</div>}
        </div>
      </ScrollArea>
      <div className="flex gap-2">
        <Input placeholder="Спросите о Linux, Docker, K8s..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send() }} disabled={sending} className="text-sm" />
        <Button onClick={send} disabled={sending || !input.trim()} size="icon" className="shrink-0"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

/* ============ ПРОГРЕСС ============ */
function ProgressView() {
  const [data, setData] = useState<{ stats: { total: number; mastered: number; learning: number; needsReview: number }; categoryStats: { id: string; name: string; total: number; mastered: number; learning: number }[]; user: { id: string; name: string; email: string; xp: number; level: string } | null } | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/progress').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false)) }, [])
  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Загрузка...</div>
  if (!data) return <div className="py-10 text-center text-sm text-muted-foreground">Ошибка загрузки</div>
  const level = getLevelForXP(data.user?.xp || 0); const nextLevel = getNextLevel(data.user?.xp || 0); const progress = getProgressToNextLevel(data.user?.xp || 0)
  return (
    <div className="max-w-5xl space-y-4 sm:space-y-6">
      <Card className="border-0 bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
        <CardContent className="p-4 sm:p-6"><div className="flex items-center justify-between flex-wrap gap-3">
          <div><div className="text-2xl mb-0.5">{level.icon}</div><h2 className="text-xl sm:text-2xl font-bold">{level.name}</h2><p className="text-purple-200 text-xs sm:text-sm">{data.user?.name || 'Демо'}</p></div>
          <div className="text-right"><div className="text-2xl sm:text-3xl font-bold">{data.user?.xp || 0} XP</div>{nextLevel && <div className="text-xs sm:text-sm text-purple-200">{nextLevel.minXP - (data.user?.xp || 0)} XP до {nextLevel.name}</div>}</div>
        </div>{nextLevel && <div className="mt-3 sm:mt-4"><div className="flex justify-between text-xs sm:text-sm mb-1"><span>{level.name}</span><span>{nextLevel.name}</span></div><Progress value={progress} className="h-2 sm:h-3" /></div>}</CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        {[{ l: 'Отвечено', v: data.stats.total, i: <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" /> }, { l: 'Освоено', v: data.stats.mastered, i: <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" /> },
          { l: 'В процессе', v: data.stats.learning, i: <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" /> }, { l: 'Повторить', v: data.stats.needsReview, i: <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500" /> }
        ].map((s, i) => (<Card key={i}><CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3"><div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-muted flex items-center justify-center">{s.i}</div><div><div className="text-lg sm:text-2xl font-bold">{s.v}</div><div className="text-[10px] sm:text-xs text-muted-foreground">{s.l}</div></div></CardContent></Card>))}
      </div>
      <Card><CardHeader className="pb-2 sm:pb-3"><CardTitle className="text-xs sm:text-base">Уровни</CardTitle></CardHeader>
        <CardContent><div className="flex flex-wrap gap-1 sm:gap-2">{LEVELS.map(l => (<div key={l.name} className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium ${data.user?.level === l.name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{l.icon} {l.name}</div>))}</div></CardContent></Card>
    </div>
  )
}

/* ============ АДМИН ============ */
function AdminView() {
  const [syncState, setSyncState] = useState<{ repoUrl: string; lastSyncAt: string | null; status: string } | null>(null)
  const [recentLogs, setRecentLogs] = useState<{ id: string; type: string; status: string; details: string; createdAt: string }[]>([])
  const [syncing, setSyncing] = useState(false); const [generating, setGenerating] = useState(false); const [genResult, setGenResult] = useState('')
  // Состояние для reseed — применяется Markdown-форматирование ко всем ответам.
  // Это позволяет запустить обновление БД прямо из UI без доступа к терминалу.
  const [reseeding, setReseeding] = useState(false); const [reseedResult, setReseedResult] = useState('')
  const [adminStats, setAdminStats] = useState<{ totalQuestions: number; totalCategories: number; totalTags: number; totalExplanations: number; beginner: number; intermediate: number; advanced: number } | null>(null)
  useEffect(() => {
    fetch('/api/admin/sync').then(r => r.json()).then(d => { setSyncState(d.syncState); setRecentLogs(d.recentLogs || []) })
    fetch('/api/stats').then(r => r.json()).then(d => { setAdminStats(d) })
  }, [])
  const triggerSync = async () => { setSyncing(true); try { await fetch('/api/admin/sync', { method: 'POST' }); const d = await (await fetch('/api/admin/sync')).json(); setSyncState(d.syncState); setRecentLogs(d.recentLogs || []) } catch {} setSyncing(false) }
  const genExpl = async () => { setGenerating(true); setGenResult(''); try { const d = await (await fetch('/api/admin/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate-explanations' }) })).json(); setGenResult(d.message || 'Готово') } catch { setGenResult('Ошибка') } setGenerating(false) }
  // reseed — вызывает /api/admin/reseed, который обновляет все 86 ответов и
  // объяснений Markdown-версиями. После завершения перезагружает статистику.
  const triggerReseed = async () => {
    setReseeding(true); setReseedResult('')
    try {
      const d = await (await fetch('/api/admin/reseed', { method: 'POST' })).json()
      if (d.success) {
        const stats = d.stats
        setReseedResult(`✓ Готово: ${stats.questionsCreated + stats.questionsUpdated} вопросов обновлено, ${stats.explanationsCreated + stats.explanationsUpdated} объяснений`)
        // Перезагружаем статистику
        const newStats = await (await fetch('/api/stats')).json()
        setAdminStats(newStats)
      } else {
        setReseedResult(`✗ Ошибка: ${d.error || 'неизвестно'}`)
      }
    } catch (e) {
      setReseedResult(`✗ Ошибка сети: ${e instanceof Error ? e.message : 'unknown'}`)
    }
    setReseeding(false)
  }
  const s = adminStats
  return (
    <div className="max-w-5xl space-y-4 sm:space-y-6"><h2 className="text-lg sm:text-xl font-bold">Админ-панель</h2>
      <Tabs defaultValue="content"><TabsList className="flex-wrap"><TabsTrigger value="content" className="text-xs">Контент</TabsTrigger><TabsTrigger value="sync" className="text-xs">GitHub Sync</TabsTrigger><TabsTrigger value="ai" className="text-xs">ИИ</TabsTrigger><TabsTrigger value="logs" className="text-xs">Логи</TabsTrigger></TabsList>
        <TabsContent value="content" className="mt-3 sm:mt-4"><Card><CardContent className="p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">{[[s?.totalQuestions ?? '—', 'Вопросов'], [s?.totalCategories ?? '—', 'Категорий'], [s?.totalExplanations ?? '—', 'ИИ-объясн.'], [s?.totalTags ?? '—', 'Тегов']].map(([v, l]) => (<div key={String(l)} className="text-center p-2 sm:p-3 rounded-lg bg-muted"><div className="text-lg sm:text-2xl font-bold">{v}</div><div className="text-[10px] sm:text-xs text-muted-foreground">{l}</div></div>))}</div>
          {s && <div className="mt-3 grid grid-cols-3 gap-2 text-center">{[['Начальный', s.beginner], ['Средний', s.intermediate], ['Продвинутый', s.advanced]].map(([l, v]) => (<div key={String(l)} className="p-2 rounded-lg bg-muted/50"><div className="text-sm font-bold">{v}</div><div className="text-[10px] text-muted-foreground">{String(l)}</div></div>))}</div>}
          {/* Кнопка reseed — обновляет все ответы и объяснения Markdown-версиями.
              Вызывает /api/admin/reseed, который делает upsert всех 86 вопросов
              и 86 AI-объяснений с обновлёнными полями. */}
          <Separator className="my-2" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={triggerReseed} disabled={reseeding} className="gap-1 text-xs">
                <RefreshCw className={`h-3 w-3 ${reseeding ? 'animate-spin' : ''}`} />
                {reseeding ? 'Пересидирование...' : 'Пересидировать БД (Markdown)'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Обновляет все 86 ответов и AI-объяснений структурированным Markdown
              с заголовками, списками и подсветкой команд.
            </p>
            {reseedResult && <div className={`text-xs rounded-lg p-2 ${reseedResult.startsWith('✓') ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400'}`}>{reseedResult}</div>}
          </div>
        </CardContent></Card></TabsContent>
        <TabsContent value="sync" className="mt-3 sm:mt-4"><Card><CardContent className="p-3 sm:p-4 space-y-3">
          {syncState && <div className="grid grid-cols-2 gap-2 text-xs"><div className="text-muted-foreground">Репо:</div><div className="font-mono text-[10px] sm:text-xs truncate">{syncState.repoUrl}</div><div className="text-muted-foreground">Статус:</div><div><Badge variant="secondary">{syncState.status === 'idle' ? 'Ожидание' : syncState.status}</Badge></div></div>}
          <Button size="sm" onClick={triggerSync} disabled={syncing} className="gap-1 text-xs"><RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Синхронизация...' : 'Запустить'}</Button>
        </CardContent></Card></TabsContent>
        <TabsContent value="ai" className="mt-3 sm:mt-4"><Card><CardContent className="p-3 sm:p-4 space-y-3">
          <Button size="sm" onClick={genExpl} disabled={generating} className="gap-1 text-xs"><Brain className={`h-3 w-3 ${generating ? 'animate-pulse' : ''}`} /> {generating ? 'Генерация...' : 'Сгенерировать объяснения'}</Button>
          {genResult && <div className="text-xs bg-muted rounded-lg p-2">{genResult}</div>}
        </CardContent></Card></TabsContent>
        <TabsContent value="logs" className="mt-3 sm:mt-4"><Card><CardContent className="p-3 sm:p-4">{recentLogs.length > 0 ? <div className="space-y-1.5">{recentLogs.map(l => (<div key={l.id} className="flex items-center gap-2 p-1.5 rounded bg-muted/50 text-xs"><Badge variant="secondary" className="text-[10px]">{l.status === 'completed' ? 'ОК' : 'Ошибка'}</Badge><span className="flex-1 truncate">{l.details}</span></div>))}</div> : <p className="text-xs text-muted-foreground">Логов пока нет</p>}</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  )
}
