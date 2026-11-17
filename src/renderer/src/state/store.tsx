import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryEntry, ModuleKey, PersistedState, AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS, clampScale } from '@shared/types'

interface Toast {
  id: number
  text: string
  kind: 'info' | 'ok' | 'err'
}

interface StoreShape {
  history: HistoryEntry[]
  settings: AppSettings
  addHistory(entry: Omit<HistoryEntry, 'id' | 'ts'>): void
  removeHistory(id: string): void
  clearHistory(): void
  updateSettings(patch: Partial<AppSettings>): void
  toast(text: string, kind?: Toast['kind']): void
  toasts: Toast[]
  module: ModuleKey
  setModule(m: ModuleKey): void
  loaded: boolean
}

const Ctx = createContext<StoreShape | null>(null)

const HISTORY_LIMIT = 100

export function StoreProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [module, setModuleState] = useState<ModuleKey>('sci')
  const [loaded, setLoaded] = useState(false)
  const seq = useRef(0)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    void window.cluo
      .loadState()
      .then((s: PersistedState) => {
        if (!alive) return
        setHistory(s.history ?? [])
        setSettings({ ...DEFAULT_SETTINGS, ...s.settings })
        setModuleState(s.settings?.lastModule ?? 'sci')
      })
      .finally(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [])

  // 持久化：去抖 400ms，避免高频写入
  useEffect(() => {
    if (!loaded) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void window.cluo.saveState({ history, settings })
    }, 400)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [history, settings, loaded])

  // 主题应用：写 data-theme 到根节点，CSS 变量随之切换
  useEffect(() => {
    const theme = settings.theme ?? 'dark'
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('jscp.theme', theme)
  }, [settings.theme])

  // 界面缩放：交给主进程 setZoomFactor，Chromium 会等比放大所有元素与文字
  useEffect(() => {
    const scale = clampScale(settings.uiScale ?? 1)
    window.cluo.setUiScale(scale)
    window.localStorage.setItem('jscp.scale', String(scale))
  }, [settings.uiScale])
  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++seq.current
    setToasts((prev) => [...prev, { id, text, kind }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2600)
  }, [])

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'id' | 'ts'>) => {
    const full: HistoryEntry = { ...entry, id: `${Date.now()}-${++seq.current}`, ts: Date.now() }
    setHistory((prev) => {
      const next = [full, ...prev]
      return next.length > HISTORY_LIMIT ? next.slice(0, HISTORY_LIMIT) : next
    })
  }, [])

  const removeHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id))
  }, [])

  const clearHistory = useCallback(() => setHistory([]), [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const setModule = useCallback((m: ModuleKey) => {
    setModuleState(m)
    setSettings((prev) => ({ ...prev, lastModule: m }))
  }, [])

  // 托盘菜单跳转
  useEffect(() => {
    const onNav = (e: Event): void => {
      const key = (e as CustomEvent<string>).detail as ModuleKey
      if (key) setModule(key)
    }
    window.addEventListener('cluo:nav', onNav)
    return () => window.removeEventListener('cluo:nav', onNav)
  }, [setModule])

  const value = useMemo<StoreShape>(
    () => ({
      history,
      settings,
      addHistory,
      removeHistory,
      clearHistory,
      updateSettings,
      toast,
      toasts,
      module,
      setModule,
      loaded
    }),
    [history, settings, addHistory, removeHistory, clearHistory, updateSettings, toast, toasts, module, setModule, loaded]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreShape {
  const v = useContext(Ctx)
  if (!v) throw new Error('StoreProvider missing')
  return v
}
