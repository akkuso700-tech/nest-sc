import { useState, useRef, useEffect } from 'react'
import { magicComposeText } from '../../../services/aiService.ts'

export default function PostComposerAiMenu({
  draft,
  onApplyResult,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeAction, setActiveAction] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const actions = [
    {
      id: 'enhance',
      icon: '✨',
      label: 'Daha İlgi Çekici / Viral Yap',
      description: 'Metni akıcı, vurucu ve yüksek etkileşimli hale getirir',
    },
    {
      id: 'hashtags',
      icon: '🏷️',
      label: 'Hashtag / Etiket Öner',
      description: 'Konuya en uygun 3-4 popüler etiketi metne ekler',
    },
    {
      id: 'fix',
      icon: '✍️',
      label: 'İmla ve Yazımı Düzelt',
      description: 'Dilbilgisi, yazım ve noktalama hatalarını onarır',
    },
    {
      id: 'poll',
      icon: '📊',
      label: 'Ankete Dönüştür',
      description: 'Metinden ilgi çekici soru ve seçenekler üretir',
    },
  ]

  const handleSelectAction = async (actionId) => {
    const trimmed = (draft || '').trim()
    if (!trimmed) {
      setErrorMsg('Lütfen önce bir taslak metin yazın.')
      setTimeout(() => setErrorMsg(''), 3000)
      return
    }

    try {
      setIsLoading(true)
      setActiveAction(actionId)
      setErrorMsg('')

      const res = await magicComposeText({
        text: trimmed,
        action: actionId,
      })

      if (res && res.result) {
        if (actionId === 'hashtags') {
          // Append hashtags cleanly
          const newText = `${trimmed}\n\n${res.result}`.trim()
          onApplyResult(newText)
        } else {
          onApplyResult(res.result)
        }
        setIsOpen(false)
      }
    } catch (err) {
      console.error('[AI MagicCompose Error]:', err)
      setErrorMsg(err.message || 'Bir hata oluştu.')
      setTimeout(() => setErrorMsg(''), 4000)
    } finally {
      setIsLoading(false)
      setActiveAction(null)
    }
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled || isLoading}
        className={`group relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-gradient-to-r from-violet-500/20 via-primary/20 to-sky-500/20 text-primary border border-primary/40 shadow-sm'
            : 'border border-border/80 bg-secondary/70 text-text hover:border-primary/50 hover:bg-secondary active:scale-95'
        } disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label="Nest AI Sihirbazı"
        title="Yapay zeka ile gönderini zenginleştir"
      >
        <span className={`text-sm ${isLoading ? 'animate-spin' : 'animate-pulse'}`}>
          {isLoading ? '⏳' : '✨'}
        </span>
        <span className="bg-gradient-to-r from-violet-500 via-primary to-sky-500 bg-clip-text font-semibold text-transparent">
          AI Sihirbazı
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full z-50 mb-2 w-72 origin-bottom-left rounded-2xl border border-border/80 bg-card p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 sm:w-80">
          <div className="mb-2 flex items-center justify-between border-b border-border/60 px-2 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
              <span className="text-sm">✨</span>
              <span>Nest AI Gönderi Sihirbazı</span>
            </div>
            {isLoading && (
              <span className="text-[11px] text-primary font-medium animate-pulse">
                Üretiliyor...
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="mb-2 rounded-xl bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-500 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1">
            {actions.map((act) => {
              const isCurrent = activeAction === act.id
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => handleSelectAction(act.id)}
                  disabled={isLoading}
                  className="w-full text-left rounded-xl p-2 transition-all duration-150 hover:bg-secondary group flex items-start gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="text-base flex-shrink-0 mt-0.5">{act.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text group-hover:text-primary transition-colors">
                        {act.label}
                      </span>
                      {isCurrent && (
                        <span className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted leading-tight mt-0.5 line-clamp-1">
                      {act.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-2 border-t border-border/50 px-2 pt-1.5 text-[10px] text-soft flex items-center justify-between">
            <span>⚡ Hızlı & akıllı içerik desteği</span>
            <span className="text-primary font-medium">Nest AI</span>
          </div>
        </div>
      )}
    </div>
  )
}
