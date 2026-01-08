import type { Buffer } from 'node:buffer'
import * as dns from 'node:dns'
import * as http from 'node:http'
import * as net from 'node:net'
import process from 'node:process'
import * as util from 'node:util'
import { WebSocketServer } from 'ws'
import { debugLog } from './utils'

function log(...args: any[]) {
  debugLog('[WS Server]', ...args)
}

const lookup = util.promisify(dns.lookup)

function prependByte(
  chunk: string | ArrayBuffer | ArrayLike<number>,
  byte: number,
) {
  if (typeof chunk === 'string') {
    chunk = String.fromCharCode(byte) + chunk
  }
  else if (
    chunk instanceof ArrayBuffer
    || 'byteLength' in chunk /* for Node.js */
  ) {
    const buffer = new Uint8Array((chunk as ArrayBuffer).byteLength + 1)
    buffer[0] = byte
    buffer.set(new Uint8Array(chunk), 1)
    chunk = buffer.buffer
  }
  else {
    log({ chunk })
    throw new Error(`Unsupported chunk type: ${typeof chunk}`)
  }
  return chunk
}

/**
 * Send a chunk of data to the remote server.
 */
export const COMMAND_CHUNK = 0x01
/**
 * Set a TCP socket option.
 */
export const COMMAND_SET_SOCKETOPT = 0x02

/**
 * Adds support for TCP socket options to WebSocket class.
 *
 * Socket options are implemented by adopting a specific data transmission
 * protocol between WS client and WS server The first byte
 * of every message is a command type, and the remaining bytes
 * are the actual data.
 *
 * @param  WebSocketConstructor
 * @returns Decorated constructor
 */
export function addSocketOptionsSupportToWebSocketClass(
  WebSocketConstructor: typeof WebSocket,
) {
  return class PHPWasmWebSocketConstructor extends WebSocketConstructor {
    // @ts-expect-error --- IGNORE ---
    send(chunk: any, callback: any) {
      return this.sendCommand(COMMAND_CHUNK, chunk, callback)
    }

    setSocketOpt(
      optionClass: number,
      optionName: number,
      optionValue: number,
    ) {
      return this.sendCommand(
        COMMAND_SET_SOCKETOPT,
        new Uint8Array([optionClass, optionName, optionValue]).buffer,
        () => undefined,
      )
    }

    sendCommand(
      commandType: number,
      chunk: string | ArrayBuffer | ArrayLike<number>,
      callback: any,
    ) {
      return (WebSocketConstructor.prototype.send as any).call(
        this,
        prependByte(chunk, commandType),
        callback,
      )
    }
  }
}

export function initOutboundWebsocketProxyServer(
  listenPort: number,
  listenHost = '127.0.0.1',
): Promise<http.Server> {
  log(`Binding the WebSockets server to ${listenHost}:${listenPort}...`)
  const webServer = http.createServer((request, response) => {
    response.writeHead(403, { 'Content-Type': 'text/plain' })
    response.write(
      '403 Permission Denied\nOnly websockets are allowed here.\n',
    )
    response.end()
  })
  return new Promise((resolve) => {
    webServer.listen(listenPort, listenHost, () => {
      const wsServer = new WebSocketServer({ server: webServer })
      wsServer.on('connection', onWsConnect)
      resolve(webServer)
    })
  })
}

// Handle new WebSocket client
async function onWsConnect(client: any, request: http.IncomingMessage) {
  const clientAddr = client?._socket?.remoteAddress || client.url
  const clientLog = function (...args: any[]) {
    log(` ${clientAddr}: `, ...args)
  }

  clientLog(
    `WebSocket connection from : ${
      clientAddr
    } at URL ${
      request ? request.url : client.upgradeReq.url}`,
  )
  clientLog(
    `Version ${
      client.protocolVersion
    }, subprotocol: ${
      client.protocol}`,
  )

  // Parse the search params (the host doesn't matter):
  const reqUrl = new URL(`ws://0.0.0.0${request.url}`)
  const reqTargetPort = Number(reqUrl.searchParams.get('port'))
  const reqTargetHost = reqUrl.searchParams.get('host')
  if (!reqTargetPort || !reqTargetHost) {
    clientLog('Missing host or port information')
    client.close(3000)
    return
  }

  // Validate port range
  if (reqTargetPort < 0 || reqTargetPort > 65535) {
    clientLog(`Invalid port number: ${reqTargetPort}`)
    // Send empty binary data to notify requester that connection failed
    client.send([])
    client.close(3000)
    return
  }

  let target: any
  const recvQueue: Buffer[] = []
  function flushMessagesQueue() {
    while (recvQueue.length > 0) {
      const msg = recvQueue.pop()! as Buffer
      const commandType = msg[0]
      clientLog('flushing', { commandType }, msg)
      if (commandType === COMMAND_CHUNK) {
        target.write(msg.slice(1))
      }
      else if (commandType === COMMAND_SET_SOCKETOPT) {
        const SOL_SOCKET = 1
        const SO_KEEPALIVE = 9

        const IPPROTO_TCP = 6
        const TCP_NODELAY = 1
        if (msg[1] === SOL_SOCKET && msg[2] === SO_KEEPALIVE) {
          target.setKeepAlive(msg[3])
        }
        else if (msg[1] === IPPROTO_TCP && msg[2] === TCP_NODELAY) {
          target.setNoDelay(msg[3])
        }
      }
      else {
        clientLog(`Unknown command type: ${commandType}`)
        process.exit()
      }
    }
  }

  client.on('message', (msg: Buffer) => {
    // clientLog('PHP -> network buffer:', msg);
    recvQueue.unshift(msg)
    if (target) {
      flushMessagesQueue()
    }
  })
  client.on('close', function (code: any, reason: any) {
    clientLog(
      `WebSocket client disconnected: ${code} [${reason}]`,
    )
    if (target) {
      target.end()
    }
  } as any)
  client.on('error', (a: string | Buffer) => {
    clientLog(`WebSocket client error: ${a}`)
    target.end()
  })

  // Resolve the target host to an IP address if it isn't one already
  let reqTargetIp
  if (net.isIP(reqTargetHost) === 0) {
    clientLog(`resolving ${reqTargetHost}... `)
    try {
      const resolution = await lookup(reqTargetHost)
      reqTargetIp = resolution.address
      clientLog(`resolved ${reqTargetHost} -> ${reqTargetIp}`)
    }
    catch (e) {
      clientLog(`can't resolve ${reqTargetHost} due to:`, e)
      // Send empty binary data to notify requester that connection was
      // initiated
      client.send([])
      // Without this random timeout, PHP sometimes doesn't notice the socket
      // disconnected. TODO: figure out why.
      setTimeout(() => {
        client.close(3000)
      })
      return
    }
  }
  else {
    reqTargetIp = reqTargetHost
  }
  clientLog(
    `Opening a socket connection to ${reqTargetIp}:${reqTargetPort}`,
  )
  target = net.createConnection(reqTargetPort, reqTargetIp, () => {
    clientLog('Connected to target')
    flushMessagesQueue()
  })
  target.on('data', (data: any) => {
    try {
      client.send(data)
    }
    catch {
      clientLog('Client closed, cleaning up target')
      target.end()
    }
  })
  target.on('end', () => {
    clientLog('target disconnected')
    client.close()
  })
  target.on('error', (e: any) => {
    clientLog('target connection error', e)
    client.send([])
    // Without this random timeout, PHP sometimes doesn't notice the socket
    // disconnected. TODO: figure out why.
    setTimeout(() => {
      client.close(3000)
      try {
        target.end()
      }
      catch {
        // Ignore
      }
    })
  })
}
