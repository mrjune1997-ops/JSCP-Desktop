import { app, BrowserWindow, ipcMain, clipboard, shell, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { DEFAULT_SETTINGS, type PersistedState, type RatesResponse } from '../shared/types'
import { fetchRates } from './rates'

const isDev = !!process.env['ELECTRON_RENDERER_URL']

/* ---------- 轻量化：启动前裁剪 Chromium 能力 ---------- */
// 纯 UI 计算器无需 GPU 合成，关闭后省掉整个 GPU 进程（约 100MB）
app.disableHardwareAcceleration()
// 关掉一批用不到的特性，减少内存与后台任务
app.commandLine.appendSwitch(
  'disable-features',
  [
    'MediaRouter',
    'Translate',
    'CalculateNativeWinOcclusion',
    'HardwareMediaKeyHandling',
    'GlobalMediaControls',
    'DialMediaRouteProvider',
    'WebSQL',
    'BackgroundFetch',
    'IdleDetection',
    'NotificationTriggers',
    'OptimizationHints',
    'AutofillServerCommunication',
    'InterestFeedContentSuggestions',
    'ReadingList'
  ].join(',')
)
// 禁用后台网络预测与拼写检查词典加载
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-domain-reliability')
app.commandLine.appendSwitch('no-pings')
// 单进程渲染（少一个 renderer 进程，进一步压内存）
app.commandLine.appendSwitch('process-per-site')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
/** 用户是否选择「真正退出」；只有此时才允许进程结束 */
let quitting = false
/** 当前界面缩放比例，用于按比例调整窗口尺寸 */
let uiScale = 1

/** 自定义缩放的轮询定时器与初始状态 */
let resizeTimer: NodeJS.Timeout | null = null
const MIN_W = 900
const MIN_H = 600

/** 当前生效的最小物理尺寸：随界面缩放同步放大，保证 CSS 逻辑宽度不低于 900 */
function minSize(): { w: number; h: number } {
  return { w: Math.round(MIN_W * uiScale), h: Math.round(MIN_H * uiScale) }
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

let activeResize: { dir: ResizeDir; b: Electron.Rectangle; c: Electron.Point } | null = null

function stopResize(): void {
  if (resizeTimer) {
    clearInterval(resizeTimer)
    resizeTimer = null
  }
  activeResize = null
}

/**
 * 应用界面缩放。
 *
 * 做法：zoomFactor 负责等比放大所有 UI 元素与文字（等同浏览器缩放，
 * px 尺寸、字号、间距一起变）；同时把窗口物理尺寸按同一比例调整，
 * 使 CSS 逻辑可视区保持不变 —— 放大只是「看起来更大」，不会挤掉布局。
 *
 * 以窗口中心为锚点缩放，并夹取到当前屏幕工作区内，避免窗口跑出屏幕。
 * 最大化 / 全屏时只设 zoomFactor，交给系统处理。
 */
function applyUiScale(raw: number): void {
  if (!mainWindow) return
  const s = Math.min(1.5, Math.max(0.75, Math.round((Number(raw) || 1) * 100) / 100))
  const prev = uiScale
  uiScale = s

  mainWindow.webContents.setZoomFactor(s)
  if (Math.abs(s - prev) < 0.001) return
  if (mainWindow.isMaximized() || mainWindow.isFullScreen()) return

  const b = mainWindow.getBounds()
  const ratio = s / prev

  // 以工作区为上限，避免高缩放下窗口超出屏幕
  const display = screen.getDisplayMatching(b)
  const wa = display.workArea
  const min = minSize()
  const maxW = Math.max(min.w, wa.width - 16)
  const maxH = Math.max(min.h, wa.height - 16)

  let width = Math.min(maxW, Math.max(min.w, Math.round(b.width * ratio)))
  let height = Math.min(maxH, Math.max(min.h, Math.round(b.height * ratio)))

  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  let x = Math.round(cx - width / 2)
  let y = Math.round(cy - height / 2)

  // 夹取到工作区内
  x = Math.min(Math.max(x, wa.x), Math.max(wa.x, wa.x + wa.width - width))
  y = Math.min(Math.max(y, wa.y), Math.max(wa.y, wa.y + wa.height - height))
  width = Math.min(width, wa.width)
  height = Math.min(height, wa.height)

  mainWindow.setBounds({ x, y, width, height })
}

function startResize(dir: ResizeDir): void {
  if (!mainWindow || mainWindow.isMaximized() || mainWindow.isFullScreen()) return
  stopResize()
  activeResize = {
    dir,
    b: mainWindow.getBounds(),
    c: screen.getCursorScreenPoint()
  }

  resizeTimer = setInterval(() => {
    if (!mainWindow || !activeResize) return stopResize()
    const cur = screen.getCursorScreenPoint()
    const dx = cur.x - activeResize.c.x
    const dy = cur.y - activeResize.c.y
    const b = activeResize.b
    let { x, y, width, height } = b

    if (dir.includes('e')) width = b.width + dx
    if (dir.includes('s')) height = b.height + dy
    if (dir.includes('w')) {
      width = b.width - dx
      x = b.x + dx
    }
    if (dir.includes('n')) {
      height = b.height - dy
      y = b.y + dy
    }

    // 约束最小尺寸（随缩放比例放大），并保证向左/上拖动时位置补偿
    const min = minSize()
    if (width < min.w) {
      if (dir.includes('w')) x = b.x + b.width - min.w
      width = min.w
    }
    if (height < min.h) {
      if (dir.includes('n')) y = b.y + b.height - min.h
      height = min.h
    }

    mainWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) })
  }, 12)
}

