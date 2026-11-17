/** 全局共享类型定义 */

export type ModuleKey = 'sci' | 'rates' | 'trade' | 'units' | 'clock'

export interface HistoryEntry {
  id: string
  module: ModuleKey
  /** 模块内的场景/子页，如 cbm、vat、length */
  scene: string
  /** 展示用表达式或参数摘要 */
  expression: string
  /** 展示用结果文本 */
  result: string
  /** 毫秒时间戳 */
  ts: number
  /** 结构化数据，用于回填 */
  payload?: unknown
  /** 汇率类记录：当时牌价与刷新时间 */
  rateMeta?: { code: string; price: number; updatedAt: string }
}

/** 单条外币牌价：price 为「1 单位外币 = X 人民币」的现汇买入价 */
export interface RateEntry {
  code: string
  name: string
  /** 现汇买入价，已除以 100，保留原始精度 */
  price: string
  /** 中行页面原始报价（每 100 外币） */
  rawPrice: string
  publishTime?: string
}

export interface RateSnapshot {
  entries: RateEntry[]
  /** 抓取完成时间，展示用 YYYY-MM-DD HH:mm */
  updatedAt: string
  source: string
  /** 中行页面发布时间 */
  publishTime?: string
}

/** 抓取进度（逐页） */
export interface CrawlProgress {
  page: number
  totalPages: number
  found: number
}

export interface RatesResponse {
  ok: boolean
  snapshot: RateSnapshot | null
  /** ok=false 时说明失败原因（面向用户的文案） */
  message?: string
  /** 是否为本地缓存数据 */
  cached?: boolean
}

export interface AppSettings {
  /** 金额展示小数位 2 | 4 */
  amountDecimals: 2 | 4
  /** 长度/重量/体积结果小数位 2 | 4 | 6 */
  unitDecimals: 2 | 4 | 6
  /** 科学计算器默认角度单位 */
  angleMode: 'DEG' | 'RAD'
  /** 上次停留页面 */
  lastModule: ModuleKey
  /** 界面主题：暗色 / 亮色 */
  theme: ThemeMode
  /** 界面整体缩放比例：0.75 ~ 1.5，1 为原始大小 */
  uiScale: number
}

export type ThemeMode = 'dark' | 'light'

/** 界面缩放范围（与主进程 ui:set-scale 保持一致） */
export const UI_SCALE_MIN = 0.75
export const UI_SCALE_MAX = 1.5
export const UI_SCALE_STEP = 0.05

/** 把任意输入夹取到合法缩放区间 */
export function clampScale(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 1
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(n * 100) / 100))
}

export const DEFAULT_SETTINGS: AppSettings = {
  amountDecimals: 2,
  unitDecimals: 4,
  angleMode: 'DEG',
  lastModule: 'sci',
  theme: 'dark',
  uiScale: 1
}

export interface PersistedState {
  history: HistoryEntry[]
  settings: AppSettings
}

export interface WindowApi {
  minimize(): void
  maximize(): void
  /** 收进托盘（不退出进程） */
  close(): void
  hide(): void
  /** 真正退出进程 */
  quit(): void
  isMaximized(): Promise<boolean>
  loadState(): Promise<PersistedState>
  saveState(state: PersistedState): Promise<void>
  fetchRates(): Promise<RatesResponse>
  getCachedRates(): Promise<RatesResponse>
  copyText(text: string): Promise<void>
  /** 开始自定义拖拽缩放（n/s/e/w/ne/nw/se/sw） */
  startResize(dir: string): void
  endResize(): void
  /** 设置界面整体缩放比例（0.75 ~ 1.5） */
  setUiScale(scale: number): void
  getUiScale(): Promise<number>
}
