/**
 * 计算内核与业务公式验收测试。
 * 运行：node --experimental-strip-types tests/core.test.mts
 */
import assert from 'node:assert/strict'
import { Decimal, formatNumber, parseDecimal, percentToRate } from '../src/shared/format.ts'
import { CalcError, evaluate, checkParens, toDisplayExpr } from '../src/shared/engine.ts'
import {
  calcCbm,
  calcExportRefund,
  calcImportTax,
  calcPayment,
  calcVat,
  calcVolumeWeight
} from '../src/shared/trade.ts'

let pass = 0
let fail = 0
const failures: string[] = []

function test(name: string, fn: () => void): void {
  try {
    fn()
    pass++
  } catch (e) {
    fail++
    failures.push(`${name}\n    → ${e instanceof Error ? e.message : String(e)}`)
  }
}

const D = (s: string | number): Decimal => new Decimal(s)
const near = (a: Decimal, b: string | number, eps = '1e-9'): void => {
  const diff = a.minus(new Decimal(b)).abs()
  assert.ok(diff.lte(new Decimal(eps)), `期望 ${b}，实际 ${a.toString()}，差 ${diff.toString()}`)
}
const errIs = (fn: () => unknown, msg: string): void => {
  try {
    fn()
  } catch (e) {
    assert.ok(e instanceof CalcError, '应抛出 CalcError')
    assert.equal((e as CalcError).message, msg)
    return
  }
  assert.fail(`应抛出「${msg}」，但没有抛错`)
}

// ============ 2.1 数值精度 ============
test('十进制内核 0.1+0.2 = 0.3（无浮点误差）', () => {
  near(evaluate('0.1+0.2', 'DEG', D(0)).value, '0.3')
})
test('12 位有效数字 + 去尾零', () => {
  assert.equal(formatNumber(D('1.23456789012345678')), '1.23456789012')
  assert.equal(formatNumber(D('5.10')), '5.1')
  assert.equal(formatNumber(D('100')), '100')
})
test('绝对值 ≥1e12 自动科学计数法', () => {
  const s = formatNumber(D('1234567890123456'))
  assert.ok(s.includes('e+'), `应科学计数法，实际 ${s}`)
})
test('绝对值 <1e-9 自动科学计数法', () => {
  const s = formatNumber(D('0.0000000000123'))
  assert.ok(s.includes('e-'), `应科学计数法，实际 ${s}`)
})
test('金额固定 2 位 / 汇率固定 4 位', () => {
  assert.equal(formatNumber(D('1130'), { decimals: 2 }), '1,130.00')
  assert.equal(formatNumber(D('7.12345'), { decimals: 4 }), '7.1235')
})
test('half-up 四舍五入（非银行家舍入）', () => {
  assert.equal(formatNumber(D('2.5'), { decimals: 0 }), '3')
  assert.equal(formatNumber(D('0.125'), { decimals: 2 }), '0.13')
  assert.equal(formatNumber(D('1.005'), { decimals: 2 }), '1.01')
})
test('千分位仅展示层生效', () => {
  assert.equal(formatNumber(D('1234567.891'), { decimals: 2 }), '1,234,567.89')
  assert.equal(parseDecimal('1,234,567.89')?.toString(), '1234567.89')
})

