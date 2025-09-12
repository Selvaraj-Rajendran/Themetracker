#!/usr/bin/env node
/**
 * ThemeTracker Live Server
 * Enhanced HTTP server with configuration support and built-in WebSocket
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { ConfigLoader } = require('./config/config-loader')
const { FileScanner } = require('./utils/file-scanner')

// Get project and package roots from environment or defaults
const PROJECT_ROOT = process.env.THEMETRACKER_PROJECT_ROOT || process.cwd()
const PACKAGE_ROOT = process.env.THEMETRACKER_PACKAGE_ROOT || path.dirname(__dirname)

// Store current audit data
let currentAuditData = {}
let currentComponentsMetrics = {}
let connectedClients = new Set()
let configLoader = null
let config = null

/**
 * Simple WebSocket implementation using Node.js built-ins
 */
class SimpleWebSocket {
  constructor(socket) {
    this.socket = socket
    this.isConnected = true

    socket.on('close', () => {
      this.isConnected = false
      connectedClients.delete(this)
    })

    socket.on('error', () => {
      this.isConnected = false
      connectedClients.delete(this)
    })
  }

  send(data) {
    if (!this.isConnected) return

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      const length = Buffer.byteLength(message)

      let frame
      if (length < 126) {
        frame = Buffer.allocUnsafe(2 + length)
        frame[0] = 0x81 // FIN + text frame
        frame[1] = length
        Buffer.from(message).copy(frame, 2)
      } else if (length < 65536) {
        frame = Buffer.allocUnsafe(4 + length)
        frame[0] = 0x81 // FIN + text frame
        frame[1] = 126
        frame.writeUInt16BE(length, 2)
        Buffer.from(message).copy(frame, 4)
      } else {
        frame = Buffer.allocUnsafe(10 + length)
        frame[0] = 0x81 // FIN + text frame
        frame[1] = 127
        frame.writeUInt32BE(0, 2)
        frame.writeUInt32BE(length, 6)
        Buffer.from(message).copy(frame, 10)
      }

      this.socket.write(frame)
    } catch (error) {
      console.error('Error sending WebSocket message:', error)
      this.isConnected = false
      connectedClients.delete(this)
    }
  }

  close() {
    this.isConnected = false
    this.socket.end()
    connectedClients.delete(this)
  }
}

/**
 * Parse WebSocket frame
 */
const parseWebSocketFrame = (buffer) => {
  if (buffer.length < 2) return null

  const firstByte = buffer[0]
  const secondByte = buffer[1]

  const opCode = firstByte & 0x0f
  const masked = (secondByte & 0x80) === 0x80

  if (opCode !== 0x01) return null // Only handle text frames

  let payloadLength = secondByte & 0x7f
  let offset = 2

  if (payloadLength === 126) {
    if (buffer.length < 4) return null
    payloadLength = buffer.readUInt16BE(2)
    offset = 4
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null
    payloadLength = buffer.readUInt32BE(6)
    offset = 10
  }

  if (buffer.length < offset + (masked ? 4 : 0) + payloadLength) return null

  let payload
  if (masked) {
    const maskingKey = buffer.slice(offset, offset + 4)
    offset += 4
    payload = buffer.slice(offset, offset + payloadLength)
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskingKey[i % 4]
    }
  } else {
    payload = buffer.slice(offset, offset + payloadLength)
  }

  return payload.toString('utf8')
}

/**
 * Handle WebSocket upgrade
 */
const handleWebSocketUpgrade = (request, socket) => {
  const key = request.headers['sec-websocket-key']
  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64')

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    ''
  ].join('\r\n')

  socket.write(responseHeaders)

  const ws = new SimpleWebSocket(socket)
  connectedClients.add(ws)

  console.log(`🔌 WebSocket client connected (${connectedClients.size} total)`)

  // Send initial data
  ws.send(JSON.stringify({
    type: 'INITIAL_DATA',
    data: {
      auditData: currentAuditData,
      componentsMetrics: currentComponentsMetrics,
      config: {
        projectRoot: PROJECT_ROOT,
        serverConfig: config?.server || {}
      }
    }
  }))

  let buffer = Buffer.alloc(0)

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data])

    try {
      const message = parseWebSocketFrame(buffer)
      if (message) {
        handleWebSocketMessage(ws, JSON.parse(message))
        buffer = Buffer.alloc(0)
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error)
    }
  })

  socket.on('close', () => {
    console.log(`🔌 WebSocket client disconnected (${connectedClients.size} total)`)
  })
}

/**
 * Handle WebSocket messages
 */
