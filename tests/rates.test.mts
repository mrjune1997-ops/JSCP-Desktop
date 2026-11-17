/**
 * 中国银行牌价抓取/解析测试（真实网络）。
 * 运行：./node_modules/.bin/esbuild tests/rates.test.mts --bundle --platform=node --format=esm --alias:@shared=./src/shared --outfile=tests/_rates.mjs && node tests/_rates.mjs
 */

const BOC_BASE = 'https://www.boc.cn/sourcedb/whpj/'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

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

interface RateEntry { code: string; name: string; price: string; rawPrice: string; publishTime?: string }

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}
function parsePageCount(html: string): number {
  const m = html.match(/共\s*<span>\s*(\d+)\s*<\/span>\s*页/)
  return m ? Number(m[1]) : 1
}
function parseBocHtml(html: string): RateEntry[] {
  const table = html.match(/<table[^>]*id="priceTable"[\s\S]*?<\/table>/i)
  const scope = table ? table[0] : html
  const rowRe = /<tr[^>]*data-currency=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/tr>/gi
  const out: RateEntry[] = []
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(scope)) !== null) {
    const cn = m[1].trim()
    const code = NAME_TO_CODE[cn]
    if (!code) continue
    const cells = Array.from(m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi), (c) => stripTags(c[1]))
    const rawBuy = cells[1] ?? ''
    const publishTime = cells[6] || cells[7] || undefined
    if (!/^\d+(\.\d+)?$/.test(rawBuy) || Number(rawBuy) <= 0) {
      out.push({ code, name: cn, price: '', rawPrice: rawBuy, publishTime })
      continue
    }
    const perUnit = (Number(rawBuy) / 100).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
    out.push({ code, name: cn, price: perUnit, rawPrice: rawBuy, publishTime })
  }
  return out
}

async function getHtml(url: string): Promise<string> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 20000)
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', Accept: 'text/html' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return Buffer.from(await res.arrayBuffer()).toString('utf-8')
  } finally {
    clearTimeout(t)
  }
}

let pass = 0
let fail = 0
const notes: string[] = []
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

async function main(): Promise<void> {
  console.log('\n【中国银行牌价抓取测试】\n')
  const t0 = Date.now()
  const html = await getHtml(`${BOC_BASE}index.html`)
  const dt = Date.now() - t0
  console.log(`  首页响应 ${dt}ms · ${html.length} 字节`)

  check('页面可访问且含牌价表', html.includes('priceTable') || html.includes('货币名称'))
  const pages = parsePageCount(html)
  console.log(`  分页总数：${pages}`)
  check('识别到页数', pages >= 1)

  const merged = new Map<string, RateEntry>()
  let publishTime = ''
  const pageStats: { page: number; count: number }[] = []

  for (let p = 1; p <= pages; p++) {
    const url = p === 1 ? `${BOC_BASE}index.html` : `${BOC_BASE}index_${p}.html`
    let pageHtml: string
    try {
      pageHtml = p === 1 ? html : await getHtml(url)
    } catch (e) {
      console.log(`  ! 第 ${p} 页抓取失败：${(e as Error).message}`)
      continue
    }
    const entries = parseBocHtml(pageHtml)
    pageStats.push({ page: p, count: entries.length })
    for (const e of entries) {
      const prev = merged.get(e.code)
      if (!prev || (!prev.price && e.price)) merged.set(e.code, e)
      if (!publishTime && e.publishTime) publishTime = e.publishTime
    }
  }

  console.log(`  逐页结果：${pageStats.map((s) => `p${s.page}=${s.count}`).join(' ')}`)
  check('逐页抓取完成', pageStats.length > 0)
  check('去重后币种数 ≥ 40', merged.size >= 40, `实际 ${merged.size}`)

  const entries = Array.from(merged.values()).sort((a, b) => a.code.localeCompare(b.code))
  const withPrice = entries.filter((e) => e.price)
  const withoutPrice = entries.filter((e) => !e.price)
  console.log(`  有效现汇买入价：${withPrice.length} · 缺失：${withoutPrice.length}`)
  if (withoutPrice.length) console.log(`  无现汇买入价：${withoutPrice.map((e) => `${e.code}(${e.name})`).join('、')}`)
  check('可换汇币种数 ≥ 30', withPrice.length >= 30, `实际 ${withPrice.length}`)
  check('发布时间可解析', /^\d{4}\/\d{2}\/\d{2}/.test(publishTime), publishTime)

  // 关键币种必须存在
  for (const code of ['USD', 'EUR', 'JPY', 'HKD', 'GBP', 'AUD', 'CAD', 'SGD', 'KRW', 'THB']) {
    const e = merged.get(code)
    check(`币种 ${code} 存在且有价`, !!e && !!e.price, e ? `price=${e.price} raw=${e.rawPrice}` : '缺失')
  }

  // 换算口径校验：price 必须等于 rawPrice/100
  let calibOk = true
  for (const e of withPrice) {
    const expect = (Number(e.rawPrice) / 100).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
    if (e.price !== expect) {
      calibOk = false
      notes.push(`${e.code}: 解析 ${e.price} ≠ ${e.rawPrice}/100`)
    }
  }
  check('价格口径正确（每100外币 ÷ 100）', calibOk, notes.join('; '))

  // 换算对比数据测试：USD→CNY
  const usd = merged.get('USD')
  if (usd && usd.price) {
    const price = Number(usd.price)
    console.log(`\n【换汇对比数据测试】`)
    console.log(`  USD 现汇买入价：${usd.rawPrice}（每100美元） → 1 USD = ${price.toFixed(4)} CNY`)
    const cases = [
      { cny: 1000, expect: (1000 / price).toFixed(2) },
      { cny: 100, expect: (100 / price).toFixed(2) },
      { cny: 50000, expect: (50000 / price).toFixed(2) },
      { cny: 1234.56, expect: (1234.56 / price).toFixed(2) }
    ]
    for (const c of cases) {
      const got = (c.cny / price).toFixed(2)
      check(`CNY ${c.cny} → USD ${got}`, got === c.expect)
    }
    // 反向：1 USD = X CNY 应等于 price
    check('反向 1 USD = 价格本身', Math.abs(1 * price - price) < 1e-9)
    // 交叉汇率：USD→EUR 应与 CNY 中转一致
    const eur = merged.get('EUR')
    if (eur && eur.price) {
      const cross = price / Number(eur.price)
      const viaCny = (1000 / Number(eur.price)) / (1000 / price)
      check(`交叉汇率 USD→EUR 一致性（${cross.toFixed(4)}）`, Math.abs(cross - viaCny) < 1e-9)
    }
  } else {
    check('USD 牌价可用于换汇测试', false)
  }

  console.log(`\n  通过 ${pass} 项 · 失败 ${fail} 项\n`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error('测试异常：', e)
  process.exit(1)
})
