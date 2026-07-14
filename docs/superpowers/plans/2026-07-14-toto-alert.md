# TOTO Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Node.js service that checks the Singapore Pools TOTO jackpot once daily and sends a Telegram alert if it exceeds $4,500,000.

**Architecture:** node-cron fires at 9am SGT (01:00 UTC) daily. The scraper fetches a static HTML file from Singapore Pools and extracts the jackpot amount and next draw date using regex. If the jackpot exceeds the threshold, the Telegram module POSTs a message to the user's chat via the Bot API.

**Tech Stack:** Node.js ESM, cheerio, node-cron, Telegram Bot API (direct HTTP), vitest, Railway

## Global Constraints

- `"type": "module"` in package.json — all files use ESM (`import`/`export`), `.js` extensions on local imports
- Data URL: `https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_next_draw_estimate_en.html`
- Jackpot threshold: `4_500_000` (hardcoded constant in `src/index.js`)
- Cron expression: `0 1 * * *` (01:00 UTC = 09:00 SGT)
- Telegram message format exactly: `TOTO jackpot is $5,000,000! Next draw: Thu, 17 Jul 2026 , 6.30pm`
- Env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- No database, no `.env` file committed

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `railway.toml`
- Create: `src/` (empty directory placeholder via `src/.gitkeep`)
- Create: `tests/` (empty directory placeholder via `tests/.gitkeep`)

**Interfaces:**
- Produces: runnable Node.js ESM project; `npm test` exits 0 with no test files yet

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "toto-alert",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
```

- [ ] **Step 3: Create `railway.toml`**

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` written.

- [ ] **Step 5: Create placeholder directories**

```bash
mkdir -p src tests
touch src/.gitkeep tests/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore railway.toml src/.gitkeep tests/.gitkeep
git commit -m "chore: project scaffold"
```

---

### Task 2: Scraper

**Files:**
- Create: `src/scraper.js`
- Create: `tests/scraper.test.js`

**Interfaces:**
- Produces: `fetchTotoData()` — async function, no parameters, returns `Promise<{ jackpot: number, nextDrawDate: string }>`
  - `jackpot` is an integer (e.g. `1000000`)
  - `nextDrawDate` is the raw date string from the page (e.g. `'Thu, 16 Jul 2026 , 6.30pm'`)
  - Throws `Error('HTTP <status>')` on non-2xx response
  - Throws `Error('Could not parse jackpot amount')` if no dollar amount found in body
  - Throws `Error('Could not parse draw date')` if no day-of-week date found in body

- [ ] **Step 1: Write the failing tests**

Create `tests/scraper.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: 4 tests fail with "Cannot find module '../src/scraper.js'"

- [ ] **Step 3: Implement `src/scraper.js`**

```js
import * as cheerio from 'cheerio'

const DATA_URL = 'https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_next_draw_estimate_en.html'

export async function fetchTotoData() {
  const res = await fetch(DATA_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  const text = $('body').text()

  const jackpotMatch = text.match(/\$([\d,]+)/)
  if (!jackpotMatch) throw new Error('Could not parse jackpot amount')

  const dateMatch = text.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d+\s+\w+\s+\d+(?:\s*,\s*[\d.]+[ap]m)?/)
  if (!dateMatch) throw new Error('Could not parse draw date')

  const jackpot = parseInt(jackpotMatch[1].replace(/,/g, ''), 10)
  const nextDrawDate = dateMatch[0].trim()

  return { jackpot, nextDrawDate }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/scraper.js tests/scraper.test.js
git commit -m "feat: scraper fetches and parses TOTO jackpot data"
```

---

### Task 3: Telegram Sender

**Files:**
- Create: `src/telegram.js`
- Create: `tests/telegram.test.js`

**Interfaces:**
- Consumes: `{ jackpot: number, nextDrawDate: string }` (from `fetchTotoData`)
- Produces: `sendTotoAlert(data)` — async function, returns `Promise<void>`
  - Reads `process.env.TELEGRAM_BOT_TOKEN` and `process.env.TELEGRAM_CHAT_ID`
  - POSTs to `https://api.telegram.org/bot<TOKEN>/sendMessage`
  - Message body: `TOTO jackpot is $5,000,000! Next draw: <nextDrawDate>`
    - Dollar amount formatted with commas using `Intl.NumberFormat('en-SG').format(jackpot)`
  - Throws `Error('Telegram API error: <status>')` on non-2xx response

- [ ] **Step 1: Write the failing tests**

Create `tests/telegram.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: 2 new tests fail with "Cannot find module '../src/telegram.js'"; scraper tests still pass

- [ ] **Step 3: Implement `src/telegram.js`**

```js
export async function sendTotoAlert({ jackpot, nextDrawDate }) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  const amount = '$' + new Intl.NumberFormat('en-SG').format(jackpot)
  const text = `TOTO jackpot is ${amount}! Next draw: ${nextDrawDate}`

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) throw new Error(`Telegram API error: ${res.status}`)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: 6 tests pass (4 scraper + 2 telegram)

