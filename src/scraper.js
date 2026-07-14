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
