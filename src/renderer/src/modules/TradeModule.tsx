import { useMemo, useState } from 'react'
import { Decimal, formatNumber } from '@shared/format'
import {
  calcCbm,
  calcExportRefund,
  calcImportTax,
  calcPayment,
  calcVat,
  calcVolumeWeight,
  type PaymentTier
} from '@shared/trade'
import { useStore } from '../state/store'
import { Confirm, KV, NumberInput, Segmented } from '../components/ui'

type Scene = 'cbm' | 'volweight' | 'vat' | 'refund' | 'import' | 'payment'

const SCENES: { key: Scene; label: string; desc: string }[] = [
  { key: 'cbm', label: 'CBM 体积', desc: '按箱规计算单箱与总体积、材积' },
  { key: 'volweight', label: '体积重', desc: '按计费规则取实重与体积重的较大值' },
  { key: 'vat', label: '通用税额', desc: '含税价与不含税价互算' },
  { key: 'refund', label: '出口退税', desc: '按票面金额估算退税款与实际采购成本' },
  { key: 'import', label: '进口综合税', desc: '估算关税、消费税、进口增值税与完税成本' },
  { key: 'payment', label: '货款比例', desc: '多档比例拆分合同金额' }
]

export function TradeModule(): JSX.Element {
  const [scene, setScene] = useState<Scene>('cbm')
  const current = SCENES.find((s) => s.key === scene) as (typeof SCENES)[number]

  return (
    <>
      <div className="subtabs">
        {SCENES.map((s) => (
          <button key={s.key} className={`subtab ${s.key === scene ? 'on' : ''}`} onClick={() => setScene(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="panel-body">
        <div className="scene-head">
          <h2>{current.label}</h2>
          <p>{current.desc}</p>
        </div>
        {scene === 'cbm' ? <CbmScene /> : null}
        {scene === 'volweight' ? <VolWeightScene /> : null}
        {scene === 'vat' ? <VatScene /> : null}
        {scene === 'refund' ? <RefundScene /> : null}
        {scene === 'import' ? <ImportScene /> : null}
        {scene === 'payment' ? <PaymentScene /> : null}
      </div>
    </>
  )
}

const F4 = (d: Decimal): string => formatNumber(d, { decimals: 4 })

function ResultCard({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="result-block">{children}</div>
}

// ---------------- CBM ----------------
function CbmScene(): JSX.Element {
  const { addHistory, toast } = useStore()
  const [unit, setUnit] = useState<'cm' | 'mm' | 'm' | 'inch'>('cm')
  const [len, setLen] = useState('60')
  const [wid, setWid] = useState('40')
  const [hei, setHei] = useState('30')
  const [boxes, setBoxes] = useState('10')

  const out = useMemo(() => calcCbm({ length: len, width: wid, height: hei, unit, boxes }), [len, wid, hei, unit, boxes])
  const ok = !('error' in out)

  const save = (): void => {
    if (!ok) return
    addHistory({
      module: 'trade',
      scene: 'cbm',
      expression: `${len}×${wid}×${hei} ${unit} × ${boxes} 箱`,
      result: `总 ${F4((out as { total: Decimal }).total)} m³`,
      payload: { len, wid, hei, unit, boxes }
    })
    toast('已记入历史', 'ok')
  }

  return (
    <div className="scene-grid">
      <div className="scene-form">
        <div className="field">
          <label>尺寸单位</label>
          <Segmented<'cm' | 'mm' | 'm' | 'inch'>
            value={unit}
            onChange={setUnit}
            options={[
              { label: 'cm', value: 'cm' },
              { label: 'mm', value: 'mm' },
              { label: 'm', value: 'm' },
              { label: 'inch', value: 'inch' }
            ]}
          />
        </div>
        <div className="row">
          <div className="field grow">
            <label>长</label>
            <NumberInput value={len} onChange={setLen} suffix={unit} />
          </div>
          <div className="field grow">
            <label>宽</label>
            <NumberInput value={wid} onChange={setWid} suffix={unit} />
          </div>
          <div className="field grow">
            <label>高</label>
            <NumberInput value={hei} onChange={setHei} suffix={unit} />
          </div>
        </div>
        <div className="field">
          <label>箱数</label>
          <NumberInput value={boxes} onChange={setBoxes} suffix="箱" />
        </div>
        <div className="hint">单边 &gt; 1000 时仅做软提示，不阻断计算。</div>
      </div>

      <div className="scene-out">
        {ok ? (
          <ResultCard>
            <KV k="单箱 CBM" v={`${F4((out as { single: Decimal }).single)} m³`} copy={F4((out as { single: Decimal }).single)} />
            <KV
              k="总 CBM"
              v={`${F4((out as { total: Decimal }).total)} m³`}
              strong
              copy={F4((out as { total: Decimal }).total)}
            />
            <KV k="材积 ft³" v={`${formatNumber((out as { cft: Decimal }).cft, { decimals: 4 })} ft³`} />
            {'warn' in out && out.warn ? (
              <div className="hint warn" style={{ marginTop: 8 }}>
                {out.warn}
              </div>
            ) : null}
            <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={save}>
              记入历史
            </button>
          </ResultCard>
        ) : (
          <div className="empty">{(out as { error: string }).error}</div>
        )}
      </div>
    </div>
  )
}

// ---------------- 体积重 ----------------
function VolWeightScene(): JSX.Element {
  const { addHistory, toast } = useStore()
  const [len, setLen] = useState('50')
  const [wid, setWid] = useState('40')
  const [hei, setHei] = useState('30')
  const [actual, setActual] = useState('8')
  const [rule, setRule] = useState<'6000' | '5000' | 'wm' | 'custom'>('6000')
  const [divisor, setDivisor] = useState('6000')

  const out = useMemo(
    () => calcVolumeWeight({ length: len, width: wid, height: hei, actual, rule, divisor }),
    [len, wid, hei, actual, rule, divisor]
  )
  const ok = !('error' in out)

  const save = (): void => {
    if (!ok) return
    addHistory({
      module: 'trade',
      scene: 'volweight',
      expression: `${len}×${wid}×${hei}cm / 实重 ${actual}kg / 规则 ${rule}`,
      result: `计费重 ${F4((out as { chargeable: Decimal }).chargeable)} kg`,
      payload: { len, wid, hei, actual, rule, divisor }
    })
    toast('已记入历史', 'ok')
  }

  return (
    <div className="scene-grid">
      <div className="scene-form">
        <div className="row">
          <div className="field grow">
            <label>长 (cm)</label>
            <NumberInput value={len} onChange={setLen} suffix="cm" />
          </div>
          <div className="field grow">
            <label>宽 (cm)</label>
            <NumberInput value={wid} onChange={setWid} suffix="cm" />
          </div>
          <div className="field grow">
            <label>高 (cm)</label>
            <NumberInput value={hei} onChange={setHei} suffix="cm" />
          </div>
        </div>
        <div className="field">
          <label>实际重量 (kg)</label>
          <NumberInput value={actual} onChange={setActual} suffix="kg" />
        </div>
        <div className="field">
          <label>计费规则</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {[
              { v: '6000', l: '快递/空运 6000' },
              { v: '5000', l: '专线 5000' },
              { v: 'wm', l: '海运拼箱 W/M' },
              { v: 'custom', l: '自定义除数' }
            ].map((o) => (
              <button
                key={o.v}
                className={`opt ${rule === o.v ? 'on' : ''}`}
                onClick={() => setRule(o.v as typeof rule)}
                type="button"
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        {rule === 'custom' ? (
          <div className="field">
            <label>自定义除数</label>
            <NumberInput value={divisor} onChange={setDivisor} />
          </div>
        ) : null}
      </div>

      <div className="scene-out">
        {ok ? (
          <ResultCard>
            <KV k="体积重" v={`${F4((out as { volumetric: Decimal }).volumetric)} kg`} />
            <KV k="实际重量" v={`${F4(new Decimal(actual || '0'))} kg`} />
            <KV
              k="计费重"
              v={`${F4((out as { chargeable: Decimal }).chargeable)} kg`}
              strong
              copy={F4((out as { chargeable: Decimal }).chargeable)}
            />
            <div className="billing-tag">
              {(out as { byVolume: boolean }).byVolume ? '按体积重计费' : '按实重计费'}
            </div>
            <div className="hint">计费规则：{(out as { divisorUsed: string }).divisorUsed}</div>
            {'warn' in out && out.warn ? <div className="hint warn">{out.warn}</div> : null}
            <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={save}>
              记入历史
            </button>
          </ResultCard>
        ) : (
          <div className="empty">{(out as { error: string }).error}</div>
        )}
      </div>
    </div>
  )
}

// ---------------- 通用税额 ----------------
function VatScene(): JSX.Element {
  const { addHistory, settings, toast } = useStore()
  const [amount, setAmount] = useState('1000')
  const [rate, setRate] = useState('13')
  const [dir, setDir] = useState<'exclusive2inclusive' | 'inclusive2exclusive'>('exclusive2inclusive')
  const dec = settings.amountDecimals

  const out = useMemo(() => calcVat({ amount, rate, direction: dir }), [amount, rate, dir])
  const ok = !('error' in out)

  return (
    <div className="scene-grid">
      <div className="scene-form">
        <div className="field">
          <label>方向</label>
          <Segmented<'exclusive2inclusive' | 'inclusive2exclusive'>
            value={dir}
            onChange={setDir}
            options={[
              { label: '不含税 → 含税', value: 'exclusive2inclusive' },
              { label: '含税 → 不含税', value: 'inclusive2exclusive' }
            ]}
          />
        </div>
        <div className="field">
          <label>{dir === 'exclusive2inclusive' ? '不含税金额' : '含税金额'}</label>
          <NumberInput value={amount} onChange={setAmount} maxDecimals={2} />
        </div>
        <div className="field">
          <label>税率 (%)</label>
          <NumberInput value={rate} onChange={setRate} maxDecimals={2} suffix="%" />
        </div>
        {'warn' in out && out.warn ? <div className="hint warn">{out.warn}</div> : null}
        <button
          className="btn sm ghost"
          disabled={!ok}
          onClick={() => {
            if (!ok) return
            addHistory({
              module: 'trade',
              scene: 'vat',
              expression: `${amount} @ ${rate}% ${dir === 'exclusive2inclusive' ? '不含税→含税' : '含税→不含税'}`,
              result: `含税 ${formatNumber((out as { inclusive: Decimal }).inclusive, { decimals: dec })}`,
              payload: { amount, rate, dir }
            })
            toast('已记入历史', 'ok')
          }}
        >
          记入历史
        </button>
      </div>
      <div className="scene-out">
        {ok ? (
          <ResultCard>
            <KV k="不含税金额" v={formatNumber((out as { exclusive: Decimal }).exclusive, { decimals: dec })} />
            <KV k="税额" v={formatNumber((out as { tax: Decimal }).tax, { decimals: dec })} />
            <KV
              k="含税金额"
              v={formatNumber((out as { inclusive: Decimal }).inclusive, { decimals: dec })}
              strong
              copy={formatNumber((out as { inclusive: Decimal }).inclusive, { decimals: dec })}
            />
          </ResultCard>
        ) : (
          <div className="empty">{(out as { error: string }).error}</div>
        )}
      </div>
    </div>
  )
}

// ---------------- 出口退税 ----------------
function RefundScene(): JSX.Element {
  const { addHistory, settings, toast } = useStore()
  const [purchase, setPurchase] = useState('11300')
  const [levy, setLevy] = useState('13')
  const [refund, setRefund] = useState('13')
  const dec = settings.amountDecimals

  const out = useMemo(
    () => calcExportRefund({ purchaseIncl: purchase, levyRate: levy, refundRate: refund }),
    [purchase, levy, refund]
  )
  const ok = !('error' in out)

  return (
    <div className="scene-grid">
      <div className="scene-form">
        <div className="field">
          <label>采购含税金额</label>
          <NumberInput value={purchase} onChange={setPurchase} maxDecimals={2} />
        </div>
        <div className="row">
          <div className="field grow">
            <label>征税率 (%)</label>
            <NumberInput value={levy} onChange={setLevy} maxDecimals={2} suffix="%" />
          </div>
          <div className="field grow">
            <label>退税率 (%)</label>
            <NumberInput value={refund} onChange={setRefund} maxDecimals={2} suffix="%" />
          </div>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {['13', '10', '9', '6', '0'].map((r) => (
            <button key={r} className={`opt ${refund === r ? 'on' : ''}`} onClick={() => setRefund(r)} type="button">
              {r}%
            </button>
          ))}
        </div>
        {'warn' in out && out.warn ? <div className="hint warn">{out.warn}</div> : null}
        <div className="scene-note">
          按票面金额估算，不覆盖生产企业免抵退，不含留抵与进项转出。
        </div>
        <button
          className="btn sm ghost"
          disabled={!ok}
          onClick={() => {
            if (!ok) return
            addHistory({
              module: 'trade',
              scene: 'refund',
              expression: `${purchase} 含税 / 征 ${levy}% / 退 ${refund}%`,
              result: `可退 ${formatNumber((out as { refundable: Decimal }).refundable, { decimals: dec })}`,
              payload: { purchase, levy, refund }
            })
            toast('已记入历史', 'ok')
          }}
        >
          记入历史
        </button>
      </div>
      <div className="scene-out">
        {ok ? (
          <ResultCard>
            <KV k="不含税采购额" v={formatNumber((out as { exclusive: Decimal }).exclusive, { decimals: dec })} />
            <KV
              k="可退税额"
              v={formatNumber((out as { refundable: Decimal }).refundable, { decimals: dec })}
              strong
              copy={formatNumber((out as { refundable: Decimal }).refundable, { decimals: dec })}
            />
            <KV
              k="不可退税额（转成本）"
              v={formatNumber((out as { nonRefundable: Decimal }).nonRefundable, { decimals: dec })}
            />
            <KV
              k="实际采购成本"
              v={formatNumber((out as { realCost: Decimal }).realCost, { decimals: dec })}
            />
          </ResultCard>
        ) : (
          <div className="empty">{(out as { error: string }).error}</div>
        )}
      </div>
    </div>
  )
}

// ---------------- 进口综合税 ----------------
function ImportScene(): JSX.Element {
  const { addHistory, settings, toast } = useStore()
  const [mode, setMode] = useState<'cif' | 'fob'>('cif')
  const [cif, setCif] = useState('10000')
  const [fob, setFob] = useState('9000')
  const [freight, setFreight] = useState('800')
  const [insurance, setInsurance] = useState('200')
  const [duty, setDuty] = useState('8')
  const [vat, setVat] = useState('13')
  const [excise, setExcise] = useState('0')
  const dec = settings.amountDecimals

  const cifPreview = useMemo(() => {
    const f = new Decimal(fob || '0')
    const fr = new Decimal(freight || '0')
    const ins = new Decimal(insurance || '0')
    return f.plus(fr).plus(ins)
  }, [fob, freight, insurance])

  const out = useMemo(
    () =>
      calcImportTax({
        mode,
        cif,
        fob,
        freight,
        insurance,
        dutyRate: duty,
        vatRate: vat,
        exciseRate: excise
      }),
    [mode, cif, fob, freight, insurance, duty, vat, excise]
  )
  const ok = !('error' in out)

  return (
    <div className="scene-grid">
      <div className="scene-form">
        <div className="field">
          <label>完税价格</label>
          <Segmented<'cif' | 'fob'>
            value={mode}
            onChange={setMode}
            options={[
              { label: '直接输入 CIF', value: 'cif' },
              { label: 'FOB + 运费 + 保险', value: 'fob' }
            ]}
          />
        </div>
        {mode === 'cif' ? (
          <div className="field">
            <label>CIF 完税价格</label>
            <NumberInput value={cif} onChange={setCif} maxDecimals={2} />
          </div>
        ) : (
          <>
            <div className="row">
              <div className="field grow">
                <label>FOB</label>
                <NumberInput value={fob} onChange={setFob} maxDecimals={2} />
              </div>
              <div className="field grow">
                <label>运费</label>
                <NumberInput value={freight} onChange={setFreight} maxDecimals={2} />
              </div>
              <div className="field grow">
                <label>保险费</label>
                <NumberInput value={insurance} onChange={setInsurance} maxDecimals={2} />
              </div>
            </div>
            <div className="hint">
              合计 CIF：<b style={{ color: 'var(--txt-0)' }}>{formatNumber(cifPreview, { decimals: 2 })}</b>
            </div>
          </>
        )}
        <div className="row">
          <div className="field grow">
            <label>关税率 (%)</label>
            <NumberInput value={duty} onChange={setDuty} maxDecimals={2} suffix="%" />
          </div>
          <div className="field grow">
            <label>增值税率 (%)</label>
            <NumberInput value={vat} onChange={setVat} maxDecimals={2} suffix="%" />
          </div>
          <div className="field grow">
            <label>消费税率 (%)</label>
            <NumberInput value={excise} onChange={setExcise} maxDecimals={2} suffix="%" />
          </div>
        </div>
        <div className="hint">消费税留空视同 0；有消费税时增值税计税基础已含消费税。</div>
        <button
          className="btn sm ghost"
          disabled={!ok}
          onClick={() => {
            if (!ok) return
            addHistory({
              module: 'trade',
              scene: 'import',
              expression: `CIF ${formatNumber((out as { cif: Decimal }).cif, { decimals: 2 })} / 关税 ${
                duty || 0
              }% / 增值税 ${vat || 0}% / 消费税 ${excise || 0}%`,
              result: `税负合计 ${formatNumber((out as { totalTax: Decimal }).totalTax, { decimals: dec })}`,
              payload: { mode, cif, fob, freight, insurance, duty, vat, excise }
            })
            toast('已记入历史', 'ok')
          }}
        >
          记入历史
        </button>
      </div>
      <div className="scene-out">
        {ok ? (
          <ResultCard>
            <KV k="CIF 完税价格" v={formatNumber((out as { cif: Decimal }).cif, { decimals: dec })} />
            <KV k="关税" v={formatNumber((out as { duty: Decimal }).duty, { decimals: dec })} />
            <KV k="消费税" v={formatNumber((out as { excise: Decimal }).excise, { decimals: dec })} />
            <KV k="进口增值税" v={formatNumber((out as { importVat: Decimal }).importVat, { decimals: dec })} />
            <KV
              k="税负合计"
              v={formatNumber((out as { totalTax: Decimal }).totalTax, { decimals: dec })}
              strong
              copy={formatNumber((out as { totalTax: Decimal }).totalTax, { decimals: dec })}
            />
            <KV k="综合税率" v={`${formatNumber((out as { compositeRate: Decimal }).compositeRate, { decimals: 2 })}%`} />
            <KV
              k="完税后成本"
              v={formatNumber((out as { landedCost: Decimal }).landedCost, { decimals: dec })}
            />
          </ResultCard>
        ) : (
          <div className="empty">{(out as { error: string }).error}</div>
        )}
      </div>
    </div>
  )
}

// ---------------- 货款比例 ----------------
function PaymentScene(): JSX.Element {
  const { addHistory, settings, toast } = useStore()
  const [total, setTotal] = useState('10000')
  const [currency, setCurrency] = useState('USD')
  const [tiers, setTiers] = useState<PaymentTier[]>([
    { id: 'a', label: '定金', ratio: '30' },
    { id: 'b', label: '尾款', ratio: '70' }
  ])
  const [askKeep, setAskKeep] = useState(false)
  const dec = settings.amountDecimals

  const out = useMemo(() => calcPayment(total, tiers), [total, tiers])
  const ok = !('error' in out)

  const addTier = (): void => {
    if (tiers.length >= 8) return
    setTiers((prev) => [...prev, { id: `t${Date.now()}`, label: `第 ${prev.length + 1} 档`, ratio: '0' }])
  }

  return (
    <div className="scene-grid">
      <div className="scene-form">
        <div className="row">
          <div className="field grow">
            <label>合同总额</label>
            <NumberInput value={total} onChange={setTotal} maxDecimals={2} />
          </div>
          <div className="field" style={{ width: 110 }}>
            <label>币种</label>
            <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['USD', 'EUR', 'CNY', 'JPY', 'HKD', 'GBP'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="tier-list">
          {tiers.map((t, idx) => (
            <div className="tier-row" key={t.id}>
              <input
                className="input tier-label"
                value={t.label}
                onChange={(e) =>
                  setTiers((prev) => prev.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))
                }
                placeholder={`第 ${idx + 1} 档`}
              />
              <NumberInput
                className="tier-ratio"
                value={t.ratio}
                onChange={(v) =>
                  setTiers((prev) => prev.map((x) => (x.id === t.id ? { ...x, ratio: v } : x)))
                }
                maxDecimals={2}
                suffix="%"
              />
              <button
                className="mini del"
                title="删除该档"
                disabled={tiers.length <= 1}
                onClick={() => setTiers((prev) => prev.filter((x) => x.id !== t.id))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="btn sm ghost" onClick={addTier} disabled={tiers.length >= 8}>
          + 增加一档
        </button>

        {ok && out.over ? (
          <div className="hint warn">
            比例合计 {formatNumber(out.ratioSum, { decimals: 2 })}%，超过 100%
            <button className="mini" style={{ marginLeft: 8 }} onClick={() => setAskKeep(true)}>
              仍保留
            </button>
          </div>
        ) : null}
        <button
          className="btn sm ghost"
          disabled={!ok}
          onClick={() => {
            if (!ok) return
            addHistory({
              module: 'trade',
              scene: 'payment',
              expression: `${total} ${currency} · ${tiers.map((t) => `${t.label} ${t.ratio}%`).join(' / ')}`,
              result: `合计 ${formatNumber(out.amountSum, { decimals: dec })} ${currency}`,
              payload: { total, currency, tiers }
            })
            toast('已记入历史', 'ok')
          }}
        >
          记入历史
        </button>
      </div>

      <div className="scene-out">
        {ok ? (
          <ResultCard>
            {out.rows.map((r) => (
              <KV
                key={r.id}
                k={`${r.label}（${formatNumber(r.ratio, { decimals: 2 })}%）`}
                v={`${formatNumber(r.amount, { decimals: dec })} ${currency}`}
              />
            ))}
            <KV k="各档合计" v={`${formatNumber(out.amountSum, { decimals: dec })} ${currency}`} strong />
            <KV
              k="与总额差额"
              v={`${formatNumber(out.diff, { decimals: dec })} ${currency}`}
              muted={out.diff.isZero()}
            />
            <KV k="比例合计" v={`${formatNumber(out.ratioSum, { decimals: 2 })}%`} muted={!out.over} />
          </ResultCard>
        ) : (
          <div className="empty">{(out as { error: string }).error}</div>
        )}
      </div>

      <Confirm
        open={askKeep}
        title="比例合计超过 100%"
        desc={`当前合计 ${ok ? formatNumber(out.ratioSum, { decimals: 2 }) : 0}%，是否保留当前设置？`}
        confirmText="保留"
        onCancel={() => setAskKeep(false)}
        onConfirm={() => setAskKeep(false)}
      />
    </div>
  )
}