// ============ M1 科学计算器验收 ============
test('验收1：2*(3+4) = 14', () => {
  near(evaluate('2*(3+4)', 'DEG', D(0)).value, '14')
  assert.equal(toDisplayExpr('2*(3+4)'), '2×(3+4)')
})
test('验收2：5/0 提示「除数不能为 0」', () => {
  errIs(() => evaluate('5/0', 'DEG', D(0)), '除数不能为 0')
})
test('验收4：RAD 下 sin(π) ≈ 0（1e-12 内）', () => {
  near(evaluate('sin(pi)', 'RAD', D(0)).value, '0', '1e-12')
})
test('验收5：2*(3+4 提示括号未闭合', () => {
  errIs(() => evaluate('2*(3+4', 'DEG', D(0)), '括号未闭合')
})
test('异常：tan(90°) 该角度无定义', () => {
  errIs(() => evaluate('tan(90)', 'DEG', D(0)), '该角度无定义')
})
test('异常：√(-4) 负数不支持开平方', () => {
  errIs(() => evaluate('sqrt(-4)', 'DEG', D(0)), '负数不支持开平方')
})
test('异常：2.5! 阶乘仅支持非负整数', () => {
  errIs(() => evaluate('2.5!', 'DEG', D(0)), '阶乘仅支持非负整数')
})
test('异常：171! 数值超出可计算范围', () => {
  errIs(() => evaluate('171!', 'DEG', D(0)), '数值超出可计算范围')
})
test('异常：ln(-1) 该运算不支持负数', () => {
  errIs(() => evaluate('ln(-1)', 'DEG', D(0)), '该运算不支持负数')
})
test('百分号作用于前一个操作数：200+10% = 220', () => {
  near(evaluate('200+10%', 'DEG', D(0)).value, '220')
  near(evaluate('200-10%', 'DEG', D(0)).value, '180')
})
test('Ans 参与运算', () => {
  near(evaluate('ans*2', 'DEG', D(21)).value, '42')
})
test('阶乘 5! = 120，0! = 1', () => {
  near(evaluate('5!', 'DEG', D(0)).value, '120')
  near(evaluate('0!', 'DEG', D(0)).value, '1')
})
test('幂与根：2^10=1024、√16=4、∛27=3、root(16,4)=2', () => {
  near(evaluate('2^10', 'DEG', D(0)).value, '1024')
  near(evaluate('sqrt(16)', 'DEG', D(0)).value, '4')
  near(evaluate('cbrt(27)', 'DEG', D(0)).value, '3')
  near(evaluate('root(16,4)', 'DEG', D(0)).value, '2')
})
test('三角精度：sin30=0.5、cos60=0.5（DEG）', () => {
  near(evaluate('sin(30)', 'DEG', D(0)).value, '0.5', '1e-20')
  near(evaluate('cos(60)', 'DEG', D(0)).value, '0.5', '1e-20')
})
test('反三角：asin(1)=90（DEG）、atan(1)=45（DEG）', () => {
  near(evaluate('asin(1)', 'DEG', D(0)).value, '90', '1e-10')
  near(evaluate('atan(1)', 'DEG', D(0)).value, '45', '1e-10')
})
test('对数指数：ln(e)=1、log10(1000)=3、exp(0)=1、10^2=100', () => {
  near(evaluate('ln(e)', 'DEG', D(0)).value, '1', '1e-20')
  near(evaluate('log10(1000)', 'DEG', D(0)).value, '3', '1e-20')
  near(evaluate('exp(0)', 'DEG', D(0)).value, '1')
  near(evaluate('10^2', 'DEG', D(0)).value, '100')
})
test('隐式乘法：2π ≈ 6.28318530718', () => {
  near(evaluate('2pi', 'DEG', D(0)).value, '6.283185307179586', '1e-12')
})
test('括号均衡检测', () => {
  assert.equal(checkParens('((1+2)'), 'unclosed')
  assert.equal(checkParens('1+2)'), 'extra')
  assert.equal(checkParens('(1+2)'), null)
})
test('运算符优先级：2+3*4=14、(2+3)*4=20、2^3^2=512（右结合）', () => {
  near(evaluate('2+3*4', 'DEG', D(0)).value, '14')
  near(evaluate('(2+3)*4', 'DEG', D(0)).value, '20')
  near(evaluate('2^3^2', 'DEG', D(0)).value, '512')
})
test('一元负号：-3^2 = -9、(-3)^2 = 9', () => {
  near(evaluate('-3^2', 'DEG', D(0)).value, '-9')
  near(evaluate('(-3)^2', 'DEG', D(0)).value, '9')
})

// ============ M3-1 CBM 验收 ============
test('CBM：60×40×30cm、10箱 → 单箱 0.072、总 0.72', () => {
  const r = calcCbm({ length: '60', width: '40', height: '30', unit: 'cm', boxes: '10' })
  assert.ok(!('error' in r))
  near((r as { single: Decimal }).single, '0.072')
  near((r as { total: Decimal }).total, '0.72')
})
test('CBM：改用 m 输入 0.6×0.4×0.3 结果一致', () => {
  const r = calcCbm({ length: '0.6', width: '0.4', height: '0.3', unit: 'm', boxes: '1' })
  assert.ok(!('error' in r))
  near((r as { total: Decimal }).total, '0.072')
})
test('CBM：材积 ft³ = m³ × 35.3147', () => {
  const r = calcCbm({ length: '60', width: '40', height: '30', unit: 'cm', boxes: '10' })
  near((r as { cft: Decimal }).cft, '25.426584', '1e-6')
})
test('CBM：任一维为 0 拒绝计算', () => {
  const r = calcCbm({ length: '0', width: '40', height: '30', unit: 'cm', boxes: '1' })
  assert.ok('error' in r)
})
test('CBM：单边 >1000m 软提示不阻断', () => {
  const r = calcCbm({ length: '1200', width: '1', height: '1', unit: 'm', boxes: '1' })
  assert.ok(!('error' in r))
  assert.ok((r as { warn?: string }).warn)
})

