// src/shared/ipc.ts — centralized channel names; NEVER use raw strings at call sites.
export const IPC = {
  datasource: {
    list: 'datasource:list',
    pickExisting: 'datasource:pickExisting',
    pickNewLocation: 'datasource:pickNewLocation',
    create: 'datasource:create',
    unlock: 'datasource:unlock',
    lock: 'datasource:lock',
    remove: 'datasource:remove',
    session: 'datasource:session',
  },
  tasks:    { list: 'tasks:list', create: 'tasks:create', update: 'tasks:update', remove: 'tasks:remove', toggleStatus: 'tasks:toggleStatus' },
  notes:    { list: 'notes:list', create: 'notes:create', update: 'notes:update', remove: 'notes:remove', togglePin: 'notes:togglePin' },
  search:   { query: 'search:query' },
  settings: { get: 'settings:get', update: 'settings:update' },
  shell:    { openExternal: 'shell:openExternal' },
  // main → renderer push events
  events:   { sessionChanged: 'event:sessionChanged' },
  // renderer → main, activity ping for auto-lock
  activity: { ping: 'activity:ping' },
} as const
