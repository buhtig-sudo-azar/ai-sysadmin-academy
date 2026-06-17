import { create } from 'zustand'

export type AppView = 'dashboard' | 'categories' | 'questions' | 'search' | 'learning' | 'interview' | 'mentor' | 'progress' | 'admin'

interface AppState {
  currentView: AppView
  selectedCategory: string | null
  selectedQuestion: string | null
  searchQuery: string
  difficultyFilter: string
  sidebarOpen: boolean
  darkMode: boolean

  setView: (view: AppView) => void
  setSelectedCategory: (id: string | null) => void
  setSelectedQuestion: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setDifficultyFilter: (d: string) => void
  toggleSidebar: () => void
  toggleDarkMode: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedCategory: null,
  selectedQuestion: null,
  searchQuery: '',
  difficultyFilter: 'all',
  sidebarOpen: true,
  darkMode: false,

  setView: (view) => set({ currentView: view, selectedQuestion: null }),
  setSelectedCategory: (id) => set({ selectedCategory: id }),
  setSelectedQuestion: (id) => set({ selectedQuestion: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setDifficultyFilter: (d) => set({ difficultyFilter: d }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDarkMode: () => set((s) => {
    const newMode = !s.darkMode
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', newMode)
    }
    return { darkMode: newMode }
  }),
}))

// Система уровней
export const LEVELS = [
  { name: 'Новичок', minXP: 0, icon: '🌱' },
  { name: 'Младший', minXP: 500, icon: '🌿' },
  { name: 'Младший+', minXP: 1200, icon: '🌳' },
  { name: 'Средний', minXP: 2000, icon: '⚙️' },
  { name: 'Средний+', minXP: 3500, icon: '🔧' },
  { name: 'Старший', minXP: 5000, icon: '🏗️' },
  { name: 'Ведущий', minXP: 7500, icon: '🚀' },
  { name: 'Главный', minXP: 10000, icon: '⭐' },
  { name: 'Архитектор', minXP: 15000, icon: '👑' },
]

export function getLevelForXP(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i]
  }
  return LEVELS[0]
}

export function getNextLevel(xp: number) {
  const currentIdx = LEVELS.findIndex((l) => l.minXP > xp)
  return currentIdx >= 0 ? LEVELS[currentIdx] : null
}

export function getProgressToNextLevel(xp: number) {
  const current = getLevelForXP(xp)
  const next = getNextLevel(xp)
  if (!next) return 100
  return Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100)
}

// Иконки категорий
export const CATEGORY_ICONS: Record<string, string> = {
  'Terminal': '💻',
  'Network': '🌐',
  'Code': '📜',
  'Shield': '🔒',
  'Container': '📦',
  'Blocks': '⎈',
  'Layers': '🏗️',
  'Play': '⚡',
  'Cloud': '☁️',
  'CloudRain': '🌧️',
  'CloudSun': '⛅',
  'GitBranch': '🔄',
  'Activity': '📊',
  'Database': '🗄️',
  'Globe': '🌍',
  'Settings': '⚙️',
  'HardDrive': '💾',
  'Server': '🖥️',
  'Zap': '⚡',
  'Lock': '🔐',
}

// Цвета уровней сложности
export const DIFFICULTY_LABELS: Record<string, string> = {
  'beginner': 'Начальный',
  'intermediate': 'Средний',
  'advanced': 'Продвинутый',
}

export const DIFFICULTY_COLORS: Record<string, string> = {
  'beginner': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'intermediate': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'advanced': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
}
