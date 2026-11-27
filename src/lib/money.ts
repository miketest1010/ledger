/** 整數新台幣，千分位。負數用減號，不帶小數。 */
export function formatTwd(amount: number): string {
  const negative = amount < 0
  const whole = Math.abs(Math.round(amount))
  const body = whole.toLocaleString('zh-Hant-TW')
  return negative ? `−${body}` : body
}

export function formatTwdYuan(amount: number): string {
  return `${formatTwd(amount)} 元`
}

/** 圖表軸用的簡寫，例如 48.9萬。 */
export function compactTwd(amount: number): string {
  const negative = amount < 0
  const abs = Math.abs(Math.round(amount))
  const sign = negative ? '−' : ''
  if (abs >= 10_000) {
    const wan = abs / 10_000
    const text = wan >= 100 ? String(Math.round(wan)) : String(Math.round(wan * 10) / 10)
    return `${sign}${text}萬`
  }
  return sign + abs.toLocaleString('zh-Hant-TW')
}

/** 空白是還沒決定；0 是確定的 0%。最多兩位小數。 */
export function parsePercent(input: string): number | null | 'invalid' {
  const trimmed = input.trim()
  if (trimmed === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'invalid'
  const value = Number(trimmed)
  if (value > 100) return 'invalid'
  return value
}

export function formatPercent(value: number | null): string {
  if (value === null) return ''
  return String(value)
}

/** 持股金額取整數元。percent 為 null 時不計算。 */
export function shareAmount(total: number, percent: number | null): number | null {
  if (percent === null) return null
  const basisPoints = Math.round(percent * 100)
  return Math.round((total * basisPoints) / 10_000)
}

export function parseTwdInput(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '').replace(/\s/g, '')
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (!Number.isSafeInteger(value)) return null
  return value
}
