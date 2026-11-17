import { useEffect, useMemo, useRef, useState } from 'react'

interface City {
  zone: string
  name: string
}

/** 预设常用贸易城市（可按需扩展），映射到 IANA 时区，禁止写死固定偏移 */
const PRESETS: City[] = [
  { zone: 'Asia/Shanghai', name: '北京' },
  { zone: 'Asia/Hong_Kong', name: '中国香港' },
  { zone: 'Asia/Taipei', name: '中国台北' },
  { zone: 'Asia/Tokyo', name: '东京' },
  { zone: 'Asia/Seoul', name: '首尔' },
  { zone: 'Asia/Singapore', name: '新加坡' },
  { zone: 'Asia/Bangkok', name: '曼谷' },
  { zone: 'Asia/Dubai', name: '迪拜' },
  { zone: 'Asia/Kolkata', name: '孟买' },
  { zone: 'Europe/London', name: '伦敦' },
  { zone: 'Europe/Paris', name: '巴黎' },
  { zone: 'Europe/Berlin', name: '柏林' },
  { zone: 'Europe/Moscow', name: '莫斯科' },
  { zone: 'America/New_York', name: '纽约' },
  { zone: 'America/Chicago', name: '芝加哥' },
  { zone: 'America/Los_Angeles', name: '洛杉矶' },
  { zone: 'America/Sao_Paulo', name: '圣保罗' },
  { zone: 'Australia/Sydney', name: '悉尼' },
  { zone: 'Pacific/Auckland', name: '奥克兰' }
]

const MAX_CITIES = 4
const STORE_KEY = 'cluo.clock.cities'

function loadCities(): City[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return [PRESETS[0], PRESETS[13]]
    const arr = JSON.parse(raw) as City[]
    if (!Array.isArray(arr) || arr.length === 0) return [PRESETS[0], PRESETS[13]]
    return arr.slice(0, MAX_CITIES).filter((c) => PRESETS.some((p) => p.zone === c.zone))
  } catch {
    return [PRESETS[0], PRESETS[13]]
  }
}

/** 取某时区相对 UTC 的偏移分钟数（含夏令时） */
function zoneOffsetMinutes(zone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const parts = dtf.formatToParts(at)
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return Math.round((asUTC - Math.floor(at.getTime() / 1000) * 1000) / 60000)
}

function partsIn(zone: string, at: Date): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const p = dtf.formatToParts(at)
  const g = (t: string): number => Number(p.find((x) => x.type === t)?.value ?? 0)
  return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour') % 24, mi: g('minute'), s: g('second') }
}

function dayDiff(a: { y: number; mo: number; d: number }, b: { y: number; mo: number; d: number }): number {
  const t1 = Date.UTC(a.y, a.mo - 1, a.d)
  const t2 = Date.UTC(b.y, b.mo - 1, b.d)
  return Math.round((t1 - t2) / 86400000)
}

