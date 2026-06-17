'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore, CATEGORY_ICONS, DIFFICULTY_COLORS, getLevelForXP, getNextLevel, getProgressToNextLevel, type AppView } from '@/lib/store'
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
import {
  Terminal, Network, Code, Shield, Box, Blocks, Layers, Play, Cloud, CloudRain,
  CloudSun, GitBranch, Activity, Database, Globe, Search, BookOpen,
  BarChart3, Settings, Sun, Moon, Menu, ChevronRight, ChevronLeft, Star, Target,
  Brain, Zap, Clock, TrendingUp, Award, RefreshCw, Sparkles, Send, CheckCircle2,
  XCircle, HelpCircle, ArrowRight, ArrowLeft, Eye, Lightbulb,
  GraduationCap, Trophy, LayoutDashboard, FolderOpen, Mic, Cpu
} from 'lucide-react'

// Types
interface Category {
  id: string; name: string; slug: string; description: string; icon: string; order: number; _count?: { questions: number }
}

interface Tag {
  id: string; name: string; slug: string
}

interface AiExplanation {
  id: string; beginnerExplanation?: string; intermediateExplanation?: string; advancedExplanation?: string
  realWorldExample?: string; interviewTips?: string; relatedTopics?: string
}

interface Question {
  id: string; title: string; slug: string; content: string; answer: string; difficulty: string
  source: string; views: number; categoryId: string; category?: Category
  tags?: { tag: Tag }[]; aiExplanation?: AiExplanation | null
}

interface Stats {
  totalQuestions: number; totalCategories: number; totalTags: number
  difficultyBreakdown: { difficulty: string; count: number }[]
  categoryStats: Category[]; recentQuestions: Question[]
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Terminal: <Terminal className="h-5 w-5" />,
  Network: <Network className="h-5 w-5" />,
  Code: <Code className="h-5 w-5" />,
  Shield: <Shield className="h-5 w-5" />,
  Container: <Box className="h-5 w-5" />,
  Blocks: <Blocks className="h-5 w-5" />,
  Layers: <Layers className="h-5 w-5" />,
  Play: <Play className="h-5 w-5" />,
  Cloud: <Cloud className="h-5 w-5" />,
  CloudRain: <CloudRain className="h-5 w-5" />,
  CloudSun: <CloudSun className="h-5 w-5" />,
  GitBranch: <GitBranch className="h-5 w-5" />,
  Activity: <Activity className="h-5 w-5" />,
  Database: <Database className="h-5 w-5" />,
  Globe: <Globe className="h-5 w-5" />,
}

const NAV_ITEMS: { view: AppView; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { view: 'categories', label: 'Categories', icon: <FolderOpen className="h-4 w-4" /> },
  { view: 'search', label: 'Search', icon: <Search className="h-4 w-4" /> },
  { view: 'learning', label: 'Learning Mode', icon: <BookOpen className="h-4 w-4" /> },
  { view: 'interview', label: 'Interview Mode', icon: <Mic className="h-4 w-4" /> },
  { view: 'mentor', label: 'AI Mentor', icon: <Brain className="h-4 w-4" /> },
  { view: 'progress', label: 'My Progress', icon: <BarChart3 className="h-4 w-4" /> },
  { view: 'admin', label: 'Admin Panel', icon: <Settings className="h-4 w-4" /> },
]

