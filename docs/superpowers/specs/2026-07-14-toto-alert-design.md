# TOTO Alert — Design Spec

**Date:** 2026-07-14  
**Status:** Approved

## Overview

A Node.js service deployed to Railway that checks the Singapore Pools TOTO jackpot once daily. If the next jackpot exceeds $4,500,000, it sends a Telegram message to the user with the jackpot amount and next draw date.

Target URL: https://www.singaporepools.com.sg/en/product/pages/toto_results.aspx

## Architecture

A single Node.js process on Railway. node-cron fires once daily at 9am SGT. The scraper fetches the Singapore Pools page and parses it with cheerio. If the jackpot exceeds the threshold, the Telegram module sends a message via the Bot API.

```
[node-cron — 9am SGT daily]
      │
[scraper.js] — fetch + cheerio → { jackpot, nextDrawDate }
      │ if jackpot > $4,500,000
[telegram.js] — POST to Telegram Bot API
```

No database — purely stateless. Each daily run is independent.

## Tech Stack

- **Runtime:** Node.js (ESM)
- **HTTP fetch:** Node.js built-in `fetch`
- **HTML parsing:** cheerio
- **Scheduler:** node-cron
- **Telegram:** Telegram Bot API (direct HTTP, no library)
- **Hosting:** Railway

## Project Structure

```
toto-alert/
  src/
    scraper.js    # fetch Singapore Pools page, parse jackpot + next draw date
    telegram.js   # send message via Telegram Bot API
    index.js      # cron schedule + wires scraper → telegram
  package.json
  railway.toml
```

## Scraper

Fetches `https://www.singaporepools.com.sg/en/product/pages/toto_results.aspx` using the built-in `fetch`. Parses the HTML with cheerio to extract:

- **Next jackpot amount** — displayed as e.g. `$5,000,000` on the page
- **Next draw date** — displayed as e.g. `Monday, 21 Jul 2026`

Returns `{ jackpot: 5000000, nextDrawDate: 'Monday, 21 Jul 2026' }`.

## Telegram

Sends a message to the configured chat using `POST https://api.telegram.org/bot<TOKEN>/sendMessage`.

Message format:
> TOTO jackpot is $5,000,000! Next draw: Monday, 21 Jul 2026

## Threshold

`$4,500,000` — hardcoded constant in `index.js`. If `jackpot > 4500000`, send the message.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | User's personal Telegram chat ID |

Both set as Railway environment variables. No `.env` file committed.

## Schedule

node-cron expression: `0 1 * * *` — runs at 01:00 UTC, which is 09:00 SGT (UTC+8).

Also runs once on startup so the first check happens immediately after deploy.

## Error Handling

- If the fetch fails (network error, page structure changed): log the error, skip — retries the next day
- If cheerio cannot find the expected elements: log a warning, skip
- If the Telegram API call fails: log the error, skip
- No retries within a single run — the daily cadence is the retry mechanism

## Deployment

- **Platform:** Railway
- **Start command:** `npm start` (runs `node src/index.js`)
- **Build command:** none (pure JS, no build step)
- **`railway.toml`** configures start command
