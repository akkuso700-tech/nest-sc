import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  message: string
  tone?: ToastTone
}

export interface UIState {
  // Toast notifications
  toast: ToastItem | null
  showToast: (message: string, tone?: ToastTone, durationMs?: number) => void
  hideToast: () => void

  // Global modals
  activeModal: string | null
  modalProps: Record<string, any>
  openModal: (modalId: string, props?: Record<string, any>) => void
  closeModal: () => void

  // Mobile navigation drawer
  isMobileNavOpen: boolean
  toggleMobileNav: (open?: boolean) => void

  // Media preview lightbox
  previewMedia: { url: string; type: 'image' | 'video' } | null
  openMediaPreview: (media: { url: string; type: 'image' | 'video' }) => void
  closeMediaPreview: () => void
}

let toastTimer: any = null

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  activeModal: null,
  modalProps: {},
  isMobileNavOpen: false,
  previewMedia: null,

  showToast: (message, tone = 'success', durationMs = 3000) => {
    if (toastTimer) {
      clearTimeout(toastTimer)
    }

    set({ toast: { message, tone } })

    if (durationMs > 0) {
      toastTimer = setTimeout(() => {
        set({ toast: null })
        toastTimer = null
      }, durationMs)
    }
  },

  hideToast: () => {
    if (toastTimer) {
      clearTimeout(toastTimer)
      toastTimer = null
    }
    set({ toast: null })
  },

  openModal: (modalId, props = {}) => {
    set({ activeModal: modalId, modalProps: props })
  },

  closeModal: () => {
    set({ activeModal: null, modalProps: {} })
  },

  toggleMobileNav: (open) => {
    set((state) => ({
      isMobileNavOpen: typeof open === 'boolean' ? open : !state.isMobileNavOpen,
    }))
  },

  openMediaPreview: (media) => {
    set({ previewMedia: media })
  },

  closeMediaPreview: () => {
    set({ previewMedia: null })
  },
}))