function fmtOffset(min: number): string {
  const sign = min < 0 ? '-' : '+'
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function diffLabel(diffMin: number): string {
  if (diffMin === 0) return '同一时间'
  const sign = diffMin > 0 ? '+' : '-'
  const abs = Math.abs(diffMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h} 小时${m ? ` ${m} 分` : ''}`
}

export function ClockModule(): JSX.Element {
  const [cities, setCities] = useState<City[]>(loadCities)
  const [now, setNow] = useState(() => new Date())
  const [baseZone, setBaseZone] = useState<string>('LOCAL')
  const [pickerOpen, setPickerOpen] = useState(false)
  const timer = useRef<number | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(cities))
  }, [cities])

  // 定时刷新；页面不可见时暂停，回来立即校时
  useEffect(() => {
    const tick = (): void => setNow(new Date())
    const start = (): void => {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = window.setInterval(tick, 1000)
    }
    const stop = (): void => {
      if (timer.current) {
        window.clearInterval(timer.current)
        timer.current = null
      }
    }
    const onVis = (): void => {
      if (document.hidden) stop()
      else {
        tick()
        start()
      }
    }
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    if (pickerOpen) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  const baseOffset = useMemo(() => {
    if (baseZone === 'LOCAL') return -now.getTimezoneOffset()
    return zoneOffsetMinutes(baseZone, now)
  }, [baseZone, now])

  const baseParts = useMemo(() => {
    if (baseZone === 'LOCAL') {
      return { y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate(), h: now.getHours(), mi: now.getMinutes(), s: now.getSeconds() }
    }
    return partsIn(baseZone, now)
  }, [baseZone, now])

  const addCity = (c: City): void => {
    if (cities.length >= MAX_CITIES) return
    if (cities.some((x) => x.zone === c.zone)) return
    setCities((prev) => [...prev, c])
    setPickerOpen(false)
  }

  const atLimit = cities.length >= MAX_CITIES
  const addable = PRESETS.filter((p) => !cities.some((c) => c.zone === p.zone))

  return (
    <div className="clock">
      <div className="clock-head">
        <div>
          <h2>时差时钟</h2>
          <p>最多 4 个城市 · 按 IANA 时区自动处理夏令时</p>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="hint">基准：</span>
          <select className="select" style={{ width: 150 }} value={baseZone} onChange={(e) => setBaseZone(e.target.value)}>
            <option value="LOCAL">本地时间</option>
            {cities.map((c) => (
              <option key={c.zone} value={c.zone}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="clock-grid">
        {cities.map((c) => {
          const off = zoneOffsetMinutes(c.zone, now)
          const p = partsIn(c.zone, now)
          const dd = dayDiff(p, baseParts)
          const dayLabel = dd === 0 ? '今天' : dd === 1 ? '明天' : dd === -1 ? '昨天' : dd > 0 ? `+${dd} 天` : `${dd} 天`
          const diff = off - baseOffset
          return (
            <div className="clock-card" key={c.zone}>
              <div className="clock-card-head">
                <div>
                  <div className="city">{c.name}</div>
                  <div className="zone">{c.zone}</div>
                </div>
                <button
                  className="mini del"
                  title="移除该城市"
                  onClick={() => setCities((prev) => prev.filter((x) => x.zone !== c.zone))}
                >
                  ×
                </button>
              </div>
              <div className="clock-time">
                {String(p.h).padStart(2, '0')}
                <span className="colon">:</span>
                {String(p.mi).padStart(2, '0')}
                <span className="sec">:{String(p.s).padStart(2, '0')}</span>
              </div>
              <div className="clock-date">
                {p.y}-{String(p.mo).padStart(2, '0')}-{String(p.d).padStart(2, '0')}
                <span className={`day-chip ${dd === 0 ? '' : dd > 0 ? 'ahead' : 'behind'}`}>{dayLabel}</span>
              </div>
              <div className="clock-meta">
                <span className="chip">{fmtOffset(off)}</span>
                <span className={`chip ${diff === 0 ? '' : 'brand'}`}>{diffLabel(diff)}</span>
              </div>
            </div>
          )
        })}

        {!atLimit ? (
          <div className="clock-add-wrap" ref={pickerRef}>
            <button className="clock-add" onClick={() => setPickerOpen((v) => !v)}>
              <span className="plus">＋</span>
              <span>添加城市</span>
              <span className="cnt">{cities.length}/{MAX_CITIES}</span>
            </button>
            {pickerOpen ? (
              <div className="picker" style={{ left: 0, right: 'auto', width: 240 }}>
                <div className="picker-head">选择城市（{addable.length}）</div>
                <div className="picker-list">
                  {addable.map((c) => (
                    <button key={c.zone} className="picker-item" onClick={() => addCity(c)}>
                      <span className="nm">{c.name}</span>
                      <span className="tag">{c.zone.split('/')[1]?.replace(/_/g, ' ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="clock-add-wrap">
            <div className="clock-add disabled">已达上限，最多 4 个</div>
          </div>
        )}
      </div>

      <div className="clock-foot hint">
        夏令时由系统时区数据库（IANA）自动处理，跨夏令时切换不会产生 1 小时偏差。页面不可见时暂停走秒，返回时立即校时。
      </div>
    </div>
  )
}