- [ ] **Step 5: Commit**

```bash
git add src/telegram.js tests/telegram.test.js
git commit -m "feat: telegram sender posts jackpot alert"
```

---

### Task 4: Main Entry Point + Cron

**Files:**
- Create: `src/index.js`
- Delete: `src/.gitkeep`, `tests/.gitkeep`

**Interfaces:**
- Consumes: `fetchTotoData()` from `./scraper.js`, `sendTotoAlert()` from `./telegram.js`
- No new exports — this is the process entry point

No unit tests for this file (it's pure wiring + side effects). Manual verification: run `node src/index.js` and confirm it logs jackpot info.

- [ ] **Step 1: Create `src/index.js`**

```js
import cron from 'node-cron'
import { fetchTotoData } from './scraper.js'
import { sendTotoAlert } from './telegram.js'

const THRESHOLD = 4_500_000

async function check() {
  try {
    const data = await fetchTotoData()
    const { jackpot, nextDrawDate } = data
    console.log(`Jackpot: $${new Intl.NumberFormat('en-SG').format(jackpot)} — next draw: ${nextDrawDate}`)
    if (jackpot > THRESHOLD) {
      await sendTotoAlert(data)
      console.log('Alert sent!')
    } else {
      console.log(`Below threshold ($${new Intl.NumberFormat('en-SG').format(THRESHOLD)}), no alert.`)
    }
  } catch (err) {
    console.error('Check failed:', err.message)
  }
}

// 01:00 UTC = 09:00 SGT
cron.schedule('0 1 * * *', check)
console.log('TOTO alert running. Next check at 09:00 SGT.')

// Also run immediately on startup
check()
```

- [ ] **Step 2: Remove placeholder files**

```bash
rm src/.gitkeep tests/.gitkeep
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: 6 tests pass

- [ ] **Step 4: Manually verify the script runs**

You need `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set. If you don't have them yet, run without env vars — it will check the jackpot and log the result, then fail with `Telegram API error` (which is expected):

```bash
node src/index.js
```

Expected output (example):
```
TOTO alert running. Next check at 09:00 SGT.
Jackpot: $1,000,000 — next draw: Thu, 16 Jul 2026 , 6.30pm
Below threshold ($4,500,000), no alert.
```

If the jackpot is above threshold and env vars aren't set, it will log `Check failed: Telegram API error: 404` — that's fine.

- [ ] **Step 5: Commit**

```bash
git add src/index.js
git rm src/.gitkeep tests/.gitkeep
git commit -m "feat: cron scheduler checks jackpot daily at 09:00 SGT"
```

---

## Deployment

After all tasks are complete:

1. **Set up Telegram bot** (if not done):
   - Message @BotFather on Telegram → `/newbot` → get `BOT_TOKEN`
   - Message @userinfobot on Telegram to get your `CHAT_ID`

2. **Push to GitHub and connect to Railway**

3. **Set Railway env vars** on the service:
   - `TELEGRAM_BOT_TOKEN=<your token>`
   - `TELEGRAM_CHAT_ID=<your chat id>`

4. Railway auto-deploys on push. The service starts, runs an immediate check, then waits for 09:00 SGT daily.
