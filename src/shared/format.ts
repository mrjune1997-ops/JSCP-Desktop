import Decimal from 'decimal.js'

// 十进制内核：足够精度，禁用原生浮点误差
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -9, toExpPos: 12 })

export { Decimal }

/** 千分位分组（仅展示层） */
export function groupThousands(intPart: string): string {
  const neg = intPart.startsWith('-')
  const digits = neg ? intPart.slice(1) : intPart
  const out = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return neg ? `-${out}` : out
}

export interface FormatOptions {
  /** 固定小数位；undefined 表示去尾零 */
  decimals?: number
  /** 是否加千分位，默认 true */
  grouping?: boolean
  /** 12 位有效数字 + 科学计数法阈值 */
  significant?: boolean
}

const MAX_EXP = 12
const MIN_EXP = -9

/**
 * 统一数字展示：
 * - 默认 12 位有效数字，去尾零
 * - 绝对值 >= 1e12 或 < 1e-9 自动科学计数法
 * - 支持固定小数位 + 千分位
 */
export function formatNumber(value: Decimal | string | number, opts: FormatOptions = {}): string {
  const { decimals, grouping = true, significant = true } = opts
  let d: Decimal
  try {
    d = value instanceof Decimal ? value : new Decimal(value)
  } catch {
    return '—'
  }
  if (!d.isFinite()) return d.isNaN() ? 'NaN' : d.isNegative() ? '-∞' : '∞'
  if (d.isZero()) return decimals !== undefined ? (0).toFixed(decimals) : '0'

  const abs = d.abs()

  if (decimals === undefined && significant && (abs.gte(new Decimal(10).pow(MAX_EXP)) || abs.lt(new Decimal(10).pow(MIN_EXP)))) {
    const s = d.toSignificantDigits(12).toExponential()
    return s.replace(/e([+-])(\d)$/, 'e$10$2')
  }

  let s: string
  if (decimals !== undefined) {
    s = d.toFixed(decimals, Decimal.ROUND_HALF_UP)
  } else {
    s = d.toSignificantDigits(significant ? 12 : 20).toString()
    if (s.includes('e')) {
      // 极小/极大值在未指定小数位时也走科学计数法
      return s.replace(/e([+-])(\d)$/, 'e$10$2')
    }
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  }
  if (!grouping) return s
  const [ip, fp] = s.split('.')
  return fp !== undefined ? `${groupThousands(ip)}.${fp}` : groupThousands(ip)
}

/** 解析用户输入，失败返回 null */
export function parseDecimal(input: string): Decimal | null {
  const cleaned = input.replace(/,/g, '').replace(/\s/g, '').trim()
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  try {
    const d = new Decimal(cleaned)
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

/** 百分比输入 13 → 0.13；支持已带 % 的字符串 */
export function percentToRate(input: string | Decimal): Decimal | null {
  const d = input instanceof Decimal ? input : parseDecimal(input)
  if (!d) return null
  return d.div(100)
}

export function formatPercent(value: Decimal, decimals = 2): string {
  return `${formatNumber(value, { decimals, grouping: false })}%`
}

export function nowStamp(ts = Date.now()): string {
  const d = new Date(ts)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
