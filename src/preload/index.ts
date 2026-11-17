import { contextBridge, ipcRenderer } from 'electron'
import type { PersistedState, RatesResponse, WindowApi } from '../shared/types'

const api: WindowApi = {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  hide: () => ipcRenderer.send('win:hide'),
  quit: () => ipcRenderer.send('win:quit'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  loadState: () => ipcRenderer.invoke('state:load') as Promise<PersistedState>,
  saveState: (state) => ipcRenderer.invoke('state:save', state) as Promise<void>,
  fetchRates: () => ipcRenderer.invoke('rates:fetch') as Promise<RatesResponse>,
  getCachedRates: () => ipcRenderer.invoke('rates:cached') as Promise<RatesResponse>,
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text) as Promise<void>,
  startResize: (dir: string) => ipcRenderer.send('win:resize-start', dir),
  endResize: () => ipcRenderer.send('win:resize-end'),
  setUiScale: (scale: number) => ipcRenderer.send('ui:set-scale', scale),
  getUiScale: () => ipcRenderer.invoke('ui:get-scale') as Promise<number>
}

contextBridge.exposeInMainWorld('cluo', api)

ipcRenderer.on('win:maximized', (_e, isMax: boolean) => {
  window.dispatchEvent(new CustomEvent('cluo:maximized', { detail: isMax }))
})

ipcRenderer.on('nav:goto', (_e, key: string) => {
  window.dispatchEvent(new CustomEvent('cluo:nav', { detail: key }))
})

ipcRenderer.on('rates:pushed', (_e, payload: unknown) => {
  window.dispatchEvent(new CustomEvent('cluo:rates-pushed', { detail: payload }))
})

ipcRenderer.on('rates:progress', (_e, payload: unknown) => {
  window.dispatchEvent(new CustomEvent('cluo:rates-progress', { detail: payload }))
})