const handleWebSocketMessage = async (ws, message) => {
  try {
    console.log(`📨 WebSocket message: ${message.type}`)

    switch (message.type) {
      case 'AUDIT_FILE':
        await handleAuditFile(ws, message.payload)
        break
      case 'AUDIT_ALL':
        await handleAuditAll(ws)
        break
      case 'GET_COVERAGE_METRICS':
        await handleGetCoverageMetrics(ws)
        break
      case 'RUN_COMPONENTS_ANALYSIS':
        await handleRunComponentsAnalysis(ws)
        break
      case 'GET_FILE_LIST':
        await handleGetFileList(ws)
        break
      default:
        console.warn(`Unknown WebSocket message type: ${message.type}`)
    }
  } catch (error) {
    console.error('Error handling WebSocket message:', error)
    ws.send(JSON.stringify({
      type: 'ERROR',
      error: error.message
    }))
  }
}

/**
 * Handle audit file request
 */
const handleAuditFile = async (ws, payload) => {
  const { filePath } = payload
  
  ws.send(JSON.stringify({
    type: 'AUDIT_STARTED',
    filePath
  }))

  try {
    // Use the configurable audit engine
    const { analyzeFile } = require('./engines/audit-engine')
    const result = await analyzeFile(filePath, config)

    currentAuditData[filePath] = result

    ws.send(JSON.stringify({
      type: 'AUDIT_COMPLETED',
      filePath,
      result
    }))

    // Broadcast to all clients
    broadcastToClients({
      type: 'AUDIT_UPDATE',
      filePath,
      result
    })

  } catch (error) {
    console.error(`Error auditing file ${filePath}:`, error)
    ws.send(JSON.stringify({
      type: 'AUDIT_ERROR',
      filePath,
      error: error.message
    }))
  }
}

/**
 * Handle audit all files request
 */
const handleAuditAll = async (ws) => {
  try {
    const fileScanner = new FileScanner(configLoader)
    const files = await fileScanner.scanProject(PROJECT_ROOT)

    console.log(`🚀 Starting audit for ${files.length} files`)
    
    // Clear existing audit data
    currentAuditData = {}
    
    const { auditFile } = require('./engines/audit-engine')
    
    // Process each file individually to maintain compatibility with original client
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const relativePath = file.replace(PROJECT_ROOT + '/', '')
      
      try {
        const result = await auditFile(file, config)
        
        // Store result globally
        currentAuditData[relativePath] = result
        
        // Send individual file completion (compatible with original client)
        ws.send(JSON.stringify({
          type: 'AUDIT_COMPLETED',
          filePath: relativePath,
          result: result
        }))
        
        console.log(`📊 Processed ${i + 1}/${files.length} files`)
        
      } catch (fileError) {
        console.error(`Error auditing ${relativePath}:`, fileError)
        ws.send(JSON.stringify({
          type: 'AUDIT_ERROR',
          filePath: relativePath,
          error: fileError.message
        }))
      }
    }

    console.log(`✅ Audit completed: ${files.length} files processed`)
    
    // Send completion message to UI
    ws.send(JSON.stringify({
      type: 'AUDIT_ALL_COMPLETED',
      filesProcessed: files.length,
      totalResults: Object.keys(currentAuditData).length
    }))

  } catch (error) {
    console.error('Error auditing all files:', error)
    ws.send(JSON.stringify({
      type: 'AUDIT_ERROR',
      error: error.message
    }))
  }
}

/**
 * Handle coverage metrics request
 */
const handleGetCoverageMetrics = async (ws) => {
  try {
    const { DashboardEngine } = require('./engines/dashboard-engine')
    const engine = new DashboardEngine(PROJECT_ROOT, config)
    const analytics = await engine.generateDashboardAnalytics(currentAuditData)

    ws.send(JSON.stringify({
      type: 'COVERAGE_METRICS',
      data: analytics
    }))

  } catch (error) {
    console.error('Error generating dashboard analytics:', error)
    ws.send(JSON.stringify({
      type: 'COVERAGE_METRICS_ERROR',
      error: error.message
    }))
  }
}

/**
 * Handle components analysis request
 */
const handleRunComponentsAnalysis = async (ws) => {
  try {
    console.log('🧩 Running unified dashboard components analysis...')
    
    // Use the unified dashboard engine for components analysis
    const { DashboardEngine } = require('./engines/dashboard-engine')
    const engine = new DashboardEngine(PROJECT_ROOT, config)
    const analytics = await engine.generateDashboardAnalytics(currentAuditData)
    
    // Extract just the components data for this specific request
    const componentsData = {
      ...analytics.components,
      frameworkType: config?.analysis?.frameworkType || 'react',
      enabled: analytics.components.enabled
    }

    currentComponentsMetrics = componentsData

    ws.send(JSON.stringify({
      type: 'COMPONENTS_METRICS',
      data: componentsData
    }))

  } catch (error) {
    console.error('Error running components analysis:', error)
    ws.send(JSON.stringify({
      type: 'COMPONENTS_METRICS_ERROR',
      error: error.message
    }))
  }
}

