import { Decimal } from '@shared/format'
import { CalcError } from '@shared/engine'

/** 统一的外贸计算服务层：纯函数，不依赖 React，便于单测 */

export interface CbmInput {
  length: string
  width: string
  height: string
  unit: 'cm' | 'mm' | 'm' | 'inch'
  boxes: string
}
export interface CbmOutput {
  single: Decimal
  total: Decimal
  cft: Decimal
  warn?: string
}

const TO_M: Record<CbmInput['unit'], string> = { cm: '0.01', mm: '0.001', m: '1', inch: '0.0254' }

export function toDecimal(v: string): Decimal | null {
  const s = v.replace(/,/g, '').trim()
  if (!s || s === '-' || s === '.') return null
  try {
    const d = new Decimal(s)
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

/** M3-1 CBM 体积 */
export function calcCbm(i: CbmInput): CbmOutput | { error: string } {
  const l = toDecimal(i.length)
  const w = toDecimal(i.width)
  const h = toDecimal(i.height)
  const n = toDecimal(i.boxes || '1')
  if (!l || !w || !h) return { error: '请填写完整的长、宽、高' }
  if (l.lte(0) || w.lte(0) || h.lte(0)) return { error: '长、宽、高必须大于 0' }
  if (!n || n.lt(1)) return { error: '箱数必须为 ≥1 的整数' }
  if (!n.isInteger()) return { error: '箱数必须为整数' }
  const k = new Decimal(TO_M[i.unit])
  const single = l.times(k).times(w.times(k)).times(h.times(k))
  const total = single.times(n)
  const cft = total.times('35.3147')
  const warn = l.gt(1000) || w.gt(1000) || h.gt(1000) ? '尺寸疑似输入错误，请确认单位' : undefined
  return { single, total, cft, warn }
}

/** M3-2 体积重 */
export interface VolWeightInput {
  length: string
  width: string
  height: string
  actual: string
  rule: '6000' | '5000' | 'wm' | 'custom'
  divisor: string
}
export interface VolWeightOutput {
  volumetric: Decimal
  chargeable: Decimal
  byVolume: boolean
  divisorUsed: string
  warn?: string
}

export function calcVolumeWeight(i: VolWeightInput): VolWeightOutput | { error: string } {
  const l = toDecimal(i.length)
  const w = toDecimal(i.width)
  const h = toDecimal(i.height)
  if (!l || !w || !h) return { error: '请填写完整的长、宽、高（cm）' }
  if (l.lte(0) || w.lte(0) || h.lte(0)) return { error: '长、宽、高必须大于 0' }
  const actual = toDecimal(i.actual) ?? new Decimal(0)
  if (actual.lt(0)) return { error: '实际重量不能为负' }

  let volumetric: Decimal
  let divisorUsed: string
  let warn: string | undefined

  if (i.rule === 'wm') {
    // 海运拼箱：1 CBM = 1000 kg
    volumetric = l.times(w).times(h).div('1000000').times(1000)
    divisorUsed = 'W/M（1 CBM = 1000 kg）'
  } else {
    let d: Decimal
    if (i.rule === 'custom') {
      const parsed = toDecimal(i.divisor)
      if (!parsed || parsed.lte(0)) {
        d = new Decimal(6000)
        divisorUsed = '6000（除数无效，已用默认值）'
        warn = '除数无效，已改用默认 6000'
      } else {
        d = parsed
        divisorUsed = d.toString()
      }
    } else {
      d = new Decimal(i.rule)
      divisorUsed = i.rule
    }
    volumetric = l.times(w).times(h).div(d)
  }

  const byVolume = volumetric.gt(actual)
  return {
    volumetric,
    chargeable: byVolume ? volumetric : actual,
    byVolume,
    divisorUsed,
    warn
  }
}

/** M3-3 通用税额 */
export interface VatInput {
  amount: string
  rate: string
  direction: 'exclusive2inclusive' | 'inclusive2exclusive'
}
export interface VatOutput {
  exclusive: Decimal
  tax: Decimal
  inclusive: Decimal
  warn?: string
}

export function calcVat(i: VatInput): VatOutput | { error: string } {
  const amt = toDecimal(i.amount)
  const ratePct = toDecimal(i.rate)
  if (!amt) return { error: '请输入金额' }
  if (amt.lte(0)) return { error: '金额必须大于 0' }
  if (!ratePct || ratePct.lt(0)) return { error: '请输入有效税率' }
  const r = ratePct.div(100)
  const warn = ratePct.gt(100) ? '税率异常，请确认' : undefined

  if (i.direction === 'exclusive2inclusive') {
    const tax = amt.times(r)
    return { exclusive: amt, tax, inclusive: amt.times(r.plus(1)), warn }
  }
  const exclusive = amt.div(r.plus(1))
  return { exclusive, tax: amt.minus(exclusive), inclusive: amt, warn }
}

/** M3-4 出口退税 */
export interface RefundInput {
  purchaseIncl: string
  levyRate: string
  refundRate: string
}
export interface RefundOutput {
  exclusive: Decimal
  refundable: Decimal
  nonRefundable: Decimal
  realCost: Decimal
  warn?: string
}

export function calcExportRefund(i: RefundInput): RefundOutput | { error: string } {
  const incl = toDecimal(i.purchaseIncl)
  const levy = toDecimal(i.levyRate)
  const refund = toDecimal(i.refundRate)
  if (!incl || incl.lte(0)) return { error: '请输入采购含税金额' }
  if (!levy || levy.lt(0)) return { error: '请输入有效征税率' }
  if (!refund || refund.lt(0)) return { error: '请输入有效退税率' }
  const lv = levy.div(100)
  const rf = refund.div(100)
  const exclusive = incl.div(lv.plus(1))
  const refundable = exclusive.times(rf)
  const nonRefundable = exclusive.times(lv.minus(rf))
  const warn = refund.gt(levy) ? '退税率不应高于征税率，请确认' : undefined
  return { exclusive, refundable, nonRefundable, realCost: incl.minus(refundable), warn }
}

/** M3-5 进口综合税 */
export interface ImportInput {
  mode: 'cif' | 'fob'
  cif: string
  fob: string
  freight: string
  insurance: string
  dutyRate: string
  vatRate: string
  exciseRate: string
}
export interface ImportOutput {
  cif: Decimal
  duty: Decimal
  excise: Decimal
  importVat: Decimal
  totalTax: Decimal
  compositeRate: Decimal
  landedCost: Decimal
}

export function calcImportTax(i: ImportInput): ImportOutput | { error: string } {
  let cif: Decimal | null
  if (i.mode === 'cif') {
    cif = toDecimal(i.cif)
    if (!cif) return { error: '请输入 CIF 完税价格' }
  } else {
    const fob = toDecimal(i.fob)
    if (!fob) return { error: '请输入 FOB 价格' }
    const fr = toDecimal(i.freight) ?? new Decimal(0)
    const ins = toDecimal(i.insurance) ?? new Decimal(0)
    cif = fob.plus(fr).plus(ins)
  }
  if (cif.lte(0)) return { error: 'CIF 必须大于 0' }

  const dutyRate = toDecimal(i.dutyRate) ?? new Decimal(0)
  const vatRate = toDecimal(i.vatRate) ?? new Decimal(13)
  const exciseRaw = i.exciseRate.trim() === '' ? new Decimal(0) : toDecimal(i.exciseRate)
  if (!exciseRaw) return { error: '消费税率格式有误' }
  if (exciseRaw.gte(100)) return { error: '消费税率须小于 100%' }
  if (exciseRaw.lt(0)) return { error: '消费税率不能为负' }

  const dr = dutyRate.div(100)
  const vr = vatRate.div(100)
  const er = exciseRaw.div(100)

  const duty = cif.times(dr)
  // 消费税 = (CIF + 关税) ÷ (1 − 消费税率) × 消费税率
  const excise = er.isZero()
    ? new Decimal(0)
    : cif.plus(duty).div(new Decimal(1).minus(er)).times(er)
  // 关键：进口增值税计税基础必须含消费税
  const importVat = cif.plus(duty).plus(excise).times(vr)
  const totalTax = duty.plus(excise).plus(importVat)
  return {
    cif,
    duty,
    excise,
    importVat,
    totalTax,
    compositeRate: totalTax.div(cif).times(100),
    landedCost: cif.plus(totalTax)
  }
}

/** M3-6 货款比例 */
export interface PaymentTier {
  id: string
  label: string
  ratio: string
}
export interface PaymentOutput {
  total: Decimal
  rows: { id: string; label: string; ratio: Decimal; amount: Decimal }[]
  ratioSum: Decimal
  amountSum: Decimal
  diff: Decimal
  over: boolean
}

export function calcPayment(totalStr: string, tiers: PaymentTier[]): PaymentOutput | { error: string } {
  const total = toDecimal(totalStr)
  if (!total) return { error: '请输入合同总额' }
  if (total.lt(0)) return { error: '合同总额不能为负' }
  let ratioSum = new Decimal(0)
  let amountSum = new Decimal(0)
  const rows = tiers.map((t) => {
    const r = toDecimal(t.ratio) ?? new Decimal(0)
    const amount = total.times(r).div(100)
    ratioSum = ratioSum.plus(r)
    amountSum = amountSum.plus(amount)
    return { id: t.id, label: t.label, ratio: r, amount }
  })
  return {
    total,
    rows,
    ratioSum,
    amountSum,
    diff: total.minus(amountSum),
    over: ratioSum.gt(100)
  }
}

export { CalcError }