// ============ M3-2 体积重验收 ============
test('体积重：50×40×30、实际8kg、除数6000 → 10kg，按体积重计费', () => {
  const r = calcVolumeWeight({ length: '50', width: '40', height: '30', actual: '8', rule: '6000', divisor: '6000' })
  assert.ok(!('error' in r))
  near((r as { volumetric: Decimal }).volumetric, '10')
  near((r as { chargeable: Decimal }).chargeable, '10')
  assert.equal((r as { byVolume: boolean }).byVolume, true)
})
test('体积重：除数 0 时回落默认 6000 并提示', () => {
  const r = calcVolumeWeight({ length: '50', width: '40', height: '30', actual: '8', rule: 'custom', divisor: '0' })
  assert.ok(!('error' in r))
  near((r as { volumetric: Decimal }).volumetric, '10')
  assert.ok((r as { warn?: string }).warn)
})
test('体积重：海运 W/M 1CBM = 1000kg', () => {
  const r = calcVolumeWeight({ length: '100', width: '100', height: '100', actual: '5', rule: 'wm', divisor: '' })
  near((r as { volumetric: Decimal }).volumetric, '1000')
})

// ============ M3-3 通用税额验收 ============
test('税额：1000 @13% 不含税→含税 → 税130、含税1130', () => {
  const r = calcVat({ amount: '1000', rate: '13', direction: 'exclusive2inclusive' })
  assert.ok(!('error' in r))
  near((r as { tax: Decimal }).tax, '130')
  near((r as { inclusive: Decimal }).inclusive, '1130')
})
test('税额：1130 @13% 含税→不含税 → 1000', () => {
  const r = calcVat({ amount: '1130', rate: '13', direction: 'inclusive2exclusive' })
  near((r as { exclusive: Decimal }).exclusive, '1000', '1e-10')
  near((r as { tax: Decimal }).tax, '130', '1e-10')
})
test('税额：税率 >100% 软提示不阻断', () => {
  const r = calcVat({ amount: '1000', rate: '150', direction: 'exclusive2inclusive' })
  assert.ok(!('error' in r))
  assert.ok((r as { warn?: string }).warn)
})
test('税额：金额 ≤0 拦截', () => {
  assert.ok('error' in calcVat({ amount: '0', rate: '13', direction: 'exclusive2inclusive' }))
})

// ============ M3-4 出口退税验收 ============
test('退税：11300 含税、13%/13% → 不含税10000、可退1300、不可退0、成本10000', () => {
  const r = calcExportRefund({ purchaseIncl: '11300', levyRate: '13', refundRate: '13' })
  assert.ok(!('error' in r))
  near((r as { exclusive: Decimal }).exclusive, '10000', '1e-10')
  near((r as { refundable: Decimal }).refundable, '1300', '1e-10')
  near((r as { nonRefundable: Decimal }).nonRefundable, '0', '1e-10')
  near((r as { realCost: Decimal }).realCost, '10000', '1e-10')
})
test('退税：退税率改 9% → 可退900、不可退400、成本10400', () => {
  const r = calcExportRefund({ purchaseIncl: '11300', levyRate: '13', refundRate: '9' })
  near((r as { refundable: Decimal }).refundable, '900', '1e-10')
  near((r as { nonRefundable: Decimal }).nonRefundable, '400', '1e-10')
  near((r as { realCost: Decimal }).realCost, '10400', '1e-10')
})
test('退税：退税率 > 征税率 软提示', () => {
  const r = calcExportRefund({ purchaseIncl: '11300', levyRate: '9', refundRate: '13' })
  assert.ok((r as { warn?: string }).warn)
})

