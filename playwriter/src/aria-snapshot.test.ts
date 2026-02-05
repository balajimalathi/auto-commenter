import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Page } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { getAriaSnapshot } from './aria-snapshot.js'
import { getCdpUrl } from './utils.js'
import { getCDPSessionForPage } from './cdp-session.js'
import { setupTestContext, cleanupTestContext, getExtensionServiceWorker, type TestContext } from './test-utils.js'

const TEST_PORT = 19986
const SNAPSHOTS_DIR = path.join(import.meta.dirname, 'aria-snapshots')
const AX_DEBUG_DIR = path.join(import.meta.dirname, '__snapshots__', 'ax-debug')
const SHOULD_DUMP_AX = process.env.PLAYWRITER_DUMP_AX === '1'

describe('aria-snapshot', () => {
  let ctx: TestContext
  let page: Page

  beforeAll(async () => {
    ctx = await setupTestContext({ port: TEST_PORT, tempDirPrefix: 'aria-snapshot-test-', toggleExtension: true })
    page = await ctx.browserContext.newPage()
    const serviceWorker = await getExtensionServiceWorker(ctx.browserContext)
    await page.goto('about:blank')
    await serviceWorker.evaluate(async () => {
      await (globalThis as any).toggleExtensionForActiveTab()
    })
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })
    }
    if (SHOULD_DUMP_AX && !fs.existsSync(AX_DEBUG_DIR)) {
      fs.mkdirSync(AX_DEBUG_DIR, { recursive: true })
    }
  }, 60000)

  afterAll(async () => {
    await cleanupTestContext(ctx)
  })

  const sites = [
    { name: 'hackernews', url: 'https://news.ycombinator.com' },
    { name: 'github', url: 'https://github.com' },
  ]

  for (const site of sites) {
    it(`${site.name} - snapshot`, async () => {
      await page.goto(site.url, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1000)

      if (SHOULD_DUMP_AX) {
        const cdp = await getCDPSessionForPage({ page, wsUrl: getCdpUrl({ port: TEST_PORT }) })
        try {
          await cdp.send('DOM.enable')
          await cdp.send('Accessibility.enable')
          const axTree = await cdp.send('Accessibility.getFullAXTree')
          const domTree = await cdp.send('DOM.getFlattenedDocument', { depth: -1, pierce: true })
          fs.writeFileSync(path.join(AX_DEBUG_DIR, `${site.name}-ax-tree.json`), JSON.stringify(axTree, null, 2))
          fs.writeFileSync(path.join(AX_DEBUG_DIR, `${site.name}-dom-flat.json`), JSON.stringify(domTree, null, 2))
        } finally {
          await cdp.detach()
        }
      }

      const { snapshot } = await getAriaSnapshot({ page, wsUrl: getCdpUrl({ port: TEST_PORT }) })
      expect(snapshot.length).toBeGreaterThan(0)
      // Check for locator format: attribute selector or role selector
      expect(snapshot).toMatch(/(?:\[id="|\[data-[\w-]+="|role=)/)
      const wrapperLines = snapshot.split('\n').filter((line) => {
        const trimmed = line.trim()
        return /^-\s+(generic|group|none|presentation)\s*:?$/.test(trimmed)
      })
      expect(wrapperLines).toEqual([])
      fs.writeFileSync(path.join(SNAPSHOTS_DIR, `${site.name}-raw.txt`), snapshot)
      console.log(`\n📊 ${site.name.toUpperCase()} snapshot size: ${snapshot.length} bytes`)

      const { snapshot: interactiveSnapshot } = await getAriaSnapshot({
        page,
        wsUrl: getCdpUrl({ port: TEST_PORT }),
        interactiveOnly: true,
      })
      expect(interactiveSnapshot).not.toMatch(/^-\s+heading\b/m)
      // Check for locator format: attribute selector or role selector
      expect(interactiveSnapshot).toMatch(/(?:\[id="|\[data-[\w-]+="|role=)/)
      fs.writeFileSync(path.join(SNAPSHOTS_DIR, `${site.name}-interactive.txt`), interactiveSnapshot)
    }, 30000)
  }
})
