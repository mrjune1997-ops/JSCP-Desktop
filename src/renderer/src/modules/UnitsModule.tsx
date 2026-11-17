import { useMemo, useState } from 'react'
import { Decimal, formatNumber } from '@shared/format'
import { KV, NumberInput } from '../components/ui'

/**
 * 单位换算。所有系数集中在本表维护，各场景共用，不允许各自写一套。
 * 基准：长度 m、重量 kg、体积 m³、面积 m²、容量 L。
 */

interface UnitDef {
  key: string
  label: string
  /** 相对基准的倍率 */
  factor: string
}

interface CategoryDef {
  key: string
  label: string
  base: string
  units: UnitDef[]
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'length',
    label: '长度',
    base: 'm',
    units: [
      { key: 'mm', label: '毫米 mm', factor: '0.001' },
      { key: 'cm', label: '厘米 cm', factor: '0.01' },
      { key: 'm', label: '米 m', factor: '1' },
      { key: 'km', label: '千米 km', factor: '1000' },
      { key: 'in', label: '英寸 in', factor: '0.0254' },
      { key: 'ft', label: '英尺 ft', factor: '0.3048' },
      { key: 'yd', label: '码 yd', factor: '0.9144' },
      { key: 'mi', label: '英里 mi', factor: '1609.344' },
      { key: 'nmi', label: '海里 nmi', factor: '1852' }
    ]
  },
  {
    key: 'weight',
    label: '重量',
    base: 'kg',
    units: [
      { key: 'g', label: '克 g', factor: '0.001' },
      { key: 'kg', label: '千克 kg', factor: '1' },
      { key: 't', label: '吨 t', factor: '1000' },
      { key: 'jin', label: '斤', factor: '0.5' },
      { key: 'liang', label: '两', factor: '0.05' },
      { key: 'lb', label: '磅 lb', factor: '0.45359237' },
      { key: 'oz', label: '盎司 oz', factor: '0.028349523125' },
      { key: 'stone', label: '英石 stone', factor: '6.35029318' }
    ]
  },
  {
    key: 'volume',
    label: '体积',
    base: 'm3',
    units: [
      { key: 'cm3', label: '立方厘米 cm³', factor: '0.000001' },
      { key: 'm3', label: '立方米 m³', factor: '1' },
      { key: 'ml', label: '毫升 mL', factor: '0.000001' },
      { key: 'l', label: '升 L', factor: '0.001' },
      { key: 'ft3', label: '立方英尺 ft³', factor: '0.028316846592' },
      { key: 'in3', label: '立方英寸 in³', factor: '0.000016387064' },
      { key: 'usgal', label: '美制加仑 US gal', factor: '0.003785411784' },
      { key: 'ukgal', label: '英制加仑 UK gal', factor: '0.00454609' }
    ]
  },
  {
    key: 'area',
    label: '面积',
    base: 'm2',
    units: [
      { key: 'cm2', label: '平方厘米 cm²', factor: '0.0001' },
      { key: 'm2', label: '平方米 m²', factor: '1' },
      { key: 'km2', label: '平方千米 km²', factor: '1000000' },
      { key: 'ha', label: '公顷 ha', factor: '10000' },
      { key: 'mu', label: '亩', factor: '666.6666666666666666667' },
      { key: 'ft2', label: '平方英尺 ft²', factor: '0.09290304' },
      { key: 'yd2', label: '平方码 yd²', factor: '0.83612736' }
    ]
  },
  {
    key: 'capacity',
    label: '容量',
    base: 'l',
    units: [
      { key: 'ml2', label: '毫升 mL', factor: '0.001' },
      { key: 'l2', label: '升 L', factor: '1' },
      { key: 'dl', label: '分升 dL', factor: '0.1' },
      { key: 'usgal2', label: '美制加仑 US gal', factor: '3.785411784' },
      { key: 'ukgal2', label: '英制加仑 UK gal', factor: '4.54609' },
      { key: 'usfloz', label: '美制液盎司 US fl oz', factor: '0.0295735295625' },
      { key: 'ptus', label: '美制品脱 pt(US)', factor: '0.473176473' }
    ]
  },
  {
    key: 'temp',
    label: '温度',
    base: 'c',
    units: [
      { key: 'c', label: '摄氏度 ℃', factor: '1' },
      { key: 'f', label: '华氏度 ℉', factor: '1' },
      { key: 'k', label: '开尔文 K', factor: '1' }
    ]
  }
]

