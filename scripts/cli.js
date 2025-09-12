#!/usr/bin/env node
/**
 * ThemeTracker CLI
 * Command-line interface for starting ThemeTracker Live
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const SCRIPT_DIR = __dirname
const SERVER_SCRIPT = path.join(SCRIPT_DIR, 'server.js')

/**
 * Start ThemeTracker Live server
 */
const startThemeTracker = () => {
  console.log('🚀 Starting ThemeTracker Live...')
  console.log('━'.repeat(50))

  // Check if server script exists
  if (!fs.existsSync(SERVER_SCRIPT)) {
    console.error('❌ Server script not found:', SERVER_SCRIPT)
    process.exit(1)
  }

  // Start the server
  const serverProcess = spawn('node', [SERVER_SCRIPT], {
    cwd: process.cwd(),
    stdio: 'inherit'
  })

  // Handle server process events
  serverProcess.on('error', (error) => {
    console.error('❌ Failed to start ThemeTracker server:', error.message)
    process.exit(1)
  })

  serverProcess.on('close', (code) => {
    console.log(`\n📊 ThemeTracker Live server stopped with code ${code}`)
  })

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down ThemeTracker Live...')
    serverProcess.kill('SIGINT')
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down ThemeTracker Live...')
    serverProcess.kill('SIGTERM')
    process.exit(0)
  })

  // Auto-open browser after a short delay
  setTimeout(() => {
    const { spawn } = require('child_process')
    try {
      // Try different commands for different OS
      const platform = process.platform
      if (platform === 'darwin') {
        spawn('open', [`http://localhost:3001`])
      } else if (platform === 'win32') {
        spawn('start', [`http://localhost:3001`], { shell: true })
      } else {
        spawn('xdg-open', [`http://localhost:3001`])
      }
    } catch (error) {
      console.log('💡 Please open http://localhost:3001 in your browser')
    }
  }, 2000)
}

/**
 * Show usage help
 */
const showHelp = () => {
  console.log('ThemeTracker Live v0.2')
  console.log('━'.repeat(30))
  console.log('')
  console.log('Usage:')
  console.log('  npm run theme-tracker:start    Start ThemeTracker Live server')
  console.log('  npm run theme-tracker:help     Show this help message')
  console.log('')
  console.log('Features:')
  console.log('  ✅ Real-time theme auditing')
  console.log('  ✅ Interactive file selection')
  console.log('  ✅ Live violation tracking')
  console.log('  ✅ WebSocket-based updates')
  console.log('  ✅ Responsive dashboard UI')
  console.log('')
  console.log('Access:')
  console.log('  🌐 Dashboard: http://localhost:3001')
  console.log('  🔌 WebSocket: ws://localhost:8080')
  console.log('')
}

/**
 * Main CLI handler
 */
const main = () => {
  const command = process.argv[2] || 'start'

  switch (command) {
    case 'start':
      startThemeTracker()
      break
    case 'help':
    case '--help':
    case '-h':
      showHelp()
      break
    default:
      console.error(`❌ Unknown command: ${command}`)
      console.log('Run "npm run theme-tracker:help" for usage information')
      process.exit(1)
  }
}

// Run CLI if called directly
if (require.main === module) {
  main()
}

module.exports = {
  startThemeTracker,
  showHelp
}
