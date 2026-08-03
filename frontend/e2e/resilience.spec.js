import { expect, test } from '@playwright/test'

const permanentLoader = 'Yükleniyor...'

async function expectBootstrapToFinish(page) {
  await expect(page.getByText(permanentLoader, { exact: true })).toBeHidden({ timeout: 20000 })
  await expect(page.locator('#root')).not.toBeEmpty()
}

for (const pathName of ['/tr/', '/tr/loop', '/tr/posts/deployment-smoke-test']) {
  test(`direct route and reload remain usable: ${pathName}`, async ({ page }) => {
    const response = await page.goto(pathName, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expectBootstrapToFinish(page)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectBootstrapToFinish(page)
  })
}

test('slow network does not leave the bootstrap loader permanently visible', async ({ page }) => {
  await page.route('**/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350))
    await route.continue()
  })

  await page.goto('/tr/', { waitUntil: 'domcontentloaded' })
  await expectBootstrapToFinish(page)
})

test('one failed application chunk shows recovery UI and succeeds after retry', async ({ page }) => {
  let abortedApplicationChunk = false

  await page.route('**/assets/*.js', async (route) => {
    const fileName = new URL(route.request().url()).pathname.split('/').pop() || ''
    if (!abortedApplicationChunk && /^App-/.test(fileName)) {
      abortedApplicationChunk = true
      await route.abort('failed')
      return
    }
    await route.continue()
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Uygulama yüklenemedi' })).toBeVisible()
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expectBootstrapToFinish(page)
})
