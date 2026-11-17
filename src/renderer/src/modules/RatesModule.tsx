import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Decimal, formatNumber, parseDecimal } from '@shared/format'
import type { RateEntry, RateSnapshot, RatesResponse } from '@shared/types'
import { useStore } from '../state/store'
import { NumberInput } from '../components/ui'

const MAX_TARGETS = 10
/** 同一会话内 60 秒防抖 */
const REFRESH_DEBOUNCE_MS = 60_000
const DEFAULT_CODES = ['USD', 'EUR', 'JPY', 'HKD']
const BASE_KEY = 'cluo.rates.base'
const TARGETS_KEY = 'cluo.rates.targets'
const AMOUNT_KEY = 'cluo.rates.amount'

function loadArr(key: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : fallback
  } catch {
    return fallback
  }
}

export function RatesModule(): JSX.Element {
  const { settings, addHistory, toast } = useStore()
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(null)
  const [base, setBase] = useState<string>(() => localStorage.getItem(BASE_KEY) || 'CNY')
  const [amount, setAmount] = useState<string>(() => localStorage.getItem(AMOUNT_KEY) || '1000')
  const [targets, setTargets] = useState<string[]>(() => loadArr(TARGETS_KEY, DEFAULT_CODES))
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [reversed, setReversed] = useState<Record<string, boolean>>({})
  const [staleNote, setStaleNote] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const lastRefresh = useRef<number>(0)
  const pickerRef = useRef<HTMLDivElement>(null)

  const dec = settings.amountDecimals

  useEffect(() => localStorage.setItem(BASE_KEY, base), [base])
  useEffect(() => localStorage.setItem(AMOUNT_KEY, amount), [amount])
  useEffect(() => localStorage.setItem(TARGETS_KEY, JSON.stringify(targets)), [targets])

  const applyResponse = useCallback(
    (res: RatesResponse, fromUser: boolean): void => {
      if (res.snapshot) setSnapshot(res.snapshot)
      if (res.ok) {
        setStaleNote('')
        if (fromUser) toast('牌价已更新', 'ok')
      } else if (res.message) {
        setStaleNote(res.message)
        if (fromUser) toast(res.message, 'err')
      }
    },
    [toast]
  )

  // 进入页面先读本地缓存，不自动联网
  useEffect(() => {
    void window.cluo.getCachedRates().then((res) => applyResponse(res, false))
  }, [applyResponse])

  // 抓取进度
  useEffect(() => {
    const onProg = (e: Event): void => {
      const p = (e as CustomEvent<{ page: number; totalPages: number; found: number }>).detail
      if (p) setProgress(`正在抓取第 ${p.page}/${p.totalPages} 页 · 已识别 ${p.found} 个币种`)
    }
    window.addEventListener('cluo:rates-progress', onProg)
    return () => window.removeEventListener('cluo:rates-progress', onProg)
  }, [])

  // 托盘菜单触发的刷新结果
  useEffect(() => {
    const onPushed = (e: Event): void => applyResponse((e as CustomEvent<RatesResponse>).detail, true)
    window.addEventListener('cluo:rates-pushed', onPushed)
    return () => window.removeEventListener('cluo:rates-pushed', onPushed)
  }, [applyResponse])

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    if (pickerOpen) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  const priceMap = useMemo(() => {
    const m = new Map<string, RateEntry>()
    for (const e of snapshot?.entries ?? []) m.set(e.code, e)
    return m
  }, [snapshot])

  const priceOf = useCallback(
    (code: string): Decimal | null => {
      if (code === 'CNY') return new Decimal(1)
      const e = priceMap.get(code)
      if (!e || !e.price) return null
      const d = parseDecimal(e.price)
      return d && d.gt(0) ? d : null
    },
    [priceMap]
  )

  const hasRates = !!snapshot && (snapshot.entries.some((e) => !!e.price) || base === 'CNY')
  const amtDec = parseDecimal(amount)
  const canCalc = hasRates && !!amtDec && amtDec.gt(0) && !!priceOf(base)

  const doRefresh = useCallback(async (): Promise<void> => {
    const now = Date.now()
    if (now - lastRefresh.current < REFRESH_DEBOUNCE_MS) {
      const left = Math.ceil((REFRESH_DEBOUNCE_MS - (now - lastRefresh.current)) / 1000)
      toast(`刚更新过，请 ${left} 秒后再试`)
      return
    }
    setLoading(true)
    setProgress('正在连接中国银行牌价…')
    try {
      const res = await window.cluo.fetchRates()
      lastRefresh.current = Date.now()
      applyResponse(res, true)
      if (res.ok && res.snapshot) {
        setProgress(`已抓取 ${res.snapshot.entries.length} 个币种`)
        addHistory({
          module: 'rates',
          scene: 'refresh',
          expression: '一键更新中国银行牌价',
          result: `${res.snapshot.entries.length} 个币种 · ${res.snapshot.updatedAt}`,
          payload: { updatedAt: res.snapshot.updatedAt }
        })
      }
    } finally {
      setLoading(false)
      window.setTimeout(() => setProgress(''), 1800)
    }
  }, [addHistory, applyResponse, toast])

  const currencyOptions = useMemo(() => {
    const list = [{ code: 'CNY', name: '人民币' }]
    for (const e of snapshot?.entries ?? []) list.push({ code: e.code, name: e.name })
    if (base !== 'CNY' && !list.some((x) => x.code === base)) list.push({ code: base, name: base })
    return list
  }, [snapshot, base])

  const nameOf = useCallback(
    (code: string): string => {
      if (code === 'CNY') return '人民币'
      return priceMap.get(code)?.name ?? code
    },
    [priceMap]
  )

  const addTarget = (code: string): void => {
    if (targets.includes(code)) return
    if (targets.length >= MAX_TARGETS) return
    setTargets((prev) => [...prev, code])
    setPickerOpen(false)
  }

  const removeTarget = (code: string): void => {
    setTargets((prev) => prev.filter((c) => c !== code))
  }

  const computeFor = useCallback(
    (code: string): { value: Decimal | null; unitRate: Decimal | null; error?: string } => {
      if (!amtDec || amtDec.lte(0)) return { value: null, unitRate: null, error: '请输入金额' }
      const basePrice = priceOf(base)
      if (!basePrice) return { value: null, unitRate: null, error: '基准币种无牌价' }
      const targetPrice = priceOf(code)
      if (!targetPrice) {
        const raw = priceMap.get(code)
        return {
          value: null,
          unitRate: null,
          error: raw && !raw.price ? '该币种无现汇买入价' : '数据异常'
        }
      }
      // 1 基准币 = basePrice CNY；1 目标币 = targetPrice CNY
      const unitRate = basePrice.div(targetPrice)
      return { value: amtDec.times(unitRate), unitRate }
    },
    [amtDec, base, priceOf, priceMap]
  )

  const copyAll = (): void => {
    if (!canCalc) return
    const lines = [
      `金额 ${formatNumber(amtDec as Decimal, { decimals: dec })} ${base}`,
      `汇率口径：中国银行现汇买入价`,
      `更新时间：${snapshot?.updatedAt ?? '—'}`,
      ''
    ]
    for (const code of targets) {
      const r = computeFor(code)
      if (r.value && r.unitRate) {
        lines.push(
          `${code} ${nameOf(code)}：${formatNumber(r.value, { decimals: dec })}  (1 ${base} = ${formatNumber(
            r.unitRate,
            { decimals: 4 }
          )} ${code})`
        )
      } else {
        lines.push(`${code} ${nameOf(code)}：${r.error ?? '—'}`)
      }
    }
    void window.cluo.copyText(lines.join('\n'))
    toast('整组结果已复制', 'ok')
  }

  const addable = currencyOptions.filter((o) => !targets.includes(o.code) && o.code !== base)
  const atLimit = targets.length >= MAX_TARGETS

  return (
    <div className="rates">
      <div className="rates-left">
        <div className="rates-block">
          <div className="rates-block-head">
            <span className="lbl">基准币种</span>
          </div>
          <select className="select" value={base} onChange={(e) => setBase(e.target.value)}>
            {currencyOptions.map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} · {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rates-block">
          <span className="lbl">金额</span>
          <NumberInput
            value={amount}
            onChange={setAmount}
            maxDecimals={2}
            suffix={base}
            placeholder="0.00"
            onEnter={() => undefined}
          />
          <div className="hint">支持千分位，最多 2 位小数</div>
        </div>

        <button className="btn primary refresh-btn" onClick={() => void doRefresh()} disabled={loading}>
          {loading ? '抓取中…' : '⟳  一键更新牌价'}
        </button>

        <div className="rates-source">
          <div className="src-line">
            <span className="chip brand">中国银行外汇牌价</span>
          </div>
          <div className="src-meta">
            <span>最后更新：{snapshot?.updatedAt ?? '未获取'}</span>
            {snapshot?.publishTime ? <span>中行发布：{snapshot.publishTime}</span> : null}
            {snapshot ? <span>已识别 {snapshot.entries.length} 个币种</span> : null}
          </div>
          {progress ? <div className="hint">{progress}</div> : null}
          {staleNote ? <div className="hint warn">{staleNote}</div> : null}
          <div className="src-note">
            <strong>换算口径：</strong>统一按现汇买入价折算（中行每 100 单位外币报价已折算为 1 单位）。
          </div>
        </div>
      </div>

      <div className="rates-right">
        <div className="rates-right-head">
          <div>
            <span className="lbl">目标币种</span>
            <span className="cnt">
              {targets.length}/{MAX_TARGETS}
            </span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost" disabled={!canCalc || targets.length === 0} onClick={copyAll}>
              复制全部
            </button>
            <div className="picker-wrap" ref={pickerRef}>
              <button
                className="btn sm primary"
                disabled={atLimit}
                title={atLimit ? '最多添加 10 个币种' : '添加币种'}
                onClick={() => setPickerOpen((v) => !v)}
              >
                + 添加币种
              </button>
              {pickerOpen ? (
                <div className="picker">
                  <div className="picker-head">选择币种（{addable.length}）</div>
                  <div className="picker-list">
                    {addable.length === 0 ? (
                      <div className="empty" style={{ padding: '18px 10px' }}>
                        没有可添加的币种
                      </div>
                    ) : (
                      addable.map((o) => {
                        const noPrice = o.code !== 'CNY' && !priceMap.get(o.code)?.price
                        return (
                          <button
                            key={o.code}
                            className="picker-item"
                            onClick={() => addTarget(o.code)}
                          >
                            <span className="code">{o.code}</span>
                            <span className="nm">{o.name}</span>
                            {noPrice ? <span className="tag">无现汇买入价</span> : null}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {atLimit ? <div className="hint warn limit-tip">最多添加 10 个币种</div> : null}

        <div className="rates-list">
          {targets.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: 22, opacity: 0.5 }}>＋</div>
              <div>点击右侧「+ 添加币种」开始换汇</div>
            </div>
          ) : !hasRates ? (
            <div className="empty">
              <div style={{ fontSize: 22, opacity: 0.5 }}>⟳</div>
              <div>尚未获取牌价，请点击左侧「一键更新牌价」</div>
            </div>
          ) : (
            targets.map((code) => {
              const r = computeFor(code)
              const isRev = !!reversed[code]
              const entry = priceMap.get(code)
              const isBase = code === base
              const showVal =
                isRev && r.unitRate
                  ? new Decimal(1)
                  : r.value
              return (
                <div className={`rate-row ${r.error ? 'dim' : ''}`} key={code}>
                  <div className="rate-id">
                    <div className="code-badge">{code}</div>
                    <div className="rate-names">
                      <div className="nm">{nameOf(code)}</div>
                      <div className="pr">
                        {code === 'CNY'
                          ? '本位币'
                          : entry?.price
                            ? `现汇买入价 ${formatNumber(entry.price, { decimals: 4 })}`
                            : '无现汇买入价'}
                      </div>
                    </div>
                  </div>

                  <div className="rate-val">
                    {isBase ? (
                      <span className="same">与基准币种相同</span>
                    ) : r.error ? (
                      <span className="err-txt">{r.error}</span>
                    ) : isRev ? (
                      <div className="big">
                        {formatNumber(r.unitRate as Decimal, { decimals: 4 })}
                        <span className="unit">{base}</span>
                      </div>
                    ) : (
                      <div className="big">
                        {formatNumber(r.value as Decimal, { decimals: dec })}
                        <span className="unit">{code}</span>
                      </div>
                    )}
                  </div>

                  <div className="rate-actions">
                    {!isBase && !r.error ? (
                      <>
                        <button
                          className="mini"
                          title="切换正向/反向"
                          onClick={() => setReversed((p) => ({ ...p, [code]: !p[code] }))}
                        >
                          {isRev ? '1 目标 = ? 基准' : '反向'}
                        </button>
                        <button
                          className="mini"
                          title="复制本行"
                          onClick={() => {
                            const txt = isRev
                              ? `1 ${code} = ${formatNumber(r.unitRate as Decimal, { decimals: 4 })} ${base}`
                              : `${formatNumber(amtDec as Decimal, { decimals: 2 })} ${base} = ${formatNumber(
                                  r.value as Decimal,
                                  { decimals: dec }
                                )} ${code}`
                            void window.cluo.copyText(txt)
                            toast('已复制', 'ok')
                          }}
                        >
                          复制
                        </button>
                      </>
                    ) : null}
                    <button className="mini del" title="删除该币种" onClick={() => removeTarget(code)}>
                      ×
                    </button>
                  </div>

                  {!r.error && !isBase ? (
                    <div className="rate-sub">
                      {isRev
                        ? `1 ${code} = ${formatNumber(r.unitRate as Decimal, { decimals: 4 })} ${base}`
                        : `1 ${base} = ${formatNumber(r.unitRate as Decimal, { decimals: 4 })} ${code}`}
                      <span className="seal">按中国银行现汇买入价折算</span>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
