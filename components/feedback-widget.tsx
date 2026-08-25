'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type View = 'nav' | 'feedback'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ',
  editor: 'Редактор',
  author: 'Автор',
  reader: 'Читатель',
}

const roleBadgeStyles: Record<string, string> = {
  admin: 'text-[#d52525] border border-[#d52525]/30',
  editor: 'text-[#f6d6a8] border border-[#f6d6a8]/30',
  author: 'text-[#f6d6a8] border border-[#f6d6a8]/30',
  reader: 'text-[#f4efe5]/40 border border-[#f4efe5]/10',
}

export function FeedbackWidget() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<View>('nav')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const closePanel = useCallback(() => {
    setIsOpen(false)
    setTimeout(() => {
      setView('nav')
      setMessage('')
      setSubmitted(false)
      setError(null)
    }, 250)
  }, [])

  useEffect(() => {
    if (isOpen && view === 'feedback' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen, view])

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePanel()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, closePanel])

  if (status !== 'authenticated') return null

  const roles: string[] = session?.user?.roles ?? []
  const isAdmin = session?.user?.isAdmin === true
  const isAuthor = session?.user?.publicRole === 'author'
  const hasEditorRole = roles.includes('editor')
  const hasStudio = isAdmin || isAuthor || hasEditorRole
  const displayName = session?.user?.name ?? session?.user?.email ?? '—'
  const handle = session?.user?.handle
  const avatar = session?.user?.image

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0] ?? '')
    .join('')
    .toUpperCase()

  const primaryRole = isAdmin
    ? 'admin'
    : hasEditorRole
    ? 'editor'
    : isAuthor
    ? 'author'
    : 'reader'

  const navLinks = [
    { href: '/profile', label: 'Профиль', show: true },
    { href: '/studio', label: 'Студия', show: hasStudio },
    { href: '/admin', label: 'Управление', show: isAdmin },
  ].filter(l => l.show)

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), path: pathname }),
      })
      if (!res.ok) throw new Error('Ошибка отправки')
      setSubmitted(true)
      setMessage('')
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div ref={containerRef} className="fixed bottom-8 right-0 z-50 flex items-end" id="feedback-widget" data-name="feedback-widget">
      {/* Expandable panel */}
      <div
        className={[
          'w-72 bg-[#111210]',
          'border border-[#f4efe5]/10 border-l-2 border-l-[#d52525]',
          'shadow-2xl shadow-black/80',
          'overflow-hidden',
          'transition-all duration-200 ease-out origin-bottom-right',
          isOpen
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 translate-x-3 pointer-events-none',
        ].join(' ')}
      >
        {view === 'nav' ? (
          <>
            {/* User identity */}
            <div className="px-4 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-sm overflow-hidden flex-shrink-0 bg-[#1b1c19] flex items-center justify-center border border-[#f4efe5]/10">
                {avatar ? (
                  <Image
                    src={avatar}
                    alt={displayName}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-serif text-base text-[#f4efe5]/70 leading-none">
                    {initials}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-serif text-[#f4efe5] uppercase tracking-wider text-sm leading-none truncate">
                  {displayName}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {handle && (
                    <span className="font-mono text-[10px] text-[#f4efe5]/30 truncate">
                      @{handle}
                    </span>
                  )}
                  <span
                    className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 ${roleBadgeStyles[primaryRole] ?? roleBadgeStyles.reader}`}
                  >
                    {ROLE_LABELS[primaryRole] ?? primaryRole}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-[#f4efe5]/8 mx-4" />

            {/* Navigation */}
            <div className="px-4 pt-3 pb-1">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f4efe5]/30 mb-1">
                Навигация
              </div>
            </div>

            <div>
              {navLinks.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closePanel}
                  className="flex items-center justify-between px-4 py-2.5 text-[#f4efe5]/70 hover:text-[#f4efe5] hover:bg-[#f4efe5]/5 transition-all duration-150 group"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className="text-sm">{link.label}</span>
                  <span className="font-mono text-[#f4efe5]/25 group-hover:text-[#d52525] transition-colors text-xs">
                    →
                  </span>
                </Link>
              ))}
            </div>

            <div className="border-t border-dashed border-[#f4efe5]/8 mx-4 mt-1" />

            {/* Feedback entry */}
            <button
              onClick={() => setView('feedback')}
              className="w-full flex items-center justify-between px-4 py-3 text-[#f4efe5]/45 hover:text-[#f4efe5]/70 hover:bg-[#f4efe5]/5 transition-all duration-150 group"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
                Написать нам
              </span>
              <span className="font-mono text-[#f4efe5]/20 group-hover:text-[#d52525] transition-colors text-xs">
                ↗
              </span>
            </button>
          </>
        ) : (
          <>
            {/* Feedback header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-dashed border-[#f4efe5]/8">
              <button
                onClick={() => {
                  setView('nav')
                  setSubmitted(false)
                  setError(null)
                }}
                className="font-mono text-[10px] uppercase tracking-widest text-[#f4efe5]/40 hover:text-[#d52525] transition-colors"
              >
                ← Назад
              </button>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f4efe5]/30">
                Обратная связь
              </span>
            </div>

            {submitted ? (
              <div className="px-4 py-10 text-center">
                <div className="font-serif text-[#f6d6a8] text-xl mb-2">Получили</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-[#f4efe5]/30">
                  Спасибо за отзыв
                </div>
              </div>
            ) : (
              <>
                <div className="px-4 pt-3 pb-2">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={e => setMessage(e.target.value.slice(0, 1000))}
                    onKeyDown={handleKeyDown}
                    placeholder="Ваше сообщение..."
                    rows={5}
                    className="w-full bg-[#0d0e0b] border border-[#f4efe5]/8 text-[#f4efe5]/80 placeholder:text-[#f4efe5]/20 text-sm leading-relaxed px-3 py-2.5 resize-none outline-none focus:border-[#f4efe5]/20 transition-colors duration-150"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    {error ? (
                      <span className="font-mono text-[9px] text-[#d52525]">{error}</span>
                    ) : (
                      <span className="font-mono text-[9px] text-[#f4efe5]/20 uppercase tracking-widest">
                        ⌘+Enter
                      </span>
                    )}
                    <span className="font-mono text-[9px] text-[#f4efe5]/20">
                      {message.length} / 1000
                    </span>
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || submitting}
                    className="w-full h-10 bg-[#d52525] disabled:bg-[#d52525]/25 font-mono text-[10px] uppercase tracking-[0.25em] text-white disabled:text-white/40 transition-all duration-150 hover:bg-[#b81e1e] disabled:cursor-not-allowed"
                  >
                    {submitting ? '...' : '— Отправить —'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Bookmark trigger */}
      <button
        onClick={() => (isOpen ? closePanel() : setIsOpen(true))}
        className={[
          'h-16 w-9 flex-shrink-0',
          'bg-[#111210] border border-[#f4efe5]/10 border-l-2 border-l-[#d52525]',
          'flex flex-col items-center justify-center',
          'rounded-l-sm',
          'transition-all duration-200',
          isOpen ? 'bg-[#1b1c19]' : 'hover:bg-[#1b1c19]',
        ].join(' ')}
        aria-label="Меню пользователя"
      >
        {avatar ? (
          <div className="w-6 h-6 rounded-sm overflow-hidden">
            <Image
              src={avatar}
              alt={displayName}
              width={24}
              height={24}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <span className="font-serif text-[#f4efe5]/70 text-base leading-none select-none">
            {initials}
          </span>
        )}
      </button>
    </div>
  )
}
