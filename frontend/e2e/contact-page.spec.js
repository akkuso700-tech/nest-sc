import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'tiny-mobile (320x568)', width: 320, height: 568 },
  { name: 'iphone-se (375x667)', width: 375, height: 667 },
  { name: 'iphone-14 (390x844)', width: 390, height: 844 },
  { name: 'pixel-7 (412x915)', width: 412, height: 915 },
  { name: 'tablet (768x1024)', width: 768, height: 1024 },
  { name: 'desktop (1280x800)', width: 1280, height: 800 },
]

for (const vp of viewports) {
  test(`Contact page renders without horizontal overflow on ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    const response = await page.goto('/tr/contact', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)

    // Wait for hero to be rendered
    const heroSection = page.locator('#contact-hero')
    await expect(heroSection).toBeVisible({ timeout: 15000 })

    // Check main sections
    await expect(page.locator('#contact-channels')).toHaveCount(0)
    await expect(page.locator('#contact-form')).toBeVisible()
    await expect(page.locator('#contact-faq')).toBeVisible()

    // Assert NO horizontal overflow (scrollWidth should equal clientWidth)
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        hasOverflow: doc.scrollWidth > doc.clientWidth + 1,
      }
    })
    expect(overflow.hasOverflow).toBe(false)
  })
}

test('Contact form interactive validation and submission', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/tr/contact', { waitUntil: 'domcontentloaded' })

  // Check form inputs
  const nameInput = page.locator('#contact-name')
  const emailInput = page.locator('#contact-email')
  const messageInput = page.locator('#contact-message')
  const submitBtn = page.locator('#contact-form button[type="submit"]')

  await expect(nameInput).toBeVisible({ timeout: 15000 })

  // Fill in form
  await nameInput.fill('Test Kullanıcı')
  await emailInput.fill('test@example.com')
  await messageInput.fill('Merhaba, platform hakkında harika geri bildirimlerim var.')

  // Submit
  await submitBtn.click()

  // Verify success banner appears
  await expect(page.locator('#contact-form')).toContainText(/Mesajınız Başarıyla İletildi!/i, { timeout: 10000 })

  // Reset form
  const resetBtn = page.locator('#contact-form').getByRole('button', { name: /Yeni Bir Mesaj Gönder/i })
  await expect(resetBtn).toBeVisible()
  await resetBtn.click()

  // Form should be visible again
  await expect(page.locator('#contact-name')).toBeVisible()
})


test('Contact FAQ accordion operates smoothly with soft borders', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/tr/contact', { waitUntil: 'domcontentloaded' })

  const firstFaqButton = page.locator('#contact-faq button').first()
  await expect(firstFaqButton).toBeVisible({ timeout: 15000 })

  // Initially open:
  await expect(page.locator('#contact-faq')).toContainText(/Destek ekibimiz hafta içi gelen tüm talepleri inceler/i)

  // Click to close
  await firstFaqButton.click()
  await expect(page.locator('#contact-faq')).not.toContainText(/Destek ekibimiz hafta içi gelen tüm talepleri inceler/i)

  // Click to open again
  await firstFaqButton.click()
  await expect(page.locator('#contact-faq')).toContainText(/Destek ekibimiz hafta içi gelen tüm talepleri inceler/i)
})

test('Navbar hamburger button opens drawer on contact page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/tr/contact', { waitUntil: 'domcontentloaded' })

  const hamburgerBtn = page.locator('header button').first()
  await expect(hamburgerBtn).toBeVisible({ timeout: 15000 })
  await hamburgerBtn.click()

  const drawer = page.locator('.fixed.inset-0.z-\\[72\\]')
  await expect(drawer).toBeVisible()

  const closeBtn = drawer.locator('button').first()
  await closeBtn.click()
  await expect(drawer).toBeHidden()
})

test('Multi-language routes render properly on contact page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  for (const lang of ['en', 'de', 'es']) {
    const res = await page.goto(`/${lang}/contact`, { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBe(200)
    await expect(page.locator('#contact-hero')).toBeVisible({ timeout: 15000 })
  }
})

test('Capture mobile screenshots for light and dark modes on contact page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/tr/contact', { waitUntil: 'networkidle' })

  const artifactDir = 'C:/Users/oomnn/.gemini/antigravity/brain/f2bab9e7-1497-49e7-96c4-3be8082d1dce'
  await page.screenshot({ path: `${artifactDir}/contact_mobile_light.png`, fullPage: false })

  // Scroll to form
  await page.locator('#contact-form').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${artifactDir}/contact_mobile_form.png`, fullPage: false })

  // Scroll to FAQ
  await page.locator('#contact-faq').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${artifactDir}/contact_mobile_faq.png`, fullPage: false })

  // Toggle dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'
  })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${artifactDir}/contact_mobile_dark_faq.png`, fullPage: false })

  // Scroll back to hero in dark mode
  await page.locator('#contact-hero').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${artifactDir}/contact_mobile_dark_hero.png`, fullPage: false })
})
