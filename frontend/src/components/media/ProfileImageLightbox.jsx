import { resolveMediaUrl } from '../../utils/media.js'

function ProfileImageLightbox({ open, imageUrl, title, onClose }) {
  const resolvedImageUrl = resolveMediaUrl(imageUrl)

  if (!open || !resolvedImageUrl) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        X
      </button>

      <div className="max-h-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
        <img
          src={resolvedImageUrl}
          alt={title}
          className="max-h-[88vh] max-w-full rounded-[28px] object-contain shadow-2xl"
        />
      </div>
    </div>
  )
}

export default ProfileImageLightbox