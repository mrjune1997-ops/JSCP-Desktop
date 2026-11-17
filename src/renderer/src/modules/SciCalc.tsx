import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Decimal, formatNumber } from '@shared/format'
import { CalcError, evaluate, normalizeInput, toDisplayExpr, type EvalResult } from '@shared/engine'
import { useStore } from '../state/store'
import { Confirm } from '../components/ui'

interface KeyDef {
  label: string
  token: string
  kind?: 'num' | 'op' | 'fn' | 'action' | 'const' | 'eq'
  wide?: boolean
}

const ROWS: KeyDef[][] = [
  [
    { label: 'DEG', token: '@angle', kind: 'action' },
    { label: '(', token: '(', kind: 'op' },
    { label: ')', token: ')', kind: 'op' },
    { label: '⌫', token: '@back', kind: 'action' },
    { label: 'C', token: '@clear', kind: 'action' }
  ],
  [
    { label: 'x²', token: '^2', kind: 'fn' },
    { label: 'x³', token: '^3', kind: 'fn' },
    { label: 'xʸ', token: '^', kind: 'op' },
    { label: '√', token: 'sqrt(', kind: 'fn' },
    { label: 'ⁿ√', token: 'root(', kind: 'fn' }
  ],
  [
    { label: 'sin', token: 'sin(', kind: 'fn' },
    { label: 'cos', token: 'cos(', kind: 'fn' },
    { label: 'tan', token: 'tan(', kind: 'fn' },
    { label: 'ln', token: 'ln(', kind: 'fn' },
    { label: 'lg', token: 'log10(', kind: 'fn' }
  ],
  [
    { label: 'asin', token: 'asin(', kind: 'fn' },
    { label: 'acos', token: 'acos(', kind: 'fn' },
    { label: 'atan', token: 'atan(', kind: 'fn' },
    { label: 'eˣ', token: 'exp(', kind: 'fn' },
    { label: '10ˣ', token: '10^', kind: 'fn' }
  ],
  [
    { label: 'π', token: 'pi', kind: 'const' },
    { label: 'e', token: 'e', kind: 'const' },
    { label: 'n!', token: '!', kind: 'fn' },
    { label: '1/x', token: '@recip', kind: 'fn' },
    { label: '%', token: '%', kind: 'op' }
  ],
  [
    { label: '7', token: '7', kind: 'num' },
    { label: '8', token: '8', kind: 'num' },
    { label: '9', token: '9', kind: 'num' },
    { label: '÷', token: '/', kind: 'op' },
    { label: 'Ans', token: 'ans', kind: 'const' }
  ],
  [
    { label: '4', token: '4', kind: 'num' },
    { label: '5', token: '5', kind: 'num' },
    { label: '6', token: '6', kind: 'num' },
    { label: '×', token: '*', kind: 'op' },
    { label: '±', token: '@neg', kind: 'action' }
  ],
  [
    { label: '1', token: '1', kind: 'num' },
    { label: '2', token: '2', kind: 'num' },
    { label: '3', token: '3', kind: 'num' },
    { label: '−', token: '-', kind: 'op' },
    { label: '=', token: '@equals', kind: 'eq' }
  ],
  [
    { label: '0', token: '0', kind: 'num', wide: true },
    { label: '.', token: '.', kind: 'num' },
    { label: '+', token: '+', kind: 'op' }
  ]
]

const OPS = ['+', '-', '*', '/', '^']

