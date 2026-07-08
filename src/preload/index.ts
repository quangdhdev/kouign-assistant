import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { KouignApi } from '@shared/api'
import type { CreateTaskInput, UpdateTaskInput, TaskFilter, CreateNoteInput, UpdateNoteInput, NoteFilter, AiGenerateInput } from '@shared/types'
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

  tasks: {
    list:         (filter?: TaskFilter)                   => ipcRenderer.invoke(IPC.tasks.list, filter),
    create:       (input: CreateTaskInput)                => ipcRenderer.invoke(IPC.tasks.create, input),
    update:       (id: number, patch: UpdateTaskInput)    => ipcRenderer.invoke(IPC.tasks.update, id, patch),
    remove:       (id: number)                            => ipcRenderer.invoke(IPC.tasks.remove, id),
    toggleStatus: (id: number)                            => ipcRenderer.invoke(IPC.tasks.toggleStatus, id),
  },

  notes: {
    list:      (filter?: NoteFilter)                     => ipcRenderer.invoke(IPC.notes.list, filter),
    create:    (input: CreateNoteInput)                  => ipcRenderer.invoke(IPC.notes.create, input),
    update:    (id: number, patch: UpdateNoteInput)      => ipcRenderer.invoke(IPC.notes.update, id, patch),
    remove:    (id: number)                              => ipcRenderer.invoke(IPC.notes.remove, id),
    togglePin: (id: number)                              => ipcRenderer.invoke(IPC.notes.togglePin, id),
  },

  search: {
    query: (q) => ipcRenderer.invoke(IPC.search.query, q),
  },

  settings: {
    get: () => ipcRenderer.invoke(IPC.settings.get),
    update: (patch) => ipcRenderer.invoke(IPC.settings.update, patch),
  },

  ai: {
    status:     ()                          => ipcRenderer.invoke(IPC.ai.status),
    listModels: ()                          => ipcRenderer.invoke(IPC.ai.listModels),
    generate:   (input: AiGenerateInput)    => ipcRenderer.invoke(IPC.ai.generate, input),
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
