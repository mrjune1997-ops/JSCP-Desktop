import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { TextDecoder } from 'node:util'
import type { RateEntry, RateSnapshot, RatesResponse } from '../shared/types'

/**
 * 中国银行外汇牌价。
 * 第 1 页：/sourcedb/whpj/index.html
 * 第 N 页：/sourcedb/whpj/index_N.html
 */
const BOC_BASE = process.env['CLUO_BOC_URL'] || 'https://www.boc.cn/sourcedb/whpj/'

/** 中行中文币种名 → ISO 代码 */
const NAME_TO_CODE: Record<string, string> = {
  阿联酋迪拉姆: 'AED', 澳大利亚元: 'AUD', 文莱元: 'BND', 巴西雷亚尔: 'BRL',
  加拿大元: 'CAD', 瑞士法郎: 'CHF', 捷克克朗: 'CZK', 丹麦克朗: 'DKK',
  欧元: 'EUR', 英镑: 'GBP', 港币: 'HKD', 匈牙利福林: 'HUF',
  印尼卢比: 'IDR', 以色列谢克尔: 'ILS', 印度卢比: 'INR', 日元: 'JPY',
  柬埔寨瑞尔: 'KHR', 韩国元: 'KRW', 科威特第纳尔: 'KWD', 哈萨克斯坦坚戈: 'KZT',
  蒙古图格里克: 'MNT', 澳门元: 'MOP', 毛里求斯卢比: 'MUR', 墨西哥比索: 'MXN',
  林吉特: 'MYR', 挪威克朗: 'NOK', 尼泊尔卢比: 'NPR', 新西兰元: 'NZD',
  菲律宾比索: 'PHP', 巴基斯坦卢比: 'PKR', 波兰兹罗提: 'PLN', 卡塔尔里亚尔: 'QAR',
  罗马尼亚列伊: 'RON', 塞尔维亚第纳尔: 'RSD', 卢布: 'RUB', 沙特里亚尔: 'SAR',
  瑞典克朗: 'SEK', 新加坡元: 'SGD', 泰国铢: 'THB', 土耳其里拉: 'TRY',
  新台币: 'TWD', 美元: 'USD', 越南盾: 'VND', 南非兰特: 'ZAR', 赞比亚克瓦查: 'ZMW'
}

const CACHE_TTL_MS = 10 * 60 * 1000
const MAX_PAGES = 20
const REQ_TIMEOUT = 15000
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export interface CrawlProgress {
  page: number
  totalPages: number
  found: number
}

function cachePath(): string {
  return join(app.getPath('userData'), 'rates-cache.json')
}

interface CacheFile {
  snapshot: RateSnapshot
  fetchedAt: number
}

async function readCache(): Promise<CacheFile | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(), 'utf-8')) as CacheFile
    if (!parsed?.snapshot?.entries?.length) return null
    return parsed
  } catch {
    return null
  }
}

async function writeCache(snapshot: RateSnapshot): Promise<void> {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
    await writeFile(cachePath(), JSON.stringify({ snapshot, fetchedAt: Date.now() }), 'utf-8')
  } catch {
    /* 缓存写失败不阻断 */
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

/** 解析总页数 */
export function parsePageCount(html: string): number {
  const m = html.match(/共\s*<span>\s*(\d+)\s*<\/span>\s*页/)
  const n = m ? Number(m[1]) : 1
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PAGES) : 1
}

/**
 * 解析单页牌价。
 * 表头：货币名称 | 现汇买入价 | 现钞买入价 | 现汇卖出价 | 现钞卖出价 | 中行折算价 | 发布日期 | 发布时间
 * 中行按「每 100 单位外币」报价 → 统一除以 100 转成「1 外币 = X 人民币」。
 * 现汇买入价为空/非数字 → price 置空，界面提示「该币种无现汇买入价」。
 */