export function SciCalc(): JSX.Element {
  const { settings, updateSettings, addHistory, toast } = useStore()
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState('0')
  const [error, setError] = useState('')
  const ansRef = useRef<Decimal>(new Decimal(0))
  const angleMode = settings.angleMode

  const commit = useCallback((text: string): void => {
    setError('')
    setExpr((prev) => {
      if (OPS.includes(text) && prev.length > 0 && OPS.includes(prev.slice(-1))) {
        return prev.slice(0, -1) + text
      }
      return prev + text
    })
  }, [])

  const calc = useCallback((): void => {
    const raw = expr.trim()
    if (!raw) return
    try {
      const res: EvalResult = evaluate(normalizeInput(raw), angleMode, ansRef.current)
      const shown = formatNumber(res.value, {})
      setResult(shown)
      ansRef.current = res.value
      setError('')
      addHistory({
        module: 'sci',
        scene: 'calc',
        expression: toDisplayExpr(raw),
        result: shown,
        payload: { expr: raw }
      })
    } catch (e) {
      setError(e instanceof CalcError ? e.message : '表达式有误')
      setResult('')
    }
  }, [expr, angleMode, addHistory])

  const onKey = useCallback(
    (k: KeyDef): void => {
      const t = k.token
      if (t === '@angle') return updateSettings({ angleMode: angleMode === 'DEG' ? 'RAD' : 'DEG' })
      if (t === '@clear') {
        setExpr('')
        setError('')
        return
      }
      if (t === '@back') {
        setExpr((p) => p.slice(0, -1))
        setError('')
        return
      }
      if (t === '@equals') return calc()
      if (t === '@recip') {
        setExpr((p) => `1/(${p || '0'})`)
        setError('')
        return
      }
      if (t === '@neg') {
        setExpr((p) => {
          if (!p) return '-'
          const m = p.match(/(\d+\.?\d*)$/)
          if (!m) return p
          const start = p.length - m[1].length
          const before = p.slice(0, start)
          if (before.endsWith('-') && (start === 1 || /[+\-*/^(]$/.test(before.slice(0, -1)))) {
            return before.slice(0, -1) + p.slice(start)
          }
          return `${before}-${m[1]}`
        })
        setError('')
        return
      }
      commit(t)
    },
    [angleMode, calc, commit, updateSettings]
  )

  // 全局键盘：中文输入法激活时暂停
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.isComposing || e.keyCode === 229 || e.key === 'Process') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return

      const k = e.key
      if (/^[0-9]$/.test(k)) {
        e.preventDefault()
        commit(k)
      } else if (k === '.' || k === ',') {
        e.preventDefault()
        commit('.')
      } else if (['+', '-', '*', '/', '^', '%', '(', ')'].includes(k)) {
        e.preventDefault()
        commit(k)
      } else if (k === 'Enter' || k === '=') {
        e.preventDefault()
        calc()
      } else if (k === 'Backspace') {
        e.preventDefault()
        setExpr((p) => p.slice(0, -1))
        setError('')
      } else if (k === 'Escape' || k === 'Delete') {
        e.preventDefault()
        setExpr('')
        setError('')
      } else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') {
        if (result) {
          void window.cluo.copyText(result)
          toast('结果已复制', 'ok')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commit, calc, result, toast])

  const displayExpr = useMemo(() => (expr ? toDisplayExpr(expr) : ''), [expr])

  return (
    <div className="sci">
      <div className="sci-main">
        <div className="sci-display">
          <div className="sci-expr" title={displayExpr}>
            {displayExpr || <span className="ph">支持键盘直接输入 · Enter 计算 · Esc 清空</span>}
          </div>
          <div className={`sci-result ${error ? 'err' : ''}`}>{error || result || '0'}</div>
          <div className="sci-meta">
            <span className="chip">{angleMode === 'DEG' ? '角度制 DEG' : '弧度制 RAD'}</span>
            <span className="chip">Ans = {formatNumber(ansRef.current, {})}</span>
          </div>
        </div>

        <div className="keypad">
          {ROWS.map((row, ri) => (
            <div className="key-row" key={ri}>
              {row.map((k) => (
                <button
                  key={k.label}
                  type="button"
                  className={`key ${k.kind ?? ''} ${k.wide ? 'wide' : ''}`}
                  onClick={() => onKey(k)}
                >
                  {k.token === '@angle' ? angleMode : k.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <SciHistory onPick={(e) => { setExpr(e); setError('') }} />
    </div>
  )
}

function SciHistory({ onPick }: { onPick(expr: string): void }): JSX.Element {
  const { history, removeHistory, clearHistory, toast } = useStore()
  const [askClear, setAskClear] = useState(false)
  const items = history.filter((h) => h.module === 'sci')

  return (
    <aside className="sci-history">
      <div className="hist-head">
        <span>历史记录</span>
        <span className="hist-count">{items.length}/100</span>
      </div>
      <div className="hist-list">
        {items.length === 0 ? (
          <div className="empty" style={{ padding: '26px 8px' }}>
            暂无计算记录
          </div>
        ) : (
          items.map((h) => (
            <div
              className="hist-item"
              key={h.id}
              onClick={() => {
                const p = h.payload as { expr?: string } | undefined
                if (p?.expr) {
                  onPick(p.expr)
                  toast('已回填表达式，请确认后计算')
                }
              }}
            >
              <div className="hist-body">
                <div className="hist-expr">{h.expression}</div>
                <div className="hist-res">= {h.result}</div>
              </div>
              <button
                className="hist-del"
                title="删除该条"
                onClick={(e) => {
                  e.stopPropagation()
                  removeHistory(h.id)
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className="hist-foot">
        <button className="btn sm ghost" disabled={items.length === 0} onClick={() => setAskClear(true)}>
          清空全部
        </button>
      </div>
      <Confirm
        open={askClear}
        title="清空全部历史？"
        desc="将删除全部 100 条以内计算记录，此操作不可撤销。"
        confirmText="清空"
        onCancel={() => setAskClear(false)}
        onConfirm={() => {
          clearHistory()
          setAskClear(false)
          toast('历史已清空', 'ok')
        }}
      />
    </aside>
  )
}