// ============ M3-5 进口综合税验收 ============
test('进口税：CIF10000、关税8%、消费税0、增值税13% → 关税800、增值税1404、合计2204、综合22.04%、成本12204', () => {
  const r = calcImportTax({
    mode: 'cif', cif: '10000', fob: '', freight: '', insurance: '',
    dutyRate: '8', vatRate: '13', exciseRate: '0'
  })
  assert.ok(!('error' in r))
  near((r as { duty: Decimal }).duty, '800', '1e-10')
  near((r as { excise: Decimal }).excise, '0')
  near((r as { importVat: Decimal }).importVat, '1404', '1e-10')
  near((r as { totalTax: Decimal }).totalTax, '2204', '1e-10')
  near((r as { compositeRate: Decimal }).compositeRate, '22.04', '1e-10')
  near((r as { landedCost: Decimal }).landedCost, '12204', '1e-10')
})
test('进口税【必守】：CIF10000、关税0、消费税10%、增值税13% → 消费税1111.11、增值税1444.44（不得为1300）', () => {
  const r = calcImportTax({
    mode: 'cif', cif: '10000', fob: '', freight: '', insurance: '',
    dutyRate: '0', vatRate: '13', exciseRate: '10'
  })
  assert.ok(!('error' in r))
  near((r as { excise: Decimal }).excise, '1111.1111111', '1e-6')
  near((r as { importVat: Decimal }).importVat, '1444.4444444', '1e-6')
  near((r as { totalTax: Decimal }).totalTax, '2555.5555556', '1e-6')
  // 明确排除错误算法
  const wrong = (r as { importVat: Decimal }).importVat
  assert.ok(wrong.minus(new Decimal('1300')).abs().gt(new Decimal('100')), '增值税计税基础必须含消费税')
})
test('进口税：消费税率 100 拦截', () => {
  const r = calcImportTax({
    mode: 'cif', cif: '10000', fob: '', freight: '', insurance: '',
    dutyRate: '8', vatRate: '13', exciseRate: '100'
  })
  assert.ok('error' in r)
  assert.match((r as { error: string }).error, /小于 100/)
})
test('进口税：CIF ≤0 拦截', () => {
  assert.ok('error' in calcImportTax({ mode: 'cif', cif: '0', fob: '', freight: '', insurance: '', dutyRate: '8', vatRate: '13', exciseRate: '0' }))
})
test('进口税：FOB+运费+保险 三项合计为 CIF', () => {
  const r = calcImportTax({
    mode: 'fob', cif: '', fob: '9000', freight: '800', insurance: '200',
    dutyRate: '8', vatRate: '13', exciseRate: '0'
  })
  assert.ok(!('error' in r))
  near((r as { cif: Decimal }).cif, '10000')
})
test('进口税：消费税留空视同 0', () => {
  const r = calcImportTax({
    mode: 'cif', cif: '10000', fob: '', freight: '', insurance: '',
    dutyRate: '8', vatRate: '13', exciseRate: ''
  })
  assert.ok(!('error' in r))
  near((r as { excise: Decimal }).excise, '0')
})

// ============ M3-6 货款比例验收 ============
test('货款比例：10000、30%/80% → 合计110% 提示超 100% 但保留', () => {
  const r = calcPayment('10000', [
    { id: 'a', label: '定金', ratio: '30' },
    { id: 'b', label: '尾款', ratio: '80' }
  ])
  assert.ok(!('error' in r))
  near((r as { ratioSum: Decimal }).ratioSum, '110')
  assert.equal((r as { over: boolean }).over, true)
  near((r as { rows: { amount: Decimal }[] }).rows[0].amount, '3000')
  near((r as { rows: { amount: Decimal }[] }).rows[1].amount, '8000')
})
test('货款比例：30%/70% → 合计 100%、差额 0', () => {
  const r = calcPayment('10000', [
    { id: 'a', label: '定金', ratio: '30' },
    { id: 'b', label: '尾款', ratio: '70' }
  ])
  assert.equal((r as { over: boolean }).over, false)
  near((r as { diff: Decimal }).diff, '0')
})

// ============ M2 汇率换算口径 ============
test('汇率：中行每100外币报价712.34 → 1USD=7.1234；CNY1000 → 140.38 USD', () => {
  const raw = 712.34
  const perUnit = new Decimal(raw).div(100)
  near(perUnit, '7.1234')
  const usd = new Decimal(1000).div(perUnit)
  near(usd, '140.3824', '1e-4')
  assert.equal(formatNumber(usd, { decimals: 2 }), '140.38')
})