export function parseBocHtml(html: string): RateEntry[] {
  const tableMatch = html.match(/<table[^>]*id="priceTable"[\s\S]*?<\/table>/i)
  const scope = tableMatch ? tableMatch[0] : html
  const rowRe = /<tr[^>]*data-currency=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/tr>/gi
  const out: RateEntry[] = []
  let m: RegExpExecArray | null

  while ((m = rowRe.exec(scope)) !== null) {
    const cnName = m[1].trim()
    const code = NAME_TO_CODE[cnName]
    if (!code) continue
    const cells = Array.from(m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi), (c) => stripTags(c[1]))
    const rawBuy = cells[1] ?? ''
    const publishTime = cells[6] || cells[7] || undefined

    if (!/^\d+(\.\d+)?$/.test(rawBuy) || Number(rawBuy) <= 0) {
      out.push({ code, name: cnName, price: '', rawPrice: rawBuy, publishTime })
      continue
    }
    // 100 外币 → 1 外币，定点字符串处理避免浮点误差
    const perUnit = (Number(rawBuy) / 100).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
    out.push({ code, name: cnName, price: perUnit, rawPrice: rawBuy, publishTime })
  }
  return out
}

function localNowStamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function pageUrl(index: number): string {
  const base = BOC_BASE.endsWith('/') ? BOC_BASE : `${BOC_BASE}/`
  return index <= 1 ? `${base}index.html` : `${base}index_${index}.html`
}

async function getHtml(url: string, attempt = 0): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    let html = buf.toString('utf-8')
    if (!html.includes('货币名称')) {
      try {
        html = new TextDecoder('gb18030').decode(buf)
      } catch {
        /* 保持 utf-8 */
      }
    }
    if (!html.includes('货币名称') && !html.includes('priceTable')) throw new Error('BAD_PAYLOAD')
    return html
  } catch (err) {
    // 网络类错误重试一次（5xx / 超时 / 中断），4xx 不重试
    const msg = err instanceof Error ? err.message : ''
    const retryable = !/^HTTP 4/.test(msg) && attempt < 1
    if (retryable) {
      await new Promise((r) => setTimeout(r, 600))
      return getHtml(url, attempt + 1)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** 逐页抓取全部币种，按代码去重合并 */
async function crawlAll(onProgress?: (p: CrawlProgress) => void): Promise<RateSnapshot> {
  const merged = new Map<string, RateEntry>()
  let totalPages = 1
  let publishTime: string | undefined

  for (let page = 1; page <= totalPages; page++) {
    const html = await getHtml(pageUrl(page))
    if (page === 1) totalPages = parsePageCount(html)

    const pageEntries = parseBocHtml(html)
    if (pageEntries.length === 0 && page > 1) break

    for (const e of pageEntries) {
      const prev = merged.get(e.code)
      // 同币种多页出现时，优先保留有现汇买入价的记录
      if (!prev || (!prev.price && e.price)) merged.set(e.code, e)
      if (!publishTime && e.publishTime) publishTime = e.publishTime
    }

    onProgress?.({ page, totalPages, found: merged.size })

    // 已抓完实际页数（服务端可能一次性返回全部币种）则提前结束
    if (page >= 1 && pageEntries.length > 0 && merged.size >= Object.keys(NAME_TO_CODE).length) break
  }

  const entries = Array.from(merged.values()).sort((a, b) => a.code.localeCompare(b.code))
  if (entries.length === 0) throw new Error('EMPTY_RESULT')

  return {
    entries,
    updatedAt: localNowStamp(),
    source: '中国银行外汇牌价',
    publishTime
  }
}

/**
 * @param force true 真实抓取；false 只读缓存
 */
export async function fetchRates(
  force: boolean,
  onProgress?: (p: CrawlProgress) => void
): Promise<RatesResponse> {
  const cache = await readCache()

  if (!force) {
    if (!cache) return { ok: false, snapshot: null, message: '尚未获取牌价，请点击一键更新' }
    const stale = Date.now() - cache.fetchedAt > CACHE_TTL_MS
    return {
      ok: true,
      snapshot: cache.snapshot,
      cached: true,
      message: stale ? '当前为本地缓存数据' : undefined
    }
  }

  try {
    const snapshot = await crawlAll(onProgress)
    await writeCache(snapshot)
    return { ok: true, snapshot }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    if (cache) {
      return {
        ok: false,
        snapshot: cache.snapshot,
        cached: true,
        message: isTimeout
          ? '牌价请求超时，当前为缓存数据'
          : `牌价更新失败，当前为 ${cache.snapshot.updatedAt} 的缓存数据`
      }
    }
    return {
      ok: false,
      snapshot: null,
      message: isTimeout ? '牌价请求超时，请检查网络后重试' : '牌价更新失败，请检查网络后重试'
    }
  }
}
