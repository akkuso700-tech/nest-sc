import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Seo from '../components/seo/Seo.jsx'

function NotFoundPage() {
  const { lang = 'en' } = useParams()
  const { t } = useTranslation()

  return (
    <>
      <Seo
        title="My Social 1 · Not Found"
        description="Fallback route for unknown paths inside the selected language namespace."
      />

      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-lg rounded-[32px] border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
            404
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">
            {t('notFound.title')}
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-500">
            {t('notFound.description')}
          </p>
          <Link
            to={`/${lang}/`}
            className="mt-6 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white"
          >
            {t('notFound.action')}
          </Link>
        </div>
      </div>
    </>
  )
}

export default NotFoundPage
