import * as cheerio from 'cheerio'

const DATA_URL = 'https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_next_draw_estimate_en.html'

export async function fetchTotoData() {
  const res = await fetch(DATA_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  const text = $('body').text()

  const allAmounts = [...text.matchAll(/\$([\d,]+)/g)]
    .map(m => parseInt(m[1].replace(/,/g, ''), 10))
    .filter(n => !isNaN(n))

  if (allAmounts.length === 0) throw new Error('Could not parse jackpot amount')

  const jackpot = Math.max(...allAmounts)

  const dateMatch = text.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d+\s+\w+\s+\d+(?:\s*,\s*[\d.]+[ap]m)?/)
  if (!dateMatch) throw new Error('Could not parse draw date')

  const nextDrawDate = dateMatch[0].trim()

  return { jackpot, nextDrawDate }
}