/**
 * Handle get file list request
 */
const handleGetFileList = async (ws) => {
  try {
    const fileScanner = new FileScanner(configLoader)
    const files = await fileScanner.scanProject(PROJECT_ROOT)
    
    // Convert absolute paths to relative paths (as strings, not objects)
    const relativeFiles = files.map(filePath => {
      return filePath.replace(PROJECT_ROOT + '/', '')
    })

    ws.send(JSON.stringify({
      type: 'FILE_LIST',
      files: relativeFiles,
      stats: fileScanner.getStats()
    }))

  } catch (error) {
    console.error('Error getting file list:', error)
    ws.send(JSON.stringify({
      type: 'FILE_LIST_ERROR',
      error: error.message
    }))
  }
}

/**
 * Broadcast message to all connected clients
 */
const broadcastToClients = (message) => {
  connectedClients.forEach(client => {
    if (client.isConnected) {
      client.send(message)
    }
  })
}

/**
 * Serve static files
 */
const serveStaticFile = (filePath, res) => {
  try {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css', 
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    }[ext] || 'text/plain'

    const content = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(content)

  } catch (error) {
    console.error(`Error serving file ${filePath}:`, error)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
}

/**
 * Create and configure the server
 */
const createServer = async (serverConfig = {}) => {
  // Initialize configuration
  configLoader = new ConfigLoader(PROJECT_ROOT)
  config = await configLoader.loadConfig()

  // Override config with server options
  if (serverConfig.port) config.server.port = serverConfig.port
  if (serverConfig.host) config.server.host = serverConfig.host

  const PORT = config.server.port
  const HOST = config.server.host

  console.log(`🚀 Starting ThemeTracker server...`)
  console.log(`📂 Project root: ${PROJECT_ROOT}`)
  console.log(`📦 Package root: ${PACKAGE_ROOT}`)
  console.log(`🎨 Dew config: ${config.dewConfig.tokensPath || 'Not found'}`)

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${HOST}:${PORT}`)
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    // Route requests
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const indexPath = path.join(PACKAGE_ROOT, 'assets', 'ui', 'index.html')
      serveStaticFile(indexPath, res)
    } else if (url.pathname === '/summary' || url.pathname === '/src/summary.html') {
      const summaryPath = path.join(PACKAGE_ROOT, 'assets', 'ui', 'src', 'summary.html')
      serveStaticFile(summaryPath, res)
    } else if (url.pathname === '/api/files') {
      // API endpoint for file list
      handleApiFiles(req, res)
    } else if (url.pathname === '/api/config') {
      // API endpoint for configuration
      handleApiConfig(req, res)
    } else {
      // Serve other static files
      const filePath = path.join(PACKAGE_ROOT, 'assets', 'ui', url.pathname)
      serveStaticFile(filePath, res)
    }
  })

  // Handle WebSocket upgrades
  server.on('upgrade', (request, socket, head) => {
    if (request.headers.upgrade === 'websocket') {
      handleWebSocketUpgrade(request, socket)
    }
  })

  return new Promise((resolve, reject) => {
    server.listen(PORT, HOST, (error) => {
      if (error) {
        reject(error)
        return
      }

      console.log(`✅ ThemeTracker Live server running!`)
      console.log(`🌐 Dashboard: http://${HOST}:${PORT}`)
      console.log(`📊 Summary: http://${HOST}:${PORT}/summary`)
      console.log(`🔌 WebSocket: ws://${HOST}:${PORT}`)
      console.log(`\n💡 Press Ctrl+C to stop`)
      console.log('')

      resolve(server)
    })
  })
}

/**
 * API endpoint for file list
 */
const handleApiFiles = async (req, res) => {
  try {
    const fileScanner = new FileScanner(configLoader)
    const files = await fileScanner.scanProject(PROJECT_ROOT)
    const stats = fileScanner.getStats()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      files: files.map(f => path.relative(PROJECT_ROOT, f)),
      stats
    }))
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: error.message }))
  }
}

/**
 * API endpoint for configuration
 */
const handleApiConfig = (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    projectRoot: PROJECT_ROOT,
    config: {
      dewConfig: config.dewConfig,
      sourceDirectories: config.sourceDirectories,
      server: config.server
    }
  }))
}

// Start server if called directly
if (require.main === module) {
  createServer().catch(error => {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  })
}

module.exports = { createServer }