export default function Home() {
  const { currentView, setView, darkMode, toggleDarkMode } = useAppStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Initialize dark mode from system preference
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        document.documentElement.classList.add('dark')
        useAppStore.setState({ darkMode: true })
      }
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [catRes, statsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/stats'),
      ])
      const catData = await catRes.json()
      const statsData = await statsRes.json()
      setCategories(catData)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView stats={stats} categories={categories} loading={loading} />
      case 'categories': return <CategoriesView categories={categories} />
      case 'questions': return <QuestionsView />
      case 'search': return <SearchView categories={categories} />
      case 'learning': return <LearningView categories={categories} />
      case 'interview': return <InterviewView categories={categories} />
      case 'mentor': return <MentorView />
      case 'progress': return <ProgressView />
      case 'admin': return <AdminView />
      default: return <DashboardView stats={stats} categories={categories} loading={loading} />
    }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Cpu className="h-4 w-4 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="font-bold text-sm">AI SysAdmin</h1>
              <p className="text-[10px] text-muted-foreground">Academy</p>
            </div>
          )}
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            onClick={() => { setView(item.view); setMobileMenuOpen(false) }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              currentView === item.view
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.icon}
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      {!sidebarCollapsed && stats && (
        <div className="p-3 border-t">
          <div className="text-xs text-muted-foreground mb-1">{stats.totalQuestions} questions in {stats.totalCategories} categories</div>
          <div className="text-xs text-muted-foreground">Powered by AI</div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col border-r bg-card transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
        <SidebarContent />
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 border-t hover:bg-muted transition-colors flex items-center justify-center"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-56 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b bg-card flex items-center px-4 gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold text-lg capitalize">{currentView === 'dashboard' ? 'Dashboard' : currentView.replace('-', ' ')}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

// ============ DASHBOARD VIEW ============
function DashboardView({ stats, categories, loading }: { stats: Stats | null; categories: Category[]; loading: boolean }) {
  const { setView, setSelectedCategory } = useAppStore()

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stats) return <div>Failed to load data</div>

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Hero */}
      <Card className="border-0 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
        <CardContent className="p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">AI SysAdmin Academy</h1>
          <p className="text-emerald-100 text-sm md:text-base mb-4">
            Современная образовательная платформа для системных администраторов и DevOps-инженеров.
            Более {stats.totalQuestions} вопросов с AI-объяснениями.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setView('learning')} className="gap-2">
              <BookOpen className="h-4 w-4" /> Start Learning
            </Button>
            <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => setView('interview')}>
              <Mic className="h-4 w-4 mr-2" /> Interview Mode
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Questions', value: stats.totalQuestions, icon: <HelpCircle className="h-5 w-5 text-emerald-600" /> },
          { label: 'Categories', value: stats.totalCategories, icon: <FolderOpen className="h-5 w-5 text-teal-600" /> },
          { label: 'Tags', value: stats.totalTags, icon: <Star className="h-5 w-5 text-amber-600" /> },
          { label: 'AI Enhanced', value: stats.difficultyBreakdown.reduce((a, b) => a + b.count, 0), icon: <Sparkles className="h-5 w-5 text-purple-600" /> },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">{s.icon}</div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Difficulty Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Difficulty Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.difficultyBreakdown.map((d) => (
              <div key={d.difficulty} className="flex items-center gap-3">
                <Badge className={DIFFICULTY_COLORS[d.difficulty] || ''} variant="secondary">{d.difficulty}</Badge>
                <div className="flex-1">
                  <Progress value={(d.count / stats.totalQuestions) * 100} className="h-2" />
                </div>
                <span className="text-sm font-medium w-8 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div>
        <h3 className="font-semibold text-lg mb-3">Categories</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <Card
              key={cat.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { setSelectedCategory(cat.id); setView('questions') }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {ICON_MAP[cat.icon] || <FolderOpen className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{cat.name}</div>
                  <div className="text-xs text-muted-foreground">{cat._count?.questions || 0} questions</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============ CATEGORIES VIEW ============
function CategoriesView({ categories }: { categories: Category[] }) {
  const { setView, setSelectedCategory } = useAppStore()

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">All Categories</h2>
        <p className="text-sm text-muted-foreground">Browse questions by technology domain</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <Card
            key={cat.id}
            className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
            onClick={() => { setSelectedCategory(cat.id); setView('questions') }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  {ICON_MAP[cat.icon] || <FolderOpen className="h-6 w-6" />}
                </div>
                <div>
                  <CardTitle className="text-base">{cat.name}</CardTitle>
                  <CardDescription className="text-xs">{cat._count?.questions || 0} questions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground line-clamp-2">{cat.description}</p>
              <div className="mt-3 flex items-center text-xs text-primary">
                Start learning <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ============ QUESTIONS VIEW ============
function QuestionsView() {
  const { selectedCategory, setSelectedCategory } = useAppStore()
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [difficulty, setDifficulty] = useState('all')
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories)
  }, [])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (selectedCategory) params.set('categoryId', selectedCategory)
    if (difficulty !== 'all') params.set('difficulty', difficulty)
    params.set('page', page.toString())
    params.set('limit', '20')

    fetch(`/api/questions?${params}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setQuestions(data.questions || []); setTotal(data.total || 0); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedCategory, difficulty, page])

  const currentCategory = categories.find(c => c.id === selectedCategory)

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> All
        </Button>
        {currentCategory && (
          <Badge variant="secondary" className="text-sm">
            {ICON_MAP[currentCategory.icon]} {currentCategory.name}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'beginner', 'intermediate', 'advanced'].map(d => (
          <Button
            key={d}
            variant={difficulty === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setDifficulty(d); setPage(1) }}
          >
            {d === 'all' ? 'All Levels' : d.charAt(0).toUpperCase() + d.slice(1)}
          </Button>
        ))}
      </div>

      <div className="text-sm text-muted-foreground">{total} questions found</div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="py-2 px-3 text-sm">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function QuestionCard({ question }: { question: Question }) {
  const { setView, setSelectedQuestion } = useAppStore()
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={DIFFICULTY_COLORS[question.difficulty] || ''} variant="secondary">
                {question.difficulty}
              </Badge>
              {question.category && (
                <Badge variant="outline" className="text-xs">{question.category.name}</Badge>
              )}
            </div>
            <h3 className="font-medium text-sm cursor-pointer hover:text-primary" onClick={() => { setSelectedQuestion(question.id); setView('questions') }}>
              {question.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{question.content}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronLeft className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-sm bg-muted/50 rounded-lg p-4">{question.answer}</div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setSelectedQuestion(question.id); setView('learning') }}>
                <BookOpen className="h-3 w-3 mr-1" /> Learn
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setSelectedQuestion(question.id); setView('interview') }}>
                <Mic className="h-3 w-3 mr-1" /> Practice
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ SEARCH VIEW ============
function SearchView({ categories }: { categories: Category[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Question[]>([])
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category) params.set('category', category)
    if (difficulty) params.set('difficulty', difficulty)
    if (!query && !category && !difficulty) return
    fetch(`/api/search?${params}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setResults(data.questions || []) })
      .catch(() => { if (!cancelled) setResults([]) })
    return () => { cancelled = true }
  }, [query, category, difficulty])

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Search Questions</h2>
        <p className="text-sm text-muted-foreground">Full-text search across all questions, answers, and tags</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions, answers, technologies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 bg-background"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 bg-background"
        >
          <option value="">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {results.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{results.length} results</div>
          {results.map(q => <QuestionCard key={q.id} question={q} />)}
        </div>
      ) : query ? (
        <div className="text-center py-8 text-muted-foreground">No results found for &quot;{query}&quot;</div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Start typing to search across {categories.length} categories</p>
        </div>
      )}
    </div>
  )
}

