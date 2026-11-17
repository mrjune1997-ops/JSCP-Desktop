import type { WindowApi } from '../shared/types'

declare global {
  interface Window {
    cluo: WindowApi
  }
}

export {}
