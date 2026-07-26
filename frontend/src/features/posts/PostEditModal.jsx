import { useRef } from 'react'
import UserAvatar from '../../components/common/UserAvatar.jsx'
import { resolveMediaUrl } from '../../utils/media.js'
import { PhotoIcon, VideoIcon } from './PostComposerIcons.jsx'

function PostEditModal({
  open,
  author,
  t,
  isSubmitting,
  draft,
  onDraftChange,
  mediaItems,
  onRemoveMediaItem,
  onSelectImages,
  onSelectVideo,
  onClose,
  onSave,
}) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/55 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-text shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              user={author}
              className="size-11 border border-card text-sm font-semibold"
              textClassName="text-sm font-semibold"
            />
            <div>
              <p className="text-sm font-semibold text-text">{t('postDetail.edit')}</p>
              <p className="text-sm text-muted">@{author?.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-muted transition hover:bg-secondary-hover hover:text-text disabled:opacity-60"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-4">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            className="h-44 w-full resize-none rounded-xl border border-border bg-secondary px-3 py-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
            placeholder="Bugun neler paylasmak istersin?"
          />
          {Array.isArray(mediaItems) && mediaItems.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Ekli Medya</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {mediaItems.map((item, index) => (
                  <div
                    key={`${item?.url || item?.hlsUrl || index}`}
                    className="relative overflow-hidden rounded-[24px] border border-border bg-secondary"
                  >
                    {item?.type === 'video' ? (
                      <video
                        src={resolveMediaUrl(item?.url || item?.hlsUrl || '')}
                        poster={resolveMediaUrl(item?.posterUrl || '') || undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className="aspect-[16/10] w-full bg-black object-contain"
                      />
                    ) : (
                      <img
                        src={resolveMediaUrl(item?.url || '')}
                        alt="Gonderi medyasi"
                        className="aspect-[16/10] w-full object-cover"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveMediaItem(index)}
                      className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/70 text-white"
                      aria-label="Medyayi kaldir"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                        <path d="m6 6 12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="shrink-0 border-t border-border bg-card px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onSelectImages}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={onSelectVideo}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isSubmitting}
                className="grid size-11 place-items-center rounded-full border border-border text-text transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Foto ekle"
              >
                <PhotoIcon />
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={isSubmitting}
                className="grid size-11 place-items-center rounded-full border border-border text-text transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Video ekle"
              >
                <VideoIcon />
              </button>
              <span className="text-xs text-soft">En fazla 4 gorsel veya 1 video</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-secondary disabled:opacity-60"
              >
                Vazgec
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSubmitting}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-inverse disabled:opacity-60"
              >
                {isSubmitting ? 'Kaydediliyor...' : 'Paylas'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PostEditModal
