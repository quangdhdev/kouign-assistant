import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerDatasourceHandlers } from './ipc/datasource'
import { registerSettingsHandlers } from './ipc/settings'
import { registerShellHandlers } from './ipc/shell'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Kouign Assistant',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  // Security: deny in-app new-window requests; route external links through allowlisted openExternal.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const allowed = ['http:', 'https:', 'slack:']
    try {
      const protocol = new URL(url).protocol
      if (allowed.includes(protocol)) {
        shell.openExternal(url)
      }
    } catch {
      // ignore malformed URLs
    }
    return { action: 'deny' }
  })

  // Prevent in-page navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url)
    if (parsedUrl.origin !== 'http://localhost') {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // Gracefully show window once ready to paint (avoids white flash)
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Load the renderer
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Register all IPC handlers before creating the window
  registerDatasourceHandlers()
  registerSettingsHandlers()
  registerShellHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
