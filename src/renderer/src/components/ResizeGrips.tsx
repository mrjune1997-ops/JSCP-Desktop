import { useEffect } from 'react'

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const ZONES: { dir: Dir; style: React.CSSProperties }[] = [
  { dir: 'n', style: { top: 0, left: 8, right: 8, height: 4, cursor: 'ns-resize' } },
  { dir: 's', style: { bottom: 0, left: 8, right: 8, height: 4, cursor: 'ns-resize' } },
  { dir: 'w', style: { top: 8, bottom: 8, left: 0, width: 4, cursor: 'ew-resize' } },
  { dir: 'e', style: { top: 8, bottom: 8, right: 0, width: 4, cursor: 'ew-resize' } },
  { dir: 'nw', style: { top: 0, left: 0, width: 9, height: 9, cursor: 'nwse-resize' } },
  { dir: 'ne', style: { top: 0, right: 0, width: 9, height: 9, cursor: 'nesw-resize' } },
  { dir: 'sw', style: { bottom: 0, left: 0, width: 9, height: 9, cursor: 'nesw-resize' } },
  { dir: 'se', style: { bottom: 0, right: 0, width: 9, height: 9, cursor: 'nwse-resize' } }
]

/**
 * 无边框窗口的 8 向缩放热区。
 * 按下后由主进程轮询光标位置实时 setBounds，保证任意方向拖拽都跟手。
 */
export function ResizeGrips(): JSX.Element {
  useEffect(() => {
    const end = (): void => window.cluo.endResize()
    window.addEventListener('mouseup', end)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('mouseup', end)
      window.removeEventListener('blur', end)
    }
  }, [])

  return (
    <>
      {ZONES.map((z) => (
        <div
          key={z.dir}
          className="resize-grip"
          style={{ position: 'fixed', zIndex: 400, WebkitAppRegion: 'no-drag', ...z.style } as React.CSSProperties}
          onMouseDown={(e) => {
            e.preventDefault()
            window.cluo.startResize(z.dir)
          }}
        />
      ))}
    </>
  )
}
