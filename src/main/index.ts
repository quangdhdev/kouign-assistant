import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'

// Import shared types to prove @shared alias resolves in main process
import type { Placeholder as _Placeholder } from '@shared/types'

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

  // Security: deny all in-app navigation / new-window requests.
  // OS-level link routing (http/https/slack) will be added in Phase 2 shell IPC.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // Gracefully show window once ready to paint (avoids white flash)
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Prevent in-page navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url)
    if (parsedUrl.origin !== 'http://localhost') {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // Load the renderer
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
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
