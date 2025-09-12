#!/usr/bin/env node
/**
 * ThemeTracker Live Server
 * HTTP server with built-in WebSocket support (no external dependencies)
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { analyzeFile, getTargetDirectoryFiles } = require('./audit-engine')
const { generateCoverageMetrics } = require('./files-coverage-engine')
const { ComponentsMetricsEngine } = require('./components-metrics-engine')

const PORT = 3001

// Store current audit data
let currentAuditData = {}
let currentComponentsMetrics = {}
let connectedClients = new Set()

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
    payloadLength = buffer.readUInt16BE(2)
    offset = 4
  } else if (payloadLength === 127) {
    payloadLength = buffer.readUInt32BE(6)
    offset = 10
  }

  if (masked) {
    const maskKey = buffer.slice(offset, offset + 4)
    offset += 4

    const payload = buffer.slice(offset, offset + payloadLength)
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4]
    }

    return payload.toString('utf8')
  }

  return buffer.slice(offset, offset + payloadLength).toString('utf8')
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

  console.log(`🔗 Client connected. Total clients: ${connectedClients.size}`)

  // Send current audit data to new client
  ws.send(
    JSON.stringify({
      type: 'INITIAL_DATA',
      data: currentAuditData,
      timestamp: new Date().toISOString()
    })
  )

  // Send current components metrics to new client if available
  if (currentComponentsMetrics && Object.keys(currentComponentsMetrics).length > 0) {
    console.log('📤 Sending existing components metrics to new client')
    ws.send(
      JSON.stringify({
        type: 'COMPONENTS_METRICS',
        data: currentComponentsMetrics,
        timestamp: new Date().toISOString()
      })
    )
  } else {
    console.log('📭 No existing components metrics to send to new client')
  }

  // Handle incoming messages
  let buffer = Buffer.alloc(0)

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data])

    while (buffer.length >= 2) {
      try {
        const message = parseWebSocketFrame(buffer)
        if (message) {
          handleWebSocketMessage(JSON.parse(message), ws)
          buffer = Buffer.alloc(0) // Reset buffer after processing
          break
        } else {
          break // Wait for more data
        }
      } catch (error) {
        console.error('Error parsing WebSocket frame:', error)
        buffer = Buffer.alloc(0)
        break
      }
    }
  })

  socket.on('close', () => {
    console.log(`❌ Client disconnected. Total clients: ${connectedClients.size}`)
  })
}

/**
 * Handle WebSocket messages
 */
