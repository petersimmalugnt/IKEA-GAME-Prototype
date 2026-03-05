import { WebSocketServer, WebSocket } from 'ws'

const CURSOR_WS_PATH = '/ws/cursor'

export function cursorRelayPlugin() {
  /** @type {Set<WebSocket>} */
  const clients = new Set()

  return {
    name: 'cursor-relay',
    configureServer(server) {
      const httpServer = server.httpServer
      if (!httpServer) return

      const wss = new WebSocketServer({ noServer: true })

      wss.on('connection', (ws) => {
        clients.add(ws)

        ws.on('message', (data) => {
          const raw = typeof data === 'string' ? data : data.toString('utf8')
          clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(raw)
            }
          })
        })

        ws.on('close', () => {
          clients.delete(ws)
        })

        ws.on('error', () => {
          clients.delete(ws)
        })
      })

      httpServer.on('upgrade', (request, socket, head) => {
        const url = request.url ?? ''
        const pathname = url.split('?')[0]
        if (pathname !== CURSOR_WS_PATH) return

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request)
        })
      })
    },
  }
}
