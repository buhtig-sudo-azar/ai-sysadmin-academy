'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

/**
 * MarkdownContent — переиспользуемый компонент для красивого рендеринга
 * текстового контента (ответов, AI-объяснений, сообщений чата).
 *
 * Возможности:
 *  - Заголовки (#, ##, ###) → крупные блоки с акцентной полосой слева
 *  - Параграфы → с отступами между блоками для визуального разделения
 *  - Списки (маркированные и нумерованные) → с цветными буллетами
 *  - Блоки кода (```...```) → моноширинный шрифт, тёмный фон, скруглённые углы,
 *    кнопка копирования, горизонтальная прокрутка для длинных строк
 *  - Инлайн-код (`code`) → подсвечен фоном и моноширинным шрифтом
 *  - Цитаты (>) → выделены цветной полосой слева
 *  - Жирный/курсив → стандартные стили
 *  - Таблицы (GFM) → со строками-зеброй
 *  - Ссылки → открываются в новой вкладке
 *
 * Поддерживает три варианта размера: 'sm' (для чата), 'md' (для карточек),
 * 'lg' (для основного контента).
 */

type MarkdownSize = 'sm' | 'md' | 'lg'

interface MarkdownContentProps {
  children: string
  className?: string
  size?: MarkdownSize
}

const SIZE_STYLES: Record<MarkdownSize, {
  base: string
  h1: string
  h2: string
  h3: string
  h4: string
  p: string
  ul: string
  ol: string
  li: string
  code: string
  pre: string
  preCode: string
  blockquote: string
  table: string
  a: string
  hr: string
}> = {
  sm: {
    base: 'text-xs leading-relaxed',
    h1: 'text-sm font-bold mt-2 mb-1',
    h2: 'text-sm font-semibold mt-2 mb-1',
    h3: 'text-xs font-semibold mt-1.5 mb-1',
    h4: 'text-xs font-medium mt-1.5 mb-0.5',
    p: 'my-1.5',
    ul: 'my-1.5 space-y-0.5 pl-4 list-none',
    ol: 'my-1.5 space-y-0.5 pl-4 list-none',
    li: 'text-xs leading-relaxed pl-1',
    code: 'px-1 py-0.5 rounded bg-muted text-[10px] font-mono text-foreground',
    pre: 'my-2 p-2 rounded-md bg-zinc-900 dark:bg-zinc-950 border border-zinc-800 overflow-x-auto text-[10px]',
    preCode: 'font-mono text-zinc-100 bg-transparent p-0 text-[10px] leading-relaxed',
    blockquote: 'my-1.5 pl-2 border-l-2 border-primary/40 italic text-muted-foreground',
    table: 'my-2 text-[10px]',
    a: 'text-primary underline underline-offset-2',
    hr: 'my-2 border-border',
  },
  md: {
    base: 'text-sm leading-relaxed',
    h1: 'text-lg font-bold mt-3 mb-2',
    h2: 'text-base font-semibold mt-3 mb-2',
    h3: 'text-sm font-semibold mt-2 mb-1',
    h4: 'text-sm font-medium mt-2 mb-1',
    p: 'my-2',
    ul: 'my-2 space-y-1 pl-5 list-none',
    ol: 'my-2 space-y-1 pl-5 list-none',
    li: 'text-sm leading-relaxed',
    code: 'px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-foreground',
    pre: 'my-3 p-3 rounded-lg bg-zinc-900 dark:bg-zinc-950 border border-zinc-800 overflow-x-auto text-xs',
    preCode: 'font-mono text-zinc-100 bg-transparent p-0 text-xs leading-relaxed',
    blockquote: 'my-2 pl-3 border-l-2 border-primary/40 italic text-muted-foreground',
    table: 'my-2 text-xs',
    a: 'text-primary underline underline-offset-2',
    hr: 'my-3 border-border',
  },
  lg: {
    base: 'text-base leading-relaxed',
    h1: 'text-xl font-bold mt-4 mb-2',
    h2: 'text-lg font-semibold mt-4 mb-2',
    h3: 'text-base font-semibold mt-3 mb-1.5',
    h4: 'text-base font-medium mt-3 mb-1',
    p: 'my-3',
    ul: 'my-3 space-y-1.5 pl-6 list-none',
    ol: 'my-3 space-y-1.5 pl-6 list-none',
    li: 'text-base leading-relaxed',
    code: 'px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-foreground',
    pre: 'my-4 p-4 rounded-lg bg-zinc-900 dark:bg-zinc-950 border border-zinc-800 overflow-x-auto text-sm',
    preCode: 'font-mono text-zinc-100 bg-transparent p-0 text-sm leading-relaxed',
    blockquote: 'my-3 pl-4 border-l-2 border-primary/40 italic text-muted-foreground',
    table: 'my-3 text-sm',
    a: 'text-primary underline underline-offset-2',
    hr: 'my-4 border-border',
  },
}

