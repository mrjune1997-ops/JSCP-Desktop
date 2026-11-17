import { useEffect, useState } from 'react'
import type { ModuleKey } from '@shared/types'
import { APP_NAME, APP_VERSION_TAG, AUTHOR } from '@shared/version'
import { StoreProvider, useStore } from './state/store'
import { ResizeGrips } from './components/ResizeGrips'
import { ScaleSlider } from './components/ScaleSlider'
import { SciCalc } from './modules/SciCalc'
import { RatesModule } from './modules/RatesModule'
import { TradeModule } from './modules/TradeModule'
import { UnitsModule } from './modules/UnitsModule'
import { ClockModule } from './modules/ClockModule'

const NAV: { key: ModuleKey; label: string; icon: string; desc: string }[] = [
  { key: 'sci', label: '科学计算', icon: '∑', desc: '默认首页 · 支持键盘直接输入' },
  { key: 'rates', label: '汇率换算', icon: '¥', desc: '中国银行现汇买入价 · 最多 10 个币种' },
  { key: 'trade', label: '外贸计算', icon: '⬢', desc: 'CBM · 体积重 · 税额 · 退税 · 进口税 · 货款比例' },
  { key: 'units', label: '单位换算', icon: '⇄', desc: '长度 · 重量 · 体积 · 面积 · 容量 · 温度 · 百分比' },
  { key: 'clock', label: '时差时钟', icon: '◷', desc: '最多 4 城 · IANA 时区 · 自动夏令时' }
]

function WindowControls(): JSX.Element {
  const [max, setMax] = useState(false)

  useEffect(() => {
    void window.cluo.isMaximized().then(setMax)
    const on = (e: Event): void => setMax(!!(e as CustomEvent<boolean>).detail)
    window.addEventListener('cluo:maximized', on)
    return () => window.removeEventListener('cluo:maximized', on)
  }, [])

  return (
    <div className="win-ctrl">
      <button title="最小化" onClick={() => window.cluo.minimize()}>
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M2 5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </button>
      <button title={max ? '还原' : '最大化'} onClick={() => window.cluo.maximize()}>
        {max ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="3" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M3.5 3V1.5h5.5v5.5H7.5" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        )}
      </button>
      <button
        className="danger"
        title="最小化到托盘（可右键托盘图标退出）"
        onClick={() => window.cluo.close()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

function ThemeSwitch(): JSX.Element {
  const { settings, updateSettings } = useStore()
  const theme = settings.theme ?? 'dark'

  return (
    <div className="theme-switch" title="切换亮色 / 暗色外观">
      <button
        className={`sun ${theme === 'light' ? 'on' : ''}`}
        title="亮色（日间）"
        aria-label="亮色主题"
        onClick={() => updateSettings({ theme: 'light' })}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3.3" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6" />
            <path d="M3.2 3.2l1.13 1.13M11.67 11.67l1.13 1.13M12.8 3.2l-1.13 1.13M4.33 11.67L3.2 12.8" />
          </g>
        </svg>
      </button>
      <button
        className={`moon ${theme === 'dark' ? 'on' : ''}`}
        title="暗色（夜间）"
        aria-label="暗色主题"
        onClick={() => updateSettings({ theme: 'dark' })}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path
            d="M13.4 10.3A5.9 5.9 0 0 1 5.7 2.6a5.9 5.9 0 1 0 7.7 7.7z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

function Toasts(): JSX.Element {
  const { toasts } = useStore()
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div className={`toast ${t.kind}`} key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

function Shell(): JSX.Element {
  const { module, setModule, settings, updateSettings } = useStore()
  const cur = NAV.find((n) => n.key === module) ?? NAV[0]
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app">
      <ResizeGrips />
      <div className="titlebar">
        <div className="brand">
          <span className="logo">J</span>
          {APP_NAME}
        </div>
        <span className="sub">外贸与科学计算工具</span>
        <div className="spacer" />
        <ThemeSwitch />
        <button className="btn sm ghost" style={{ marginRight: 8 }} onClick={() => setSettingsOpen((v) => !v)}>
          精度设置
        </button>
        <WindowControls />
        {settingsOpen ? (
          <div className="settings-pop" onMouseLeave={() => setSettingsOpen(false)}>
            <div className="settings-row">
              <span>金额小数位</span>
              <div className="seg">
                {([2, 4] as const).map((d) => (
                  <button
                    key={d}
                    className={settings.amountDecimals === d ? 'on' : ''}
                    onClick={() => updateSettings({ amountDecimals: d })}
                  >
                    {d} 位
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <span>长度/重量小数位</span>
              <div className="seg">
                {([2, 4, 6] as const).map((d) => (
                  <button
                    key={d}
                    className={settings.unitDecimals === d ? 'on' : ''}
                    onClick={() => updateSettings({ unitDecimals: d })}
                  >
                    {d} 位
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-note">
              运算内核为十进制（decimal），统一四舍五入 half-up；相邻菜单互不影响。关闭窗口会收进系统托盘，右键托盘图标可退出进程。
            </div>
          </div>
        ) : null}
      </div>

      <div className="body">
        <nav className="sidebar">
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${n.key === module ? 'active' : ''}`}
              onClick={() => setModule(n.key)}
              title={n.desc}
            >
              <span className="ico">{n.icon}</span>
              {n.label}
            </button>
          ))}
          <div className="fill" />
          <div className="tray-hint">
            关闭窗口
            <br />
            仍在托盘运行
          </div>
        </nav>

        <main className="panel">
          <div className="panel-head">
            <div>
              <h1>{cur.label}</h1>
              <div className="desc">{cur.desc}</div>
            </div>
            <div className="spacer" />
            <span className="chip">{APP_NAME} {APP_VERSION_TAG}</span>
          </div>
          {module === 'sci' ? (
            <SciCalc />
          ) : module === 'rates' ? (
            <RatesModule />
          ) : module === 'trade' ? (
            <TradeModule />
          ) : module === 'units' ? (
            <UnitsModule />
          ) : (
            <ClockModule />
          )}
        </main>
      </div>

      <footer className="app-footer">
        <span className="ft-author">
          作者：{AUTHOR.name}　联系：{AUTHOR.contact}
        </span>
        <span className="ft-dot">·</span>
        <span className="ft-free">{AUTHOR.label}</span>
        <span className="ft-spacer" />
        <ScaleSlider />
        <span className="ft-sep" />
        <span className="ft-ver">
          {APP_NAME} {APP_VERSION_TAG}
        </span>
      </footer>

      <Toasts />
    </div>
  )
}

export default function App(): JSX.Element {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
