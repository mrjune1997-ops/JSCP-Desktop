import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './modules.css'

// 首帧主题：在 React 挂载前应用，避免启动瞬间颜色闪变
const cachedTheme = window.localStorage.getItem('jscp.theme')
document.documentElement.dataset.theme = cachedTheme === 'light' ? 'light' : 'dark'

// 首帧缩放：同样在挂载前下发，避免启动时先看到 100% 再跳变
const cachedScale = Number(window.localStorage.getItem('jscp.scale') || '1')
if (Number.isFinite(cachedScale) && cachedScale !== 1) {
  window.cluo.setUiScale(cachedScale)
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
