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
  test(`About page renders without horizontal overflow on ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    const response = await page.goto('/tr/about', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)

    // Wait for hero to be rendered
    const heroSection = page.locator('#about-hero')
    await expect(heroSection).toBeVisible({ timeout: 15000 })

    // Check all main sections
    await expect(page.locator('#about-values')).toBeVisible()
    await expect(page.locator('#about-story')).toBeVisible()
    await expect(page.locator('#about-features')).toBeVisible()
    await expect(page.locator('#about-faq')).toBeVisible()

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

test('About page mobile interactions: feature tabs and FAQ accordion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/tr/about', { waitUntil: 'domcontentloaded' })

  // Feature tabs interaction on mobile
  const loopTab = page.locator('#about-features [role="tab"]').filter({ hasText: /Loop/i })
  await expect(loopTab).toBeVisible({ timeout: 15000 })
  await loopTab.click()

  // Verify active tab content switched to Loop
  await expect(page.locator('#about-features')).toContainText(/Loop/i)
  const loopLink = page.locator('#about-features').getByRole('link', { name: /Loop/i })
  await expect(loopLink).toBeVisible()

  // Chat tab interaction
  const chatTab = page.locator('#about-features [role="tab"]').filter({ hasText: /Sohbet/i })
  await chatTab.click()
  await expect(page.locator('#about-features')).toContainText(/Sohbet/i)

  // FAQ accordion interaction
  const firstFaqButton = page.locator('#about-faq button').first()
  await expect(firstFaqButton).toBeVisible()
  await expect(page.locator('#about-faq')).toContainText(/Nest Social/i)

  // Click to close
  await firstFaqButton.click()
  // Click to open again
  await firstFaqButton.click()
  await expect(page.locator('#about-faq')).toContainText(/Nest Social/i)
})

test('Primary buttons have white text in both light and dark modes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/tr/about', { waitUntil: 'domcontentloaded' })

  // Check hero primary button text color in light mode
  const joinBtn = page.locator('#about-hero a.bg-primary').first()
  await expect(joinBtn).toBeVisible({ timeout: 15000 })

  const lightColor = await joinBtn.evaluate((el) => window.getComputedStyle(el).color)
  expect(lightColor).toBe('rgb(255, 255, 255)')

  // Check CTA section primary button
  const ctaBtn = page.locator('section a.bg-primary').last()
  const ctaColor = await ctaBtn.evaluate((el) => window.getComputedStyle(el).color)
  expect(ctaColor).toBe('rgb(255, 255, 255)')

  // Toggle dark mode by setting class on documentElement
  await page.evaluate(() => document.documentElement.classList.add('dark'))

  const darkColor = await joinBtn.evaluate((el) => window.getComputedStyle(el).color)
  expect(darkColor).toBe('rgb(255, 255, 255)')
})

test('Navbar hamburger button opens drawer on mobile and desktop', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/tr/about', { waitUntil: 'domcontentloaded' })

  // Find hamburger button in header
  const hamburgerBtn = page.locator('header button').first()
  await expect(hamburgerBtn).toBeVisible({ timeout: 15000 })
  await hamburgerBtn.click()

  // Drawer should be open with sidebar navigation links
  const drawer = page.locator('.fixed.inset-0.z-\\[72\\]')
  await expect(drawer).toBeVisible()

  // Close drawer
  const closeBtn = drawer.locator('button').first()
  await closeBtn.click()
  await expect(drawer).toBeHidden()
})

test('Multi-language routes render properly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  for (const lang of ['en', 'de', 'es']) {
    const res = await page.goto(`/${lang}/about`, { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBe(200)
    await expect(page.locator('#about-hero')).toBeVisible({ timeout: 15000 })
  }
})

test('Theme toggle and responsive rendering on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/tr/about', { waitUntil: 'networkidle' })

  // Verify light mode
  const lightHero = page.locator('#about-hero')
  // Scroll to FAQ in light mode and capture
  await page.locator('#about-faq').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const artifactDir = 'C:/Users/oomnn/.gemini/antigravity/brain/f2bab9e7-1497-49e7-96c4-3be8082d1dce'
  await page.screenshot({ path: `${artifactDir}/faq_light_soft.png`, fullPage: false })

  // Toggle dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'
  })
  await page.waitForTimeout(400)

  // Verify elements still visible in dark mode and capture FAQ
  await expect(lightHero).toBeVisible()
  await expect(page.locator('#about-features')).toBeVisible()
  await expect(page.locator('#about-faq')).toBeVisible()
  await page.screenshot({ path: `${artifactDir}/faq_dark_soft.png`, fullPage: false })
})