// ============ LEARNING VIEW ============
function LearningView({ categories }: { categories: Category[] }) {
  const { selectedQuestion, setSelectedQuestion } = useAppStore()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [explanationTab, setExplanationTab] = useState('beginner')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('mode', 'learning')
    if (selectedCategory) params.set('categoryId', selectedCategory)
    if (difficulty) params.set('difficulty', difficulty)
    params.set('limit', '50')
    fetch(`/api/questions?${params}`)
      .then(r => r.json())
      .then(data => setQuestions(data.questions || []))
  }, [selectedCategory, difficulty])

  const current = questions[selectedQuestion ? questions.findIndex(q => q.id === selectedQuestion) : currentIdx]

  const markProgress = async (status: string) => {
    if (!current) return
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: current.id, status, score: status === 'mastered' ? 100 : 50 }),
    })
    nextQuestion()
  }

  const nextQuestion = () => {
    setShowAnswer(false)
    setSelectedQuestion(null)
    setCurrentIdx(i => Math.min(i + 1, questions.length - 1))
  }

  const prevQuestion = () => {
    setShowAnswer(false)
    setSelectedQuestion(null)
    setCurrentIdx(i => Math.max(i - 1, 0))
  }

  if (!current && questions.length === 0) {
    return (
      <div className="max-w-4xl space-y-4">
        <h2 className="text-xl font-bold">Learning Mode</h2>
        <p className="text-sm text-muted-foreground">Select a category and difficulty to start learning</p>
        <div className="flex gap-2 flex-wrap">
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="text-sm border rounded-md px-3 py-1.5 bg-background">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="text-sm border rounded-md px-3 py-1.5 bg-background">
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Select filters and start your learning journey</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">Learning Mode</h2>
          <p className="text-sm text-muted-foreground">Question {currentIdx + 1} of {questions.length}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setCurrentIdx(0) }} className="text-sm border rounded-md px-3 py-1.5 bg-background">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setCurrentIdx(0) }} className="text-sm border rounded-md px-3 py-1.5 bg-background">
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {current && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={DIFFICULTY_COLORS[current.difficulty]} variant="secondary">{current.difficulty}</Badge>
              {current.category && <Badge variant="outline">{current.category.name}</Badge>}
            </div>
            <CardTitle className="text-lg">{current.title}</CardTitle>
            <CardDescription>{current.content}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showAnswer ? (
              <Button onClick={() => setShowAnswer(true)} className="gap-2">
                <Lightbulb className="h-4 w-4" /> Show Answer
              </Button>
            ) : (
              <>
                <div className="whitespace-pre-wrap text-sm bg-muted/50 rounded-lg p-4 border">{current.answer}</div>

                {/* AI Explanation */}
                {current.aiExplanation && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-purple-500" /> AI Explanation
                    </h4>
                    <Tabs value={explanationTab} onValueChange={setExplanationTab}>
                      <TabsList className="w-full justify-start">
                        <TabsTrigger value="beginner">Beginner</TabsTrigger>
                        <TabsTrigger value="intermediate">Intermediate</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced</TabsTrigger>
                        <TabsTrigger value="practical">Practical</TabsTrigger>
                        <TabsTrigger value="interview">Interview</TabsTrigger>
                      </TabsList>
                      <TabsContent value="beginner" className="mt-2">
                        <div className="text-sm bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                          {current.aiExplanation.beginnerExplanation}
                        </div>
                      </TabsContent>
                      <TabsContent value="intermediate" className="mt-2">
                        <div className="text-sm bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                          {current.aiExplanation.intermediateExplanation}
                        </div>
                      </TabsContent>
                      <TabsContent value="advanced" className="mt-2">
                        <div className="text-sm bg-rose-50 dark:bg-rose-950/20 rounded-lg p-3 border border-rose-200 dark:border-rose-800">
                          {current.aiExplanation.advancedExplanation}
                        </div>
                      </TabsContent>
                      <TabsContent value="practical" className="mt-2">
                        <div className="text-sm bg-teal-50 dark:bg-teal-950/20 rounded-lg p-3 border border-teal-200 dark:border-teal-800">
                          {current.aiExplanation.realWorldExample}
                        </div>
                      </TabsContent>
                      <TabsContent value="interview" className="mt-2">
                        <div className="text-sm bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                          {current.aiExplanation.interviewTips}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                <Separator />

                {/* Progress buttons */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">How well did you understand this?</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => markProgress('needs_review')} className="gap-1">
                      <XCircle className="h-3 w-3 text-rose-500" /> Need Review
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => markProgress('learning')} className="gap-1">
                      <Clock className="h-3 w-3 text-amber-500" /> Still Learning
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => markProgress('mastered')} className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Mastered
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prevQuestion} disabled={currentIdx === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <Button variant="outline" onClick={nextQuestion} disabled={currentIdx >= questions.length - 1}>
          Next <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ============ INTERVIEW VIEW ============
function InterviewView({ categories }: { categories: Category[] }) {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [totalScore, setTotalScore] = useState(0)
  const [answered, setAnswered] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedCategory) params.set('categoryId', selectedCategory)
    params.set('limit', '20')
    fetch(`/api/questions?${params}`)
      .then(r => r.json())
      .then(data => setQuestions(data.questions || []))
  }, [selectedCategory])

  const current = questions[currentIdx]

  const submitAnswer = async () => {
    if (!current || !userAnswer.trim()) return
    try {
      const res = await fetch('/api/ai-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userAnswer, context: current.title, mode: 'interview' }),
      })
      const data = await res.json()
      setFeedback(data.response)

      // Simple scoring based on answer length and keywords
      const baseScore = Math.min(Math.floor(userAnswer.length / 10), 40)
      const keywordBonus = current.answer.toLowerCase().split(' ').filter(w => userAnswer.toLowerCase().includes(w)).length * 3
      const finalScore = Math.min(baseScore + keywordBonus, 100)
      setScore(finalScore)
      setTotalScore(s => s + finalScore)
      setAnswered(a => a + 1)
    } catch {
      setFeedback('Error evaluating answer. Please try again.')
    }
  }

  const nextQuestion = () => {
    setCurrentIdx(i => Math.min(i + 1, questions.length - 1))
    setUserAnswer('')
    setFeedback('')
    setScore(null)
    setShowAnswer(false)
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">Interview Mode</h2>
          <p className="text-sm text-muted-foreground">
            Practice answering questions as in a real interview
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {answered > 0 && (
            <Badge variant="secondary">
              <Trophy className="h-3 w-3 mr-1" /> Avg: {Math.round(totalScore / answered)}/100
            </Badge>
          )}
          <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setCurrentIdx(0); setAnswered(0); setTotalScore(0) }} className="text-sm border rounded-md px-3 py-1.5 bg-background">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {current ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={DIFFICULTY_COLORS[current.difficulty]} variant="secondary">{current.difficulty}</Badge>
              {current.category && <Badge variant="outline">{current.category.name}</Badge>}
              <Badge variant="secondary" className="ml-auto">Q {currentIdx + 1}/{questions.length}</Badge>
            </div>
            <CardTitle className="text-lg">{current.title}</CardTitle>
            <CardDescription>{current.content}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Type your answer here... Be as detailed as possible."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              rows={6}
              className="resize-y"
            />
            <div className="flex gap-2">
              <Button onClick={submitAnswer} disabled={!userAnswer.trim() || !!feedback} className="gap-2">
                <Send className="h-4 w-4" /> Submit Answer
              </Button>
              <Button variant="outline" onClick={() => setShowAnswer(!showAnswer)}>
                <Eye className="h-4 w-4 mr-1" /> {showAnswer ? 'Hide' : 'Show'} Reference
              </Button>
            </div>

            {score !== null && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Score:</span>
                  <Badge className={score >= 70 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : score >= 40 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'}>
                    {score}/100
                  </Badge>
                </div>
                <div className="text-sm bg-muted/50 rounded-lg p-4 whitespace-pre-wrap">{feedback}</div>
              </div>
            )}

            {showAnswer && (
              <div className="text-sm bg-muted/50 rounded-lg p-4 whitespace-pre-wrap border">
                <p className="font-semibold mb-2">Reference Answer:</p>
                {current.answer}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Mic className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Select a category to start the interview</p>
        </div>
      )}

      {current && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={nextQuestion} disabled={currentIdx >= questions.length - 1}>
            Next Question <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ============ AI MENTOR VIEW ============
function MentorView() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hello! I am your AI SysAdmin Mentor. Ask me anything about Linux, networking, Docker, Kubernetes, cloud, security, DevOps, or any other sysadmin topic. I can explain concepts, help with interview prep, or guide your learning path!\n\nTry asking:\n- "How does the Linux boot process work?"\n- "Explain Docker networking"\n- "What do I need to know about Kubernetes for interviews?"' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    setMessages(m => [...m, { role: 'user', content: userMsg }])
    setSending(true)

    try {
      const res = await fetch('/api/ai-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, mode: 'mentor' }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.response }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    }
    setSending(false)
  }

  return (
    <div className="max-w-3xl h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" /> AI Mentor
        </h2>
        <p className="text-sm text-muted-foreground">Ask anything about system administration, DevOps, and infrastructure</p>
      </div>

      <ScrollArea className="flex-1 border rounded-lg p-4 mb-3 bg-card">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <Zap className="h-4 w-4 animate-pulse" /> Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          placeholder="Ask me about Linux, Docker, Kubernetes, networking..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={sending}
        />
        <Button onClick={sendMessage} disabled={sending || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ============ PROGRESS VIEW ============
function ProgressView() {
  const [progressData, setProgressData] = useState<{
    stats: { total: number; mastered: number; learning: number; needsReview: number }
    categoryStats: { id: string; name: string; total: number; mastered: number; learning: number }[]
    user: { id: string; name: string; email: string; xp: number; level: string } | null
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/progress')
      .then(r => r.json())
      .then(data => { setProgressData(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading progress...</div>
  if (!progressData) return <div className="py-12 text-center text-muted-foreground">Failed to load progress</div>

  const level = getLevelForXP(progressData.user?.xp || 0)
  const nextLevel = getNextLevel(progressData.user?.xp || 0)
  const progress = getProgressToNextLevel(progressData.user?.xp || 0)

  return (
    <div className="max-w-5xl space-y-6">
      {/* Level Card */}
      <Card className="border-0 bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-3xl mb-1">{level.icon}</div>
              <h2 className="text-2xl font-bold">{level.name}</h2>
              <p className="text-purple-200 text-sm">{progressData.user?.name || 'Demo User'}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{progressData.user?.xp || 0} XP</div>
              {nextLevel && (
                <div className="text-sm text-purple-200">
                  {nextLevel.minXP - (progressData.user?.xp || 0)} XP to {nextLevel.name}
                </div>
              )}
            </div>
          </div>
          {nextLevel && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>{level.name}</span>
                <span>{nextLevel.name}</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Answered', value: progressData.stats.total, icon: <Target className="h-5 w-5 text-blue-500" /> },
          { label: 'Mastered', value: progressData.stats.mastered, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
          { label: 'In Progress', value: progressData.stats.learning, icon: <Clock className="h-5 w-5 text-amber-500" /> },
          { label: 'Needs Review', value: progressData.stats.needsReview, icon: <XCircle className="h-5 w-5 text-rose-500" /> },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">{s.icon}</div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Level Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-5 w-5" /> Level Progression
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['Beginner', 'Junior', 'Junior+', 'Middle', 'Middle+', 'Senior', 'Lead', 'Principal', 'Architect'].map((l, i) => (
              <div
                key={l}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  progressData.user?.level === l
                    ? 'bg-primary text-primary-foreground'
                    : i < ['Beginner', 'Junior', 'Junior+', 'Middle', 'Middle+', 'Senior', 'Lead', 'Principal', 'Architect'].indexOf(progressData.user?.level || 'Beginner')
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {l}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Category Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Category Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {progressData.categoryStats.map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{cat.name}</span>
                  <span className="text-muted-foreground">{cat.mastered}/{cat.total} mastered</span>
                </div>
                <Progress value={cat.total > 0 ? (cat.mastered / cat.total) * 100 : 0} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============ ADMIN VIEW ============
function AdminView() {
  const [syncState, setSyncState] = useState<{ repoUrl: string; lastCommitSha: string | null; lastSyncAt: string | null; status: string } | null>(null)
  const [recentLogs, setRecentLogs] = useState<{ id: string; type: string; status: string; details: string; itemsCount: number; createdAt: string }[]>([])
  const [syncing, setSyncing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<string>('')

  useEffect(() => {
    fetch('/api/admin/sync')
      .then(r => r.json())
      .then(data => { setSyncState(data.syncState); setRecentLogs(data.recentLogs || []) })
  }, [])

  const triggerSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/admin/sync', { method: 'POST' })
      const res = await fetch('/api/admin/sync')
      const data = await res.json()
      setSyncState(data.syncState)
      setRecentLogs(data.recentLogs || [])
    } catch { /* ignore */ }
    setSyncing(false)
  }

  const generateExplanations = async () => {
    setGenerating(true)
    setGenResult('')
    try {
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-explanations' }),
      })
      const data = await res.json()
      setGenResult(data.message || 'Done')
    } catch { setGenResult('Error generating explanations') }
    setGenerating(false)
  }

  return (
    <div className="max-w-5xl space-y-6">
      <h2 className="text-xl font-bold">Admin Panel</h2>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="sync">GitHub Sync</TabsTrigger>
          <TabsTrigger value="ai">AI Management</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content Overview</CardTitle>
              <CardDescription>Current state of the content database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{syncState ? '38' : '—'}</div>
                  <div className="text-xs text-muted-foreground">Total Questions</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">15</div>
                  <div className="text-xs text-muted-foreground">Categories</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">5</div>
                  <div className="text-xs text-muted-foreground">AI Explanations</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">1</div>
                  <div className="text-xs text-muted-foreground">Sync Sources</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> GitHub Sync Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {syncState && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Repository:</span></div>
                  <div className="font-mono text-xs">{syncState.repoUrl}</div>
                  <div><span className="text-muted-foreground">Status:</span></div>
                  <div><Badge variant={syncState.status === 'idle' ? 'secondary' : 'default'}>{syncState.status}</Badge></div>
                  <div><span className="text-muted-foreground">Last Sync:</span></div>
                  <div>{syncState.lastSyncAt ? new Date(syncState.lastSyncAt).toLocaleString() : 'Never'}</div>
                  <div><span className="text-muted-foreground">Last Commit:</span></div>
                  <div className="font-mono text-xs">{syncState.lastCommitSha || 'N/A'}</div>
                </div>
              )}
              <Button onClick={triggerSync} disabled={syncing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing...' : 'Trigger Sync'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" /> AI Content Enhancement
              </CardTitle>
              <CardDescription>Generate AI explanations and new questions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={generateExplanations} disabled={generating} className="gap-2">
                <Brain className={`h-4 w-4 ${generating ? 'animate-pulse' : ''}`} /> {generating ? 'Generating...' : 'Generate AI Explanations'}
              </Button>
              {genResult && <div className="text-sm bg-muted rounded-lg p-3">{genResult}</div>}

              <Separator />

              <div>
                <h4 className="font-medium text-sm mb-2">Question Generator</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Generate new questions using AI for each category. Minimum 100 questions per category target.
                </p>
                <Button variant="outline" disabled className="gap-2">
                  <Zap className="h-4 w-4" /> Generate Questions (Requires AI Service)
                </Button>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-sm mb-2">Knowledge Refresh Engine</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Check for outdated information and update content automatically. Runs every 7 days.
                </p>
                <Button variant="outline" disabled className="gap-2">
                  <TrendingUp className="h-4 w-4" /> Run Knowledge Refresh (Requires AI Service)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {recentLogs.length > 0 ? (
                <div className="space-y-2">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-sm">
                      <Badge variant={log.status === 'completed' ? 'secondary' : 'destructive'} className="text-xs">{log.status}</Badge>
                      <span className="font-medium">{log.type}</span>
                      <span className="text-muted-foreground flex-1">{log.details}</span>
                      <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No logs yet. Trigger a sync or generation to see activity.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
