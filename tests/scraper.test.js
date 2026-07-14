import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchTotoData } from '../src/scraper.js'

const SAMPLE_HTML = `<html><body>
  <table>
    <tr><td>$2,000,000 est</td></tr>
    <tr><td>Thu, 17 Jul 2026 , 6.30pm</td></tr>
  </table>
</body></html>`

const EMPTY_HTML = '<html><body><p>No data</p></body></html>'

describe('fetchTotoData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses jackpot as integer and draw date as string', async () => {
    fetch.mockResolvedValue({ ok: true, text: async () => SAMPLE_HTML })
    const result = await fetchTotoData()
    expect(result.jackpot).toBe(2_000_000)
    expect(result.nextDrawDate).toBe('Thu, 17 Jul 2026 , 6.30pm')
  })

  it('throws on HTTP error', async () => {
    fetch.mockResolvedValue({ ok: false, status: 503 })
    await expect(fetchTotoData()).rejects.toThrow('HTTP 503')
  })

  it('throws when jackpot cannot be parsed', async () => {
    fetch.mockResolvedValue({ ok: true, text: async () => EMPTY_HTML })
    await expect(fetchTotoData()).rejects.toThrow('Could not parse jackpot amount')
  })

  it('throws when draw date cannot be parsed', async () => {
    const html = '<html><body>$1,000,000</body></html>'
    fetch.mockResolvedValue({ ok: true, text: async () => html })
    await expect(fetchTotoData()).rejects.toThrow('Could not parse draw date')
  })
})