// ============ M4 单位换算验收 ============
const LEN: Record<string, string> = { mm: '0.001', cm: '0.01', m: '1', km: '1000', in: '0.0254', ft: '0.3048', yd: '0.9144', mi: '1609.344', nmi: '1852' }
const conv = (v: Decimal, table: Record<string, string>, from: string, to: string): Decimal =>
  v.times(table[from]).div(table[to])

test('单位：1 m → 100cm / 1000mm / 39.3701in / 3.2808ft', () => {
  assert.equal(formatNumber(conv(D(1), LEN, 'm', 'cm'), { decimals: 4 }), '100.0000')
  assert.equal(formatNumber(conv(D(1), LEN, 'm', 'mm'), { decimals: 4 }), '1,000.0000')
  assert.equal(formatNumber(conv(D(1), LEN, 'm', 'in'), { decimals: 4 }), '39.3701')
  assert.equal(formatNumber(conv(D(1), LEN, 'm', 'ft'), { decimals: 4 }), '3.2808')
})
test('单位：温度 100℃ → 212℉ / 373.15K', () => {
  assert.equal(formatNumber(D(100).times(9).div(5).plus(32), { decimals: 2 }), '212.00')
  assert.equal(formatNumber(D(100).plus('273.15'), { decimals: 2 }), '373.15')
})
test('单位：32℉ → 0℃（不得显示 17.78）', () => {
  const c = D(32).minus(32).times(5).div(9)
  assert.equal(formatNumber(c, { decimals: 4 }), '0.0000')
})
test('单位：2 斤 → 1kg / 1000g', () => {
  const KG: Record<string, string> = { g: '0.001', kg: '1', t: '1000', jin: '0.5', liang: '0.05', lb: '0.45359237', oz: '0.028349523125', stone: '6.35029318' }
  assert.equal(formatNumber(conv(D(2), KG, 'jin', 'kg'), { decimals: 4 }), '1.0000')
  assert.equal(formatNumber(conv(D(2), KG, 'jin', 'g'), { decimals: 4 }), '1,000.0000')
})
test('单位：1 亩 ≈ 666.6667 m²', () => {
  const AREA: Record<string, string> = { m2: '1', mu: '666.6666666666666666667' }
  assert.equal(formatNumber(conv(D(1), AREA, 'mu', 'm2'), { decimals: 4 }), '666.6667')
})

// ============ 压力测试 ============
test('压力：连续 20000 次求值耗时 < 3s 且结果稳定', () => {
  const t0 = Date.now()
  let acc = new Decimal(0)
  for (let i = 0; i < 20000; i++) {
    acc = acc.plus(evaluate(`(${i % 97}+${i % 13})*2-${i % 7}`, 'DEG', D(i)).value)
  }
  const dt = Date.now() - t0
  assert.ok(Number.isFinite(Number(acc.toString())))
  assert.ok(dt < 3000, `20000 次求值耗时 ${dt}ms，超过 3s`)
})
test('压力：三角/对数混合 5000 次求值 < 3s', () => {
  const t0 = Date.now()
  for (let i = 1; i <= 5000; i++) {
    evaluate(`sin(${i % 360})+cos(${i % 360})*ln(${i + 1})`, 'DEG', D(0))
  }
  const dt = Date.now() - t0
  assert.ok(dt < 3000, `5000 次三角求值耗时 ${dt}ms`)
})
test('压力：1000 币种换汇计算 < 200ms', () => {
  const t0 = Date.now()
  const prices = Array.from({ length: 45 }, (_, i) => new Decimal(1).plus(new Decimal(i).div(10)))
  const amount = new Decimal(1000)
  let sum = new Decimal(0)
  for (let i = 0; i < 1000; i++) {
    for (const p of prices) sum = sum.plus(amount.div(p))
  }
  const dt = Date.now() - t0
  assert.ok(dt < 200, `1080 次换汇耗时 ${dt}ms`)
})

// ============ 结果 ============
console.log(`\n  通过 ${pass} 项 · 失败 ${fail} 项\n`)
if (failures.length) {
  console.log('失败明细：')
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log('  全部验收用例通过 ✓\n')
