import type { WebSocketServer } from 'ws'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:net'
import { WebSocket } from 'ws'
import { debugLog } from './utils'

function log(...args: any[]) {
  debugLog('[TCP Server]', ...args)
}

export function addTCPServerToWebSocketServerClass(
  wsListenPort: number,
  WSServer: typeof WebSocketServer,
): any {
  return class PHPWasmWebSocketServer extends WSServer {
    constructor(options: any, callback: any) {
      const requestedPort = options.port
      options.port = wsListenPort
      listenTCPToWSProxy({
        tcpListenPort: requestedPort,
        wsConnectPort: wsListenPort,
      })
      super(options, callback)
    }
  }
}

export interface InboundTcpToWsProxyOptions {
  tcpListenPort: number
  wsConnectHost?: string
  wsConnectPort: number
}
export function listenTCPToWSProxy(options: InboundTcpToWsProxyOptions) {
  options = {
    wsConnectHost: '127.0.0.1',
    ...options,
  }
  const { tcpListenPort, wsConnectHost, wsConnectPort } = options
  const server = createServer()
  server.on('connection', (tcpSource) => {
    const inBuffer: Buffer[] = []

    const wsTarget = new WebSocket(
      `ws://${wsConnectHost}:${wsConnectPort}/`,
    )
    wsTarget.binaryType = 'arraybuffer'
    function wsSend(data: Buffer) {
      wsTarget.send(new Uint8Array(data))
    }

    wsTarget.addEventListener('open', () => {
      log('Outbound WebSocket connection established')
      while (inBuffer.length > 0) {
        wsSend(inBuffer.shift()!)
      }
    })
    wsTarget.addEventListener('message', (e) => {
      log(
        'WS->TCP message:',
        new TextDecoder().decode(e.data as ArrayBuffer),
      )
      tcpSource.write(Buffer.from(e.data as ArrayBuffer))
    })
    wsTarget.addEventListener('close', () => {
      log('WebSocket connection closed')
      tcpSource.end()
    })

    tcpSource.on('data', (data) => {
      log('TCP->WS message:', data)
      const buf: Buffer = typeof data === 'string' ? Buffer.from(data) : data
      if (wsTarget.readyState === WebSocket.OPEN) {
        while (inBuffer.length > 0) {
          wsSend(inBuffer.shift()!)
        }
        wsSend(buf)
      }
      else {
        inBuffer.push(buf)
      }
    })
    tcpSource.once('close', () => {
      log('TCP connection closed')
      wsTarget.close()
    })
    tcpSource.on('error', () => {
      log('TCP connection error')
      wsTarget.close()
    })
  })
  server.listen(tcpListenPort, () => {
    log('TCP server listening')
  })
}
