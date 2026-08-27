import { Component } from 'react'
import { reportClientError } from '../../lib/clientErrorReporter.js'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    reportClientError(error, {
      kind: 'render',
      source: info?.componentStack || '',
    })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 px-5 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <section
          className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-7 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900"
          role="alert"
        >
          <h1 className="text-xl font-semibold">Sayfa yüklenemedi</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Bağlantı kesilmiş veya uygulama dosyalarından biri güncellenmiş olabilir.
            Sayfayı yenileyerek tekrar deneyin.
          </p>
          <button
            type="button"
            className="mt-6 rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white dark:bg-white dark:text-zinc-950"
            onClick={() => window.location.reload()}
          >
            Tekrar dene
          </button>
        </section>
      </main>
    )
  }
}