function statePath(): string {
  return join(app.getPath('userData'), 'cluo-state.json')
}

async function readState(): Promise<PersistedState> {
  try {
    const raw = await readFile(statePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 100) : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }
    }
  } catch {
    return { history: [], settings: { ...DEFAULT_SETTINGS } }
  }
}

async function writeState(state: PersistedState): Promise<void> {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  const safe: PersistedState = {
    history: (state.history ?? []).slice(0, 100),
    settings: { ...DEFAULT_SETTINGS, ...(state.settings ?? {}) }
  }
  await writeFile(statePath(), JSON.stringify(safe, null, 2), 'utf-8')
}

function resolveIcon(name: string): string {
  // 开发环境从项目 resources 读；打包后从 extraResources 读
  const base = app.isPackaged ? join(process.resourcesPath, 'icons') : join(__dirname, '../../resources')
  return join(base, name)
}

function showWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function hideToTray(): void {
  if (!mainWindow) return
  mainWindow.hide()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    // 自绘窗口需显式允许缩放与拖拽边界
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    backgroundColor: '#101317',
    title: 'JSCP',
    icon: resolveIcon('tray-256.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1,
      // 轻量化：禁用后台节流以外的开销，并关闭拼写检查
      spellcheck: false,
      backgroundThrottling: true,
      webgl: false,
      images: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })
  // 关闭按钮 = 收进托盘，不退出进程
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      hideToTray()
      tray?.displayBalloon?.({
        title: 'JSCP 仍在运行',
        content: '已最小化到托盘，右键托盘图标可打开或退出。',
        iconType: 'info'
      })
    }
  })

  mainWindow.on('maximize', () => mainWindow?.webContents.send('win:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win:maximized', false))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] as string)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: '打开主界面',
      click: () => showWindow()
    },
    {
      label: '科学计算器',
      click: () => {
        showWindow()
        mainWindow?.webContents.send('nav:goto', 'sci')
      }
    },
    {
      label: '汇率换算',
      click: () => {
        showWindow()
        mainWindow?.webContents.send('nav:goto', 'rates')
      }
    },
    { type: 'separator' },
    {
      label: '刷新中国银行牌价',
      click: async () => {
        const result = await fetchRates(true)
        mainWindow?.webContents.send('rates:pushed', result)
      }
    },
    { type: 'separator' },
    {
      label: '隐藏到托盘',
      click: () => hideToTray()
    },
    {
      label: '退出 JSCP',
      click: () => {
        quitting = true
        app.quit()
      }
    }
  ])
}

function createTray(): void {
  const image = nativeImage.createFromPath(resolveIcon('tray-32.png'))
  tray = new Tray(image.isEmpty() ? resolveIcon('tray-256.png') : image)
  tray.setToolTip('JSCP 外贸与科学计算工具')
  tray.setContextMenu(buildTrayMenu())

  // 左键单击：显示/隐藏切换（符合桌面工具习惯）
  tray.on('click', () => {
    if (!mainWindow) return
    if (mainWindow.isVisible() && !mainWindow.isMinimized()) hideToTray()
    else showWindow()
  })

  tray.on('double-click', () => showWindow())
}

app.whenReady().then(() => {
  ipcMain.on('win:minimize', () => mainWindow?.minimize())
  ipcMain.on('win:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  // 界面右上角 × 同样收进托盘
  ipcMain.on('win:close', () => hideToTray())
  ipcMain.on('win:hide', () => hideToTray())
  ipcMain.on('win:quit', () => {
    quitting = true
    app.quit()
  })
  ipcMain.on('win:resize-start', (_e, dir: ResizeDir) => startResize(dir))
  ipcMain.on('win:resize-end', () => stopResize())
  ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false)

  ipcMain.handle('state:load', () => readState())
  ipcMain.handle('state:save', (_e, state: PersistedState) => writeState(state))

  // 界面整体缩放：由渲染层滑块驱动
  // zoomFactor 让所有 UI 元素与文字等比缩放，但 CSS 可视区会被按比例压缩，
  // 所以同时把窗口物理尺寸按同比例放大/缩小，保证布局空间与缩放前一致。
  ipcMain.on('ui:set-scale', (_e, scale: number) => {
    if (!mainWindow) return
    applyUiScale(scale)
  })
  ipcMain.handle('ui:get-scale', () => uiScale)

  ipcMain.handle('rates:fetch', async (): Promise<RatesResponse> =>
    fetchRates(true, (p) => mainWindow?.webContents.send('rates:progress', p))
  )
  ipcMain.handle('rates:cached', async (): Promise<RatesResponse> => fetchRates(false))

  ipcMain.handle('clipboard:write', (_e, text: string) => {
    clipboard.writeText(String(text ?? ''))
  })

  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else showWindow()
  })
})

// 托盘常驻：窗口全关也不退出，只有 quitting=true 才真正结束进程
app.on('window-all-closed', () => {
  if (quitting) app.quit()
})

app.on('before-quit', () => {
  quitting = true
})

// 单实例：重复启动时唤出已有窗口，避免多个托盘图标
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
app.on('second-instance', () => showWindow())
