import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'

function SimpleInfoPage({ pageKey, title, description }) {
  const { t } = useTranslation()
  const translatedTitle = t(`infoPages.${pageKey}.title`, {
    defaultValue: title || t(`pages.${pageKey}`),
  })
  const translatedEyebrow = t(`infoPages.${pageKey}.eyebrow`, {
    defaultValue: t(`pages.${pageKey}`),
  })
  const translatedParagraphs = t(`infoPages.${pageKey}.paragraphs`, {
    returnObjects: true,
    defaultValue: description ? [description] : [],
  })
  const paragraphs = Array.isArray(translatedParagraphs)
    ? translatedParagraphs
    : translatedParagraphs
      ? [translatedParagraphs]
      : []

  return (
    <>
      <Seo
        title={`My Social 1 · ${translatedTitle}`}
        description={paragraphs[0] || description}
      />

      <SocialLayout pageTitle={t(`pages.${pageKey}`)} activeKey={pageKey}>
        <section className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">
            {translatedEyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-text">
            {translatedTitle}
          </h1>
          <div className="mt-4 max-w-3xl space-y-4">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="text-sm leading-7 text-muted">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      </SocialLayout>
    </>
  )
}

export default SimpleInfoPage