/** Кнопка копирования для блока кода. */
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false)
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard может быть недоступен (например, без HTTPS) — просто игнорируем
    }
  }
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      aria-label="Скопировать код"
    >
      {copied ? 'Скопировано' : 'Копировать'}
    </button>
  )
}

export function MarkdownContent({ children, className, size = 'md' }: MarkdownContentProps) {
  const s = SIZE_STYLES[size]

  return (
    <div className={cn(s.base, 'markdown-content', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Заголовки — крупные блоки с акцентной полосой слева
          h1: ({ children }) => (
            <h1 className={cn(s.h1, 'border-l-4 border-primary pl-2 flex items-center')}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className={cn(s.h2, 'border-l-4 border-primary/70 pl-2 flex items-center')}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn(s.h3, 'border-l-2 border-primary/50 pl-2 flex items-center')}>{children}</h3>
          ),
          h4: ({ children }) => <h4 className={s.h4}>{children}</h4>,
          // Параграфы — между ними достаточно воздуха
          p: ({ children }) => <p className={s.p}>{children}</p>,
          // Маркированные списки — убираем дефолтные маркеры, рендерим свои.
          ul: ({ children }) => (
            <ul className={cn(s.ul, 'list-none')}>{children}</ul>
          ),
          // Нумерованные списки — аналогично, со своими бейджами.
          ol: ({ children }) => (
            <ol className={cn(s.ol, 'list-none')}>{children}</ol>
          ),
          // Элемент списка — с цветным буллетом слева через ::before.
          li: ({ children }) => (
            <li className={cn(s.li, 'flex items-start gap-2 before:content-[""] before:shrink-0 before:mt-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-primary/70')}>
              <span className="flex-1 min-w-0 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">{children}</span>
            </li>
          ),
          // Блоки кода — с кнопкой копирования и горизонтальной прокруткой.
          // В react-markdown v9+ `inline` больше не передаётся, поэтому определяем
          // тип по наличию родительского <pre> (блочный код всегда внутри pre).
          pre: ({ children }) => {
            const codeText = extractText(children)
            return (
              <div className="relative group">
                <pre className={s.pre}>
                  {children}
                </pre>
                {codeText && <CopyButton code={codeText} />}
              </div>
            )
          },
          // Код внутри pre — моноширинный, без фона (фон уже на pre).
          // Инлайн-код определяется по отсутствию родительского pre:
          // react-markdown рендерит инлайн-код без pre-обёртки.
          code: ({ className: codeClassName, children }) => {
            // Если есть класс language-xxx или текст содержит перевод строки —
            // это блочный код (внутри pre). Иначе — инлайн.
            const isBlock = !!codeClassName?.startsWith('language-') ||
              (typeof children === 'string' && children.includes('\n'))
            if (isBlock) {
              return <code className={s.preCode}>{children}</code>
            }
            return <code className={cn(s.code, codeClassName)}>{children}</code>
          },
          // Цитаты — с цветной полосой слева
          blockquote: ({ children }) => (
            <blockquote className={s.blockquote}>{children}</blockquote>
          ),
          // Таблицы — со строками-зеброй
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className={cn(s.table, 'w-full border-collapse')}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1 align-top">{children}</td>
          ),
          tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
          // Ссылки — открываются в новой вкладке
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className={s.a}>
              {children}
            </a>
          ),
          // Жирный/курсив
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          // Горизонтальная линия — разделитель между блоками
          hr: () => <hr className={s.hr} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

/** Рекурсивно извлекает текст из children — для кнопки копирования. */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(extractText).join('')
  if (React.isValidElement(children)) {
    return extractText((children.props as { children?: React.ReactNode }).children)
  }
  return ''
}

export default MarkdownContent
