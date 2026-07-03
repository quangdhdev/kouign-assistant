import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { KouignApi } from '@shared/api'
import { IPC } from '@shared/ipc'

const api: KouignApi = {
  datasource: {
    list: () => ipcRenderer.invoke(IPC.datasource.list),
    pickExisting: () => ipcRenderer.invoke(IPC.datasource.pickExisting),
    pickNewLocation: (defaultName) => ipcRenderer.invoke(IPC.datasource.pickNewLocation, defaultName),
    create: (input) => ipcRenderer.invoke(IPC.datasource.create, input),
    unlock: (input) => ipcRenderer.invoke(IPC.datasource.unlock, input),
    lock: () => ipcRenderer.invoke(IPC.datasource.lock),
    remove: (path) => ipcRenderer.invoke(IPC.datasource.remove, path),
    session: () => ipcRenderer.invoke(IPC.datasource.session),
  },

  tasks: {},

  notes: {},

  search: {
    query: (q) => ipcRenderer.invoke(IPC.search.query, q),
  },

  settings: {
    get: () => ipcRenderer.invoke(IPC.settings.get),
    update: (patch) => ipcRenderer.invoke(IPC.settings.update, patch),
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke(IPC.shell.openExternal, url),
  },

  onSessionChanged(cb) {
    const listener = (_event: IpcRendererEvent, state: Parameters<typeof cb>[0]) => cb(state)
    ipcRenderer.on(IPC.events.sessionChanged, listener)
    return () => {
      ipcRenderer.removeListener(IPC.events.sessionChanged, listener)
    }
  },

  pingActivity() {
    ipcRenderer.send(IPC.activity.ping)
  },
}

contextBridge.exposeInMainWorld('api', api)