const handleWebSocketMessage = async (message, ws) => {
  try {
    const { type, payload } = message

    switch (type) {
      case 'AUDIT_FILE':
        await handleAuditFile(payload.filePath)
        break

      case 'AUDIT_DIRECTORY':
        await handleAuditDirectory(payload.directoryPath)
        break

      case 'AUDIT_ALL':
        await handleAuditAll()
        break

      case 'GET_FILE_LIST':
        await handleGetFileList()
        break

      case 'GET_SUMMARY_DATA':
      case 'GET_COVERAGE_METRICS':
        await handleGetCoverageMetrics(ws)
        break

      case 'GET_COMPONENTS_METRICS':
        await handleGetComponentsMetrics(ws)
        break

      case 'RUN_COMPONENTS_ANALYSIS':
        await handleRunComponentsAnalysis(ws)
        break

      default:
        console.log(`Unknown message type: ${type}`)
    }
  } catch (error) {
    console.error('Error handling WebSocket message:', error)
    ws.send(
      JSON.stringify({
        type: 'ERROR',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    )
  }
}

/**
 * Broadcast message to all connected clients
 */
const broadcast = (message) => {
  const data = JSON.stringify(message)
  connectedClients.forEach((client) => {
    if (client.isConnected) {
      client.send(data)
    }
  })
}

/**
 * Handle audit single file request
 */
const handleAuditFile = async (filePath) => {
  console.log(`🔍 Auditing file: ${filePath}`)

  broadcast({
    type: 'AUDIT_STARTED',
    filePath,
    timestamp: new Date().toISOString()
  })

  try {
    // Convert relative path to absolute path if needed
    let absoluteFilePath = filePath
    if (!path.isAbsolute(filePath)) {
      const projectRoot = path.join(__dirname, '../../')
      absoluteFilePath = path.join(projectRoot, filePath)
    }

    const result = await analyzeFile(absoluteFilePath)

    // Update current audit data
    currentAuditData[filePath] = result

    // Broadcast result
    broadcast({
      type: 'AUDIT_COMPLETED',
      filePath,
      result,
      timestamp: new Date().toISOString()
    })

    console.log(`✅ Completed audit for: ${filePath} (${result.coverage}% coverage)`)
  } catch (error) {
    console.error(`❌ Error auditing ${filePath}:`, error)

    broadcast({
      type: 'AUDIT_ERROR',
      filePath,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Handle audit directory request
 */
const handleAuditDirectory = async (directoryPath) => {
  console.log(`📁 Auditing directory: ${directoryPath}`)

  try {
    // If the directory path includes components or pages, use target directory filtering
    const projectRoot = path.join(__dirname, '../../')
    let files

    if (directoryPath.includes('/components') || directoryPath.includes('/pages')) {
      files = getTargetDirectoryFiles(projectRoot)
      // Filter to only files in the requested directory
      files = files.filter((f) => f.includes(directoryPath))
    } else {
      // For other directories, use the target directory function but filter
      files = getTargetDirectoryFiles(projectRoot)
    }

    broadcast({
      type: 'AUDIT_BATCH_STARTED',
      directoryPath,
      totalFiles: files.length,
      timestamp: new Date().toISOString()
    })

    for (let i = 0; i < files.length; i++) {
      const absoluteFilePath = files[i]
      // Convert to relative path for consistent handling
      const relativeFilePath = path.relative(projectRoot, absoluteFilePath)
      await handleAuditFile(relativeFilePath)

      // Send progress update
      broadcast({
        type: 'AUDIT_BATCH_PROGRESS',
        directoryPath,
        completed: i + 1,
        total: files.length,
        progress: Math.round(((i + 1) / files.length) * 100),
        timestamp: new Date().toISOString()
      })
    }

    broadcast({
      type: 'AUDIT_BATCH_COMPLETED',
      directoryPath,
      totalFiles: files.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error(`❌ Error auditing directory ${directoryPath}:`, error)

    broadcast({
      type: 'AUDIT_BATCH_ERROR',
      directoryPath,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Handle audit all files request
 */
const handleAuditAll = async () => {
  // Go up one level from theme-tracker to the main project directory
  const projectRoot = path.join(__dirname, '../../')
  const srcDir = path.join(projectRoot, 'src')

  // Start both file auditing and component analysis in parallel
  console.log('🚀 Starting parallel analysis: File auditing + Component metrics...')

  // Notify clients that component analysis is starting
  broadcast({
    type: 'COMPONENTS_ANALYSIS_STARTED',
    timestamp: new Date().toISOString()
  })

  // Run both operations in parallel
  const [auditResult, componentsResult] = await Promise.allSettled([
    // File auditing
    handleAuditDirectory(srcDir),

    // Component analysis (in parallel)
    (async () => {
      try {
        console.log('🧩 Running components analysis in parallel...')
        const projectRoot = path.join(__dirname, '../../')
        const srcPath = path.join(projectRoot, 'src')
        const engine = new ComponentsMetricsEngine(srcPath)
        const metrics = await engine.generateMetrics()
        currentComponentsMetrics = metrics

        // Broadcast components metrics to all connected clients
        broadcast({
          type: 'COMPONENTS_METRICS',
          data: metrics,
          timestamp: new Date().toISOString()
        })

        console.log('✅ Components analysis completed in parallel')
        return metrics
      } catch (error) {
        console.error('❌ Error running components analysis in parallel:', error)

        broadcast({
          type: 'COMPONENTS_ANALYSIS_ERROR',
          error: error.message,
          timestamp: new Date().toISOString()
        })
        throw error
      }
    })()
  ])

  // Log results
  if (auditResult.status === 'fulfilled') {
    console.log('✅ File auditing completed successfully')
  } else {
    console.error('❌ File auditing failed:', auditResult.reason)
  }

  if (componentsResult.status === 'fulfilled') {
    console.log('✅ Component analysis completed successfully')
  } else {
    console.error('❌ Component analysis failed:', componentsResult.reason)
  }

  console.log('🎉 Parallel analysis completed!')
}

/**
 * Handle get file list request
 */
const handleGetFileList = async () => {
  try {
    // Go up one level from theme-tracker to the main project directory
    const projectRoot = path.join(__dirname, '../../')
    const files = getTargetDirectoryFiles(projectRoot)

    broadcast({
      type: 'FILE_LIST',
      files: files.map((f) => path.relative(projectRoot, f)),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error getting file list:', error)

    broadcast({
      type: 'FILE_LIST_ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Handle get coverage metrics request
 */
const handleGetCoverageMetrics = async (ws) => {
  try {
    console.log('📊 Generating coverage metrics...')
    console.log('📊 Current audit data keys:', Object.keys(currentAuditData))
    console.log('📊 Current audit data count:', Object.keys(currentAuditData).length)

    const coverageMetrics = generateCoverageMetrics(currentAuditData)
    console.log('📊 Generated metrics overview:', coverageMetrics.overview)

    ws.send(
      JSON.stringify({
        type: 'COVERAGE_METRICS',
        data: coverageMetrics,
        timestamp: new Date().toISOString()
      })
    )

    console.log('✅ Coverage metrics sent to client')
  } catch (error) {
    console.error('❌ Error generating coverage metrics:', error)
    console.error('❌ Error stack:', error.stack)

    ws.send(
      JSON.stringify({
        type: 'COVERAGE_METRICS_ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    )
  }
}

/**
 * Handle get components metrics request
 */
const handleGetComponentsMetrics = async (ws) => {
  try {
    console.log('🧩 Getting components metrics...')

    // If we don't have current metrics in memory, try to load from file
    if (!currentComponentsMetrics || Object.keys(currentComponentsMetrics).length === 0) {
      console.log('📂 Loading components metrics from file...')
      const reportsDir = path.join(__dirname, '../reports')
      const metricsFile = path.join(reportsDir, 'components-metrics.json')

      if (fs.existsSync(metricsFile)) {
        try {
          const fileData = fs.readFileSync(metricsFile, 'utf8')
          currentComponentsMetrics = JSON.parse(fileData)
          console.log('✅ Components metrics loaded from file')
        } catch (fileError) {
          console.warn('⚠️ Could not parse components metrics file:', fileError.message)
          currentComponentsMetrics = {}
        }
      } else {
        console.log('📄 No existing components metrics file found')
        currentComponentsMetrics = {}
      }
    }

    ws.send(
      JSON.stringify({
        type: 'COMPONENTS_METRICS',
        data: currentComponentsMetrics,
        timestamp: new Date().toISOString()
      })
    )

    console.log('✅ Components metrics sent to client')
  } catch (error) {
    console.error('❌ Error sending components metrics:', error)

    ws.send(
      JSON.stringify({
        type: 'COMPONENTS_METRICS_ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    )
  }
}

/**
 * Handle run components analysis request
 */
const handleRunComponentsAnalysis = async (ws) => {
  try {
    console.log('🧩 Starting components analysis...')

    // Notify client that analysis is starting
    ws.send(
      JSON.stringify({
        type: 'COMPONENTS_ANALYSIS_STARTED',
        timestamp: new Date().toISOString()
      })
    )

    // Run components metrics engine
    const projectRoot = path.join(__dirname, '../../')
    const srcPath = path.join(projectRoot, 'src')
    const engine = new ComponentsMetricsEngine(srcPath)
    const metrics = await engine.generateMetrics()

    // Store the results
    currentComponentsMetrics = metrics

    // Send results to client
    ws.send(
      JSON.stringify({
        type: 'COMPONENTS_METRICS',
        data: metrics,
        timestamp: new Date().toISOString()
      })
    )

    // Broadcast to all connected clients
    connectedClients.forEach((client) => {
      if (client !== ws && client.isConnected) {
        client.send(
          JSON.stringify({
            type: 'COMPONENTS_METRICS',
            data: metrics,
            timestamp: new Date().toISOString()
          })
        )
      }
    })

    console.log('✅ Components analysis completed and sent to clients')
    console.log(
      `📊 Analyzed ${metrics.summary.totalPages} pages, ${metrics.summary.totalUniqueComponents} unique components`
    )
  } catch (error) {
    console.error('❌ Error running components analysis:', error)

    ws.send(
      JSON.stringify({
        type: 'COMPONENTS_ANALYSIS_ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    )
  }
}

/**
 * Serve static files
 */
const serveStaticFile = (filePath, response) => {
  try {
    const fullPath = path.join(__dirname, '../ui', filePath)

    if (!fs.existsSync(fullPath)) {
      response.writeHead(404, { 'Content-Type': 'text/plain' })
      response.end('File not found')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType =
      {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
      }[ext] || 'text/plain'

    const content = fs.readFileSync(fullPath)
    response.writeHead(200, { 'Content-Type': contentType })
    response.end(content)
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain' })
    response.end('Internal Server Error')
  }
}

/**
 * Create HTTP server
 */
const server = http.createServer((request, response) => {
  let url = request.url === '/' ? '/index.html' : request.url

  // Handle summary route
  if (url === '/summary') {
    url = '/src/summary.html'
  }

  if (url === '/api/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(
      JSON.stringify({
        status: 'running',
        clients: connectedClients.size,
        timestamp: new Date().toISOString()
      })
    )
  } else if (url === '/api/audit-data') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(currentAuditData))
  } else {
    serveStaticFile(url, response)
  }
})

// Handle WebSocket upgrades
server.on('upgrade', handleWebSocketUpgrade)

/**
 * Initialize server data from existing files
 */
const initializeServerData = () => {
  console.log('📂 Initializing server data...')

  // Load existing components metrics if available
  const reportsDir = path.join(__dirname, '../reports')
  const metricsFile = path.join(reportsDir, 'components-metrics.json')

  if (fs.existsSync(metricsFile)) {
    try {
      const fileData = fs.readFileSync(metricsFile, 'utf8')
      currentComponentsMetrics = JSON.parse(fileData)
      console.log('✅ Loaded existing components metrics from file')
      console.log(
        `📊 Found metrics for ${
          Object.keys(currentComponentsMetrics.pageMetrics || {}).length
        } pages`
      )
    } catch (error) {
      console.warn('⚠️ Could not load components metrics file:', error.message)
      currentComponentsMetrics = {}
    }
  } else {
    console.log('📄 No existing components metrics found')
    currentComponentsMetrics = {}
  }
}

/**
 * Start the server
 */
const startServer = () => {
  // Initialize data before starting server
  initializeServerData()

  server.listen(PORT, () => {
    console.log('🚀 ThemeTracker Live Server Started')
    console.log('═'.repeat(50))
    console.log(`📊 Dashboard: http://localhost:${PORT}`)
    console.log(`🔧 API Health: http://localhost:${PORT}/api/health`)
    console.log('═'.repeat(50))
    console.log('Ready for theme auditing! 🎨')
    console.log('💡 Open http://localhost:3001 in your browser')
  })
}

// Start server if run directly
if (require.main === module) {
  startServer()
}

module.exports = {
  startServer,
  broadcast,
  currentAuditData
}
