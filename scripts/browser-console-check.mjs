#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/'
const debugPort = Number(process.env.CDP_PORT || '9222')
const listenMs = Number(process.env.CONSOLE_LISTEN_MS || '5000')

if (typeof WebSocket === 'undefined') {
  console.error('[console-check] Global WebSocket is missing. Use Node 20+.')
  process.exit(1)
}

const chromeBinary = detectChromeBinary()
if (!chromeBinary) {
  console.error('[console-check] Could not find Chrome/Chromium binary on this machine.')
  process.exit(1)
}

const profileDir = mkdtempSync(join(tmpdir(), 'console-check-'))
const chromeArgs = [
  '--headless=new',
  '--disable-gpu',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  targetUrl,
]

const chromeProcess = spawn(chromeBinary, chromeArgs, { stdio: 'ignore' })
let cleanedUp = false

const cleanup = () => {
  if (cleanedUp) return
  cleanedUp = true
  try {
    if (chromeProcess && !chromeProcess.killed) chromeProcess.kill('SIGTERM')
  } catch {
    // Ignore shutdown race conditions.
  }
  try {
    rmSync(profileDir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    })
  } catch {
    // Ignore temp dir cleanup failures.
  }
}

process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})
process.on('SIGTERM', () => {
  cleanup()
  process.exit(143)
})

try {
  const websocketUrl = await waitForWebSocketUrl(debugPort)
  if (!websocketUrl) {
    throw new Error(`Could not connect to Chrome DevTools on port ${debugPort}.`)
  }

  console.log(`[console-check] Connected to ${targetUrl}`)
  console.log(`[console-check] Streaming console for ${listenMs}ms`)
  await streamConsole(websocketUrl, listenMs)
} catch (error) {
  console.error(`[console-check] ${error.message}`)
  process.exitCode = 1
} finally {
  cleanup()
}

function detectChromeBinary() {
  const candidates = []

  if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium')
  } else if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    candidates.push(`${programFiles}\\Google\\Chrome\\Application\\chrome.exe`)
    candidates.push(`${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`)
    candidates.push(`${programFiles}\\Chromium\\Application\\chrome.exe`)
  } else {
    candidates.push(commandPath('google-chrome'))
    candidates.push(commandPath('chromium-browser'))
    candidates.push(commandPath('chromium'))
  }

  return candidates.find(Boolean) || null
}

function commandPath(command) {
  const result = spawnSync('which', [command], { encoding: 'utf8' })
  if (result.status !== 0) return null
  const found = result.stdout.trim()
  return found.length > 0 ? found : null
}

async function waitForWebSocketUrl(port, retries = 40, retryDelayMs = 200) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`)
      if (response.ok) {
        const pages = await response.json()
        const firstPage = pages.find((page) => page.type === 'page')
        if (firstPage?.webSocketDebuggerUrl) {
          return firstPage.webSocketDebuggerUrl
        }
      }
    } catch {
      // Retry until timeout.
    }
    await delay(retryDelayMs)
  }
  return null
}

function formatConsoleArg(arg) {
  if (!arg) return ''
  if (Object.prototype.hasOwnProperty.call(arg, 'value')) return String(arg.value)
  return arg.description || `[${arg.type || 'unknown'}]`
}

async function streamConsole(websocketUrl, durationMs) {
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(websocketUrl)
    let nextId = 1

    const send = (method, params = {}) => {
      socket.send(JSON.stringify({ id: nextId++, method, params }))
    }

    const closeTimer = setTimeout(() => {
      try {
        socket.close()
      } catch {
        resolve()
      }
    }, durationMs)

    socket.addEventListener('open', () => {
      send('Runtime.enable')
      send('Page.enable')
    })

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.method === 'Runtime.consoleAPICalled') {
          const logType = message.params?.type || 'log'
          const args = (message.params?.args || []).map(formatConsoleArg).join(' ')
          console.log(`[console.${logType}] ${args}`)
        }

        if (message.method === 'Runtime.exceptionThrown') {
          const details = message.params?.exceptionDetails
          const text =
            details?.exception?.description ||
            details?.text ||
            'Uncaught exception'
          console.log(`[exception] ${text}`)
        }
      } catch {
        // Ignore malformed CDP events.
      }
    })

    socket.addEventListener('error', () => {
      clearTimeout(closeTimer)
      reject(new Error('WebSocket connection failed.'))
    })

    socket.addEventListener('close', () => {
      clearTimeout(closeTimer)
      resolve()
    })
  })
}