/** 温度必须用公式，不得按倍率换算 */
function tempConvert(value: Decimal, from: string, to: string): Decimal {
  if (from === to) return value
  let celsius: Decimal
  if (from === 'c') celsius = value
  else if (from === 'f') celsius = value.minus(32).times(5).div(9)
  else celsius = value.minus('273.15')

  if (to === 'c') return celsius
  if (to === 'f') return celsius.times(9).div(5).plus(32)
  return celsius.plus('273.15')
}

function convertValue(value: Decimal, cat: CategoryDef, from: string, to: string): Decimal {
  if (cat.key === 'temp') return tempConvert(value, from, to)
  const f = cat.units.find((u) => u.key === from)
  const t = cat.units.find((u) => u.key === to)
  if (!f || !t) return value
  return value.times(f.factor).div(t.factor)
}

export function UnitsModule(): JSX.Element {
  const [catKey, setCatKey] = useState('length')
  const isPercent = catKey === 'percent'
  // 百分比是独立工具页，不在 CATEGORIES 内，必须给一个安全的兜底，
  // 否则 cat 为 undefined 时访问 cat.units[0] 会直接抛异常导致整页白屏。
  const cat = (CATEGORIES.find((c) => c.key === catKey) ?? CATEGORIES[0]) as CategoryDef
  const [values, setValues] = useState<Record<string, string>>({})
  const [active, setActive] = useState<string>(cat.units[0].key)
  const [decimals, setDecimals] = useState<2 | 4 | 6>(4)

  const cat2 = catKey

  const setFor = (catKeyNow: string, unitKey: string, raw: string): void => {
    const c = CATEGORIES.find((x) => x.key === catKeyNow) as CategoryDef
    const num = raw.replace(/,/g, '').trim()
    if (num === '' || num === '-' || num === '.') {
      setValues({ [unitKey]: raw })
      setActive(unitKey)
      return
    }
    let d: Decimal
    try {
      d = new Decimal(num)
    } catch {
      return
    }
    if (!d.isFinite()) return
    const next: Record<string, string> = { [unitKey]: raw }
    for (const u of c.units) {
      if (u.key === unitKey) continue
      next[u.key] = formatNumber(convertValue(d, c, unitKey, u.key), { decimals, grouping: false })
    }
    setValues(next)
    setActive(unitKey)
  }

  const reset = (): void => {
    setValues({})
    setActive(cat.units[0].key)
  }

  const switchCat = (k: string): void => {
    setCatKey(k)
    setValues({})
    if (k === 'percent') return
    const c = CATEGORIES.find((x) => x.key === k) as CategoryDef
    setActive(c.units[0].key)
  }

  return (
    <>
      <div className="subtabs">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={`subtab ${c.key === cat2 ? 'on' : ''}`} onClick={() => switchCat(c.key)}>
            {c.label}
          </button>
        ))}
        <button className={`subtab ${isPercent ? 'on' : ''}`} onClick={() => switchCat('percent')}>
          百分比
        </button>
      </div>
      <div className="panel-body">
        {isPercent ? (
          <PercentTools />
        ) : (
          <>
            <div className="scene-head row" style={{ alignItems: 'flex-end' }}>
              <div className="grow">
                <h2>{cat.label}换算</h2>
                <p>输入任一单位，其余单位即时同步；以最后编辑的单位为准。</p>
              </div>
              <div className="seg">
                {([2, 4, 6] as const).map((d) => (
                  <button key={d} className={decimals === d ? 'on' : ''} onClick={() => setDecimals(d)}>
                    {d} 位
                  </button>
                ))}
              </div>
            </div>

            <div className="unit-grid">
              {cat.units.map((u) => {
                const isActive = u.key === active
                return (
                  <div className={`unit-cell ${isActive ? 'on' : ''}`} key={u.key}>
                    <div className="unit-label">{u.label}</div>
                    <input
                      className="unit-input"
                      value={values[u.key] ?? ''}
                      placeholder="0"
                      inputMode="decimal"
                      onChange={(e) => setFor(cat2, u.key, e.target.value)}
                      onFocus={() => setActive(u.key)}
                    />
                    {u.key === cat.base ? <span className="base-tag">基准</span> : null}
                  </div>
                )
              })}
            </div>

            <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
              <div className="hint">
                {cat.key === 'temp'
                  ? '温度按公式换算：℃→℉ = C×9/5+32，K = C+273.15，反向独立实现。'
                  : `换算系数统一维护在常量表，基准单位：${cat.base}`}
              </div>
              <button className="btn sm ghost" onClick={reset}>
                清空
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function PercentTools(): JSX.Element {
  const [mode, setMode] = useState<'change' | 'share' | 'discount' | 'convert'>('change')
  const [a, setA] = useState('100')
  const [b, setB] = useState('120')
  const [pct, setPct] = useState('20')
  const [price, setPrice] = useState('1000')
  const [disc, setDisc] = useState('8.5')
  const [sub, setSub] = useState('100')
  const [fromPct, setFromPct] = useState('25')

  const num = (s: string): Decimal | null => {
    const t = s.replace(/,/g, '').trim()
    if (!t) return null
    try {
      const d = new Decimal(t)
      return d.isFinite() ? d : null
    } catch {
      return null
    }
  }

  const changeOut = useMemo(() => {
    const o = num(a)
    const n = num(b)
    if (!o || !n || o.isZero()) return null
    return { rate: n.minus(o).div(o).times(100), delta: n.minus(o) }
  }, [a, b])

  const newValueOut = useMemo(() => {
    const o = num(a)
    const p = num(pct)
    if (!o || !p) return null
    return o.times(p.div(100).plus(1))
  }, [a, pct])

  const shareOut = useMemo(() => {
    const part = num(a)
    const total = num(b)
    if (!part || !total || total.isZero()) return null
    return { pct: part.div(total).times(100), rest: total.minus(part) }
  }, [a, b])

  const discountOut = useMemo(() => {
    const p = num(price)
    const d = num(disc)
    const s = num(sub) ?? new Decimal(0)
    if (!p || !d) return null
    // 几折：8.5 折 = 85%
    const after = p.times(d).div(10)
    const final = Decimal.max(after.minus(s), new Decimal(0))
    return {
      after,
      saved: p.minus(final),
      final,
      realRate: p.isZero() ? new Decimal(0) : final.div(p).times(100)
    }
  }, [price, disc, sub])

  // 百分比 ⇄ 小数/分数互转，补齐外贸报价里常用的换算口径
  const convertOut = useMemo(() => {
    const p = num(fromPct)
    if (!p) return null
    return {
      decimal: p.div(100),
      perMille: p.times(10),
      basisPoint: p.times(100),
      fraction: p.div(100)
    }
  }, [fromPct])

  const MODES: { v: typeof mode; l: string }[] = [
    { v: 'change', l: '涨跌幅' },
    { v: 'share', l: '占比' },
    { v: 'discount', l: '折扣' },
    { v: 'convert', l: '百分比换算' }
  ]

  return (
    <>
      <div className="scene-head">
        <h2>百分比工具</h2>
        <p>涨跌幅、占比、折扣与百分比互转</p>
      </div>
      <div className="seg" style={{ marginBottom: 16 }}>
        {MODES.map((o) => (
          <button key={o.v} className={mode === o.v ? 'on' : ''} onClick={() => setMode(o.v)}>
            {o.l}
          </button>
        ))}
      </div>

      {mode === 'change' ? (
        <div className="scene-grid">
          <div className="scene-form">
            <div className="row">
              <div className="field grow">
                <label>原值</label>
                <NumberInput value={a} onChange={setA} allowNegative />
              </div>
              <div className="field grow">
                <label>新值</label>
                <NumberInput value={b} onChange={setB} allowNegative />
              </div>
            </div>
            <div className="field">
              <label>或：按涨跌幅推算新值</label>
              <NumberInput value={pct} onChange={setPct} suffix="%" allowNegative maxDecimals={4} />
            </div>
            <div className="scene-note">
              涨跌幅 =（新值 − 原值）÷ 原值 × 100%；推算新值 = 原值 ×（1 + 百分比）。
            </div>
          </div>
          <div className="scene-out">
            <div className="result-block">
              {changeOut ? (
                <>
                  <KV
                    k="变化百分比"
                    v={`${changeOut.rate.gte(0) ? '+' : ''}${formatNumber(changeOut.rate, { decimals: 2 })}%`}
                    strong
                  />
                  <KV k="变化量" v={formatNumber(changeOut.delta, { decimals: 2, grouping: true })} />
                </>
              ) : (
                <div className="hint">请输入原值与新值</div>
              )}
              <KV
                k="按涨跌幅推算新值"
                v={newValueOut ? formatNumber(newValueOut, { decimals: 2, grouping: true }) : '—'}
                muted={!newValueOut}
              />
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'share' ? (
        <div className="scene-grid">
          <div className="scene-form">
            <div className="row">
              <div className="field grow">
                <label>部分</label>
                <NumberInput value={a} onChange={setA} allowNegative />
              </div>
              <div className="field grow">
                <label>总数</label>
                <NumberInput value={b} onChange={setB} allowNegative />
              </div>
            </div>
            <div className="scene-note">占比 = 部分 ÷ 总数 × 100%；剩余部分 = 总数 − 部分。</div>
          </div>
          <div className="scene-out">
            <div className="result-block">
              {shareOut ? (
                <>
                  <KV k="占比" v={`${formatNumber(shareOut.pct, { decimals: 2 })}%`} strong />
                  <KV k="剩余部分" v={formatNumber(shareOut.rest, { decimals: 2, grouping: true })} />
                </>
              ) : (
                <div className="hint">请输入部分与总数</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'discount' ? (
        <div className="scene-grid">
          <div className="scene-form">
            <div className="row">
              <div className="field grow">
                <label>原价</label>
                <NumberInput value={price} onChange={setPrice} maxDecimals={2} />
              </div>
              <div className="field grow">
                <label>折扣（几折）</label>
                <NumberInput value={disc} onChange={setDisc} maxDecimals={2} />
              </div>
              <div className="field grow">
                <label>满减金额</label>
                <NumberInput value={sub} onChange={setSub} maxDecimals={2} />
              </div>
            </div>
            <div className="scene-note">8.5 折 = 原价 × 85%，满减在折扣后扣减，最低到 0。</div>
          </div>
          <div className="scene-out">
            <div className="result-block">
              {discountOut ? (
                <>
                  <KV k="到手价" v={formatNumber(discountOut.final, { decimals: 2, grouping: true })} strong />
                  <KV k="实际折扣率" v={`${formatNumber(discountOut.realRate, { decimals: 2 })}%`} />
                  <KV k="省下金额" v={formatNumber(discountOut.saved, { decimals: 2, grouping: true })} />
                </>
              ) : (
                <div className="hint">请输入原价与折扣</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'convert' ? (
        <div className="scene-grid">
          <div className="scene-form">
            <div className="field">
              <label>百分比数值</label>
              <NumberInput value={fromPct} onChange={setFromPct} suffix="%" allowNegative maxDecimals={6} />
            </div>
            <div className="scene-note">
              百分比 ÷ 100 = 小数；× 10 = 千分数；× 100 = 基点（bp）。报价、退税、关税里三种口径常要互换。
            </div>
          </div>
          <div className="scene-out">
            <div className="result-block">
              {convertOut ? (
                <>
                  <KV k="小数" v={formatNumber(convertOut.decimal, { decimals: 6, grouping: false })} strong />
                  <KV k="千分数 ‰" v={`${formatNumber(convertOut.perMille, { decimals: 3 })}‰`} />
                  <KV k="基点 bp" v={formatNumber(convertOut.basisPoint, { decimals: 2, grouping: true })} />
                </>
              ) : (
                <div className="hint">请输入百分比数值</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
