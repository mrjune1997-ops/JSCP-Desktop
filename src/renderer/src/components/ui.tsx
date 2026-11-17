import { useEffect, useRef, useState } from 'react'

/** 千分位输入框：仅允许数字、小数点、负号，展示时分组 */
export interface NumberInputProps {
  value: string
  onChange(v: string): void
  placeholder?: string
  suffix?: string
  disabled?: boolean
  autoFocus?: boolean
  onEnter?(): void
  className?: string
  maxDecimals?: number
  allowNegative?: boolean
  /** 展示千分位（默认 true） */
  grouping?: boolean
}

function formatWithGrouping(raw: string): string {
  if (raw === '' || raw === '-' || raw === '.') return raw
  const neg = raw.startsWith('-')
  const body = neg ? raw.slice(1) : raw
  const [ip, fp] = body.split('.')
  const grouped = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}${grouped}${fp !== undefined ? `.${fp}` : body.endsWith('.') ? '.' : ''}`
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  suffix,
  disabled,
  autoFocus,
  onEnter,
  className = '',
  maxDecimals,
  allowNegative = false,
  grouping = true
}: NumberInputProps): JSX.Element {
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const display = focused ? value : grouping ? formatWithGrouping(value) : value

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    let v = e.target.value.replace(/,/g, '').replace(/\s/g, '')
    // 只保留首位负号
    const neg = allowNegative && v.startsWith('-')
    v = v.replace(/-/g, '')
    if (neg) v = `-${v}`
    // 过滤非法字符
    if (!/^-?\d*(\.\d*)?$/.test(v)) return
    if (maxDecimals !== undefined && v.includes('.')) {
      const [ip, fp] = v.split('.')
      if (fp.length > maxDecimals) return
      if (ip.replace('-', '').length > 15) return
      onChange(v)
      return
    }
    if (v.replace('-', '').replace('.', '').length > 18) return
    onChange(v)
  }

  return (
    <div className={`numbox ${className}`}>
      <input
        ref={ref}
        className="input"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="decimal"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter?.()
          }
        }}
      />
      {suffix ? <span className="numbox-suffix">{suffix}</span> : null}
    </div>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange
}: {
  options: { label: string; value: T }[]
  value: T
  onChange(v: T): void
}): JSX.Element {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({
  label,
  children,
  hint
}: {
  label: string
  children: React.ReactNode
  hint?: React.ReactNode
}): JSX.Element {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  )
}

export function KV({
  k,
  v,
  strong,
  muted,
  copy
}: {
  k: string
  v: React.ReactNode
  strong?: boolean
  muted?: boolean
  copy?: string
}): JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className={`v ${strong ? 'strong' : ''} ${muted ? 'muted' : ''}`}>
        {v}
        {copy !== undefined ? (
          <button
            className="copy-btn"
            title="复制"
            onClick={() => {
              void window.cluo.copyText(copy)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1200)
            }}
          >
            {copied ? '已复制' : '复制'}
          </button>
        ) : null}
      </span>
    </div>
  )
}

export function Confirm({
  open,
  title,
  desc,
  confirmText = '确认',
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  desc: string
  confirmText?: string
  onConfirm(): void
  onCancel(): void
}): JSX.Element | null {
  if (!open) return null
  return (
    <div className="modal" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{desc}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn primary" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
