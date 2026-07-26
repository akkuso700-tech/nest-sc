const { z } = require('zod')

const metricSchema = z.object({
  name: z.enum(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']),
  value: z.coerce.number().finite().min(0).max(120000),
})

const recordWebVitalsSchema = z.object({
  body: z.object({
    pageViewId: z.string().trim().min(8).max(80),
    route: z.string().trim().startsWith('/').max(180).optional().default('/'),
    navigationType: z
      .enum(['navigate', 'reload', 'back_forward', 'prerender', 'unknown'])
      .optional()
      .default('unknown'),
    deviceClass: z.enum(['mobile', 'tablet', 'desktop']).optional().default('desktop'),
    connectionType: z
      .enum(['slow-2g', '2g', '3g', '4g', 'unknown'])
      .optional()
      .default('unknown'),
    saveData: z.boolean().optional().default(false),
    metrics: z.array(metricSchema).min(1).max(5),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
})

const webVitalsSummarySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    days: z.coerce.number().int().min(1).max(30).optional().default(7),
    route: z.string().trim().startsWith('/').max(180).optional().default(''),
  }),
})

module.exports = {
  recordWebVitalsSchema,
  webVitalsSummarySchema,
}
