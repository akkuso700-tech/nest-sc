import { Helmet } from 'react-helmet-async'
import { useLocation, useParams } from 'react-router-dom'
import { fallbackLanguage, supportedLanguages } from '../../routes/constants.js'

function getSiteUrl() {
  if (import.meta.env.VITE_SITE_URL) {
    return import.meta.env.VITE_SITE_URL.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'https://example.com'
}

function buildDefaultStructuredData({ siteUrl }) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Nest Social',
      ...(siteUrl ? { url: siteUrl } : {}),
      logo: siteUrl ? `${siteUrl}/favicon.svg` : '/favicon.svg',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Nest Social',
      ...(siteUrl ? { url: `${siteUrl}/` } : {}),
      potentialAction: {
        '@type': 'SearchAction',
        target: siteUrl
          ? `${siteUrl}/{lang}/search?q={search_term_string}`
          : '/{lang}/search?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ]
}

function buildLocalizedPath(pathname, lang) {
  const segments = pathname.split('/').filter(Boolean)
  const [, ...rest] = segments
  const suffix = rest.length ? `/${rest.join('/')}` : '/'

  return `/${lang}${suffix}`
}

function Seo({ title, description, structuredData = null, robots = '' }) {
  const location = useLocation()
  const { lang = fallbackLanguage } = useParams()
  const siteUrl = getSiteUrl()
  const canonicalUrl = `${siteUrl}${location.pathname}`
  const defaultStructuredDataPayload = buildDefaultStructuredData({ siteUrl })
  const structuredDataPayload = Array.isArray(structuredData)
    ? structuredData
    : structuredData
      ? [structuredData]
      : []
  const mergedStructuredDataPayload = [...defaultStructuredDataPayload, ...structuredDataPayload]

  return (
    <Helmet prioritizeSeoTags>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      {robots ? <meta name="robots" content={robots} /> : null}
      <link rel="canonical" href={canonicalUrl} />

      {supportedLanguages.map((item) => (
        <link
          key={item}
          rel="alternate"
          hrefLang={item}
          href={`${siteUrl}${buildLocalizedPath(location.pathname, item)}`}
        />
      ))}

      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${siteUrl}${buildLocalizedPath(location.pathname, fallbackLanguage)}`}
      />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="My Social 1" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {mergedStructuredDataPayload.map((item, index) => (
        <script key={`structured-data-${index}`} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  )
}

export default Seo
