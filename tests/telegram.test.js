import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendTotoAlert } from '../src/telegram.js'

describe('sendTotoAlert', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID = '99999'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_CHAT_ID
  })

  it('sends correct message to Telegram API', async () => {
    fetch.mockResolvedValue({ ok: true })
    await sendTotoAlert({ jackpot: 5_000_000, nextDrawDate: 'Thu, 17 Jul 2026 , 6.30pm' })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '99999',
          text: 'TOTO jackpot is $5,000,000! Next draw: Thu, 17 Jul 2026 , 6.30pm',
        }),
      }
    )
  })

  it('throws on Telegram API error', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401 })
    await expect(
      sendTotoAlert({ jackpot: 5_000_000, nextDrawDate: 'Thu, 17 Jul 2026 , 6.30pm' })
    ).rejects.toThrow('Telegram API error: 401')
  })
})
