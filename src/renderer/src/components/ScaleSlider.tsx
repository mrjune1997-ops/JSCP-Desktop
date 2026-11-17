import { useCallback, useEffect, useRef, useState } from 'react'
import { UI_SCALE_MAX, UI_SCALE_MIN, clampScale, UI_SCALE_STEP } from '@shared/types'
import { useStore } from '../state/store'

/**
 * 底栏 UI 缩放滑块。
 *
 * 拖动时通过主进程 setZoomFactor 让整页元素与文字等比缩放；
 * 松手写回 settings 持久化。双击回到 100%。
 */
export function ScaleSlider(): JSX.Element {
  const { settings, updateSettings } = useStore()
  const scale = clampScale(settings.uiScale ?? 1)
  const [dragging, setDragging] = useState(false)
  const [live, setLive] = useState(scale)
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef<number | null>(null)

  // 外部值变化时同步本地显示（如双击复位）
  useEffect(() => {
    if (!dragging) setLive(scale)
  }, [scale, dragging])

  // 用 rAF 合帧，避免拖动时每像素都触发一次 IPC
  const applyLive = useCallback((v: number) => {
    pendingRef.current = v
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const next = pendingRef.current
      if (next === null) return
      window.cluo.setUiScale(next)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const pct = Math.round(live * 100)

  return (
    <div className="scale-slider" title="拖动调整界面整体显示比例（双击回到 100%）">
      <svg className="scale-ico sm" width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path
          d="M2.5 8h11"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="4.6" cy="8" r="1.5" fill="currentColor" />
        <circle cx="11.4" cy="8" r="1.5" fill="currentColor" />
      </svg>

      <input
        className="scale-range"
        type="range"
        min={UI_SCALE_MIN}
        max={UI_SCALE_MAX}
        step={UI_SCALE_STEP}
        value={live}
        aria-label="界面缩放比例"
        onChange={(e) => {
          const v = clampScale(e.target.value)
          setLive(v)
          applyLive(v)
        }}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => {
          setDragging(false)
          updateSettings({ uiScale: clampScale(live) })
        }}
        onPointerCancel={() => {
          setDragging(false)
          updateSettings({ uiScale: clampScale(live) })
        }}
        onBlur={() => {
          if (dragging) {
            setDragging(false)
            updateSettings({ uiScale: clampScale(live) })
          }
        }}
        onDoubleClick={() => {
          setLive(1)
          applyLive(1)
          updateSettings({ uiScale: 1 })
        }}
      />

      <svg className="scale-ico lg" width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 8h12"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="4" cy="8" r="1.8" fill="currentColor" />
        <circle cx="12" cy="8" r="1.8" fill="currentColor" />
      </svg>

      <span className="scale-val">{pct}%</span>
    </div>
  )
}
