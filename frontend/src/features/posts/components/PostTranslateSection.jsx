import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import HashtagText from '../../../components/common/HashtagText.jsx'
import { detectLanguage } from '../../../utils/languageDetector.js'

const LABELS = {
  seeTranslation: {
    tr: 'Çevirisine Bak',
    en: 'See translation',
    de: 'Übersetzung anzeigen',
    es: 'Ver traducción',
  },
  translating: {
    tr: 'Çevriliyor...',
    en: 'Translating...',
    de: 'Wird übersetzt...',
    es: 'Traduciendo...',
  },
  aiHeader: {
    tr: 'Nest AI Çevirisi',
    en: 'Translated with Nest AI',
    de: 'Übersetzt mit Nest AI',
    es: 'Traducido con Nest AI',
  },
  showOriginal: {
    tr: 'Orijinali göster',
    en: 'Show original',
    de: 'Original anzeigen',
    es: 'Ver original',
  },
  failed: {
    tr: 'Çeviri yapılamadı.',
    en: 'Translation failed.',
    de: 'Übersetzung fehlgeschlagen.',
    es: 'Error de traducción.',
  },
}

export default function PostTranslateSection({
  text,
  onTopicClick,
  onMentionClick,
}) {
  const { t, i18n } = useTranslation()
  const currentLang = (i18n.language || 'tr').split('-')[0].toLowerCase()

  const [translatedText, setTranslatedText] = useState('')
  const [isTranslated, setIsTranslated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Detect dominant language of the post text
  const detectedLang = useMemo(() => detectLanguage(text), [text])

  // Don't show translation button if:
  // 1. Text is invalid/empty
  // 2. Language cannot be determined (too short, emojis only, etc.)
  // 3. Post is already in the same language as the user's active UI
  if (!text || typeof text !== 'string' || !text.trim() || !detectedLang || detectedLang === currentLang) {
    return null
  }

  const seeTranslationText = t('post.seeTranslation', {
    defaultValue: LABELS.seeTranslation[currentLang] || LABELS.seeTranslation.en,
  })
  const translatingText = t('post.translating', {
    defaultValue: LABELS.translating[currentLang] || LABELS.translating.en,
  })
  const aiHeaderText = t('post.aiHeader', {
    defaultValue: LABELS.aiHeader[currentLang] || LABELS.aiHeader.en,
  })
  const showOriginalText = t('post.showOriginal', {
    defaultValue: LABELS.showOriginal[currentLang] || LABELS.showOriginal.en,
  })
  const failedText = t('post.translationFailed', {
    defaultValue: LABELS.failed[currentLang] || LABELS.failed.en,
  })

  const handleTranslate = async () => {
    if (translatedText) {
      // Toggle back to showing translation from cache
      setIsTranslated(true)
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const { translatePostContent } = await import('../../../services/aiService.ts')
      const res = await translatePostContent({
        text,
        targetLanguage: currentLang,
      })

      if (res && res.translatedText) {
        setTranslatedText(res.translatedText)
        setIsTranslated(true)
      }
    } catch (err) {
      console.error('[AI Translate Error]:', err)
      setError(failedText)
      setTimeout(() => setError(''), 4000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleShowOriginal = () => {
    setIsTranslated(false)
  }

  return (
    <div className="mt-1 text-xs">
      {!isTranslated ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTranslate}
            disabled={isLoading}
            className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={isLoading ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}>
              🌐
            </span>
            <span>{isLoading ? translatingText : seeTranslationText}</span>
          </button>
          {error && <span className="text-red-500 text-[11px]">{error}</span>}
        </div>
      ) : (
        <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-primary/10">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <span>✨</span>
              <span>{aiHeaderText}</span>
            </span>
            <button
              type="button"
              onClick={handleShowOriginal}
              className="text-[11px] text-muted hover:text-text hover:underline cursor-pointer transition-colors"
            >
              {showOriginalText}
            </button>
          </div>
          <p className="w-full text-left text-[14px] leading-relaxed font-normal text-text whitespace-pre-line break-words">
            <HashtagText
              text={translatedText}
              onHashtagClick={onTopicClick}
              onMentionClick={onMentionClick}
            />
          </p>
        </div>
      )}
    </div>
  )
}
