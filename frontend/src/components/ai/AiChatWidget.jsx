import { useEffect, useRef, useState } from 'react'
import { SparklesIcon } from '../../layouts/SocialLayoutIcons.jsx'
import { streamAiChat } from '../../services/aiService.ts'

const STORAGE_KEY = 'nest_ai_chat_messages'

const SUGGESTIONS = [
  'Nest Social nedir ve neler yapabilirim?',
  'Bana dikkat çekici bir post fikri öner',
  'Loop videosu nasıl paylaşabilirim?',
  'Etkileşimimi artırmak için 3 ipucu ver',
]

const INITIAL_MESSAGE = {
  id: 'welcome-msg',
  role: 'assistant',
  content:
    'Merhaba! Ben **Nest Social Yapay Zeka Asistanıyım**. ✨\n\nPlatform özellikleri, post fikirleri veya merak ettiğiniz herhangi bir konuda size yardımcı olmak için buradayım. Nasıl yardımcı olabilirim?',
  timestamp: Date.now(),
}

function renderFormattedMessage(text) {
  if (!text) return null

  // Split lines
  const lines = text.split('\n')

  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-300">
      {lines.map((line, idx) => {
        const trimmed = line.trim()

        if (!trimmed) {
          return <div key={idx} className="h-1" />
        }

        // Bullet point
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const bulletContent = trimmed.slice(2)
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-primary mt-1 text-xs select-none">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(bulletContent) }} />
            </div>
          )
        }

        // Numbered list
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-primary font-semibold text-xs select-none">{numberedMatch[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(numberedMatch[2]) }} />
            </div>
          )
        }

        // Regular line with inline formatting
        return (
          <p
            key={idx}
            dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
          />
        )
      })}
    </div>
  )
}

function formatInline(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-slate-600 dark:text-slate-300">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-xs font-mono text-slate-800 dark:text-slate-200">$1</code>')
}

export default function AiChatWidget({ isOpen, onToggle, onClose }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      // Ignore sessionStorage parsing error
    }
    return [INITIAL_MESSAGE]
  })

  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorNotice, setErrorNotice] = useState(null)

  const hasUserStartedChat = messages.some((m) => m.role === 'user')

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Save messages to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // Ignore quota errors
    }
  }, [messages])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, isGenerating])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  function handleClearChat() {
    if (isGenerating) {
      handleStop()
    }
    const fresh = [
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          'Sohbet temizlendi! Size nasıl yardımcı olabilirim? ✨',
        timestamp: Date.now(),
      },
    ]
    setMessages(fresh)
    setErrorNotice(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsGenerating(false)
  }

  async function handleSend(textToSend) {
    const text = (textToSend || input).trim()
    if (!text || isGenerating) return

    setInput('')
    setErrorNotice(null)

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const assistantPlaceholderId = `assistant-${Date.now()}`
    const assistantMessage = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }

    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, assistantMessage])
    setIsGenerating(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      await streamAiChat({
        messages: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantPlaceholderId
                ? { ...msg, content: msg.content + delta }
                : msg,
            ),
          )
        },
        onError: (err) => {
          setErrorNotice(err.message || 'Yanıt alınırken hata oluştu.')
        },
        onDone: () => {
          setIsGenerating(false)
          abortControllerRef.current = null
        },
        signal: abortController.signal,
      })
    } catch (err) {
      if (!abortController.signal.aborted) {
        setErrorNotice(err.message || 'Bağlantı hatası oluştu.')
        setIsGenerating(false)
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Desktop Floating Action Button (when closed) */}
      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-[110] hidden md:flex items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-4 py-3 text-white shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group"
          aria-label="Yapay Zeka Asistanını Aç"
        >
          <span className="relative flex size-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-60"></span>
            <SparklesIcon className="size-5 text-white" />
          </span>
          <span className="text-sm font-semibold tracking-tight">AI Asistan</span>
        </button>
      )}

      {/* Chat Window: Full-Screen on Mobile, Floating Card on Desktop */}
      {isOpen && (
        <div
          className={`
            fixed z-[150] flex flex-col bg-card border-border shadow-2xl transition-all duration-200
            inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[410px] md:h-[600px] md:max-h-[calc(100vh-5rem)] md:rounded-2xl md:border md:backdrop-blur-xl md:shadow-[0_24px_64px_rgba(15,23,42,0.28)]
          `}
        >
          {/* Header (48px height on mobile) */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/90 px-3 md:h-14 md:px-4 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Mobile back arrow */}
              <button
                type="button"
                onClick={onClose}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-secondary hover:text-text md:hidden cursor-pointer transition"
                aria-label="Geri"
              >
                <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Avatar */}
              <div className="relative flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-xs">
                <SparklesIcon className="size-4" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-card bg-emerald-500" />
              </div>

              <div className="min-w-0">
                <h3 className="text-[13px] font-bold leading-tight text-text truncate">Nest AI Asistan</h3>
                <p className="text-[10px] leading-tight text-muted truncate">
                  {isGenerating ? 'Yazıyor...' : 'Çevrim içi • Akıllı Yardımcı'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {hasUserStartedChat && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="grid size-8 place-items-center rounded-lg text-muted hover:bg-secondary hover:text-text cursor-pointer transition"
                  title="Sohbeti Temizle"
                  aria-label="Sohbeti Temizle"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="hidden md:grid size-8 place-items-center rounded-lg text-muted hover:bg-secondary hover:text-text cursor-pointer transition"
                title="Kapat"
                aria-label="Kapat"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isUser && (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-xs mt-0.5">
                      <SparklesIcon className="size-3.5" />
                    </div>
                  )}

                  <div
                    className={`
                      max-w-[84%] rounded-2xl px-3.5 py-2.5 shadow-xs
                      ${
                        isUser
                          ? 'bg-primary text-inverse rounded-tr-none'
                          : 'bg-card/90 dark:bg-slate-900/60 rounded-tl-none border border-slate-200/80 dark:border-slate-800/80'
                      }
                    `}
                  >
                    {isUser ? (
                      <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    ) : (
                      <div>
                        {msg.content ? (
                          renderFormattedMessage(msg.content)
                        ) : isGenerating ? (
                          <div className="flex items-center gap-1 py-1">
                            <span className="size-2 rounded-full bg-purple-500 animate-bounce" />
                            <span className="size-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.2s]" />
                            <span className="size-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.4s]" />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Suggestions Chips (shown when few messages) */}
            {messages.length <= 1 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-muted px-1">Önerilen Konular:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(suggestion)}
                      className="rounded-xl border border-border bg-card/80 px-3 py-1.5 text-xs text-text hover:bg-secondary hover:border-primary/40 text-left transition active:scale-98 cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errorNotice && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                {errorNotice}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className="border-t border-border bg-card/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Bir soru sorun veya konu yazın..."
                className="flex-1 rounded-xl border border-border bg-secondary/80 px-3.5 py-2.5 text-sm text-text placeholder:text-muted outline-none transition hover:border-border-strong focus:border-border-strong focus:bg-card shadow-xs"
                disabled={isGenerating}
              />

              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="grid size-10 place-items-center rounded-xl bg-secondary text-text hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                  title="Durdur"
                >
                  <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="grid size-10 place-items-center rounded-xl bg-primary text-inverse transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-primary/20"
                  aria-label="Gönder"
                >
                  <svg className="size-4.5 -rotate-45 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}
