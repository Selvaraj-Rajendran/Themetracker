#!/usr/bin/env node
/**
 * ThemeTracker CLI
 * Enhanced command-line interface with configuration support
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { ConfigLoader } = require('./config/config-loader')
const { ThemeTracker } = require('./index')

const packageRoot = path.dirname(__dirname)
const serverScript = path.join(packageRoot, 'lib', 'server.js')

/**
 * Show ThemeTracker banner
 */
const showBanner = () => {
  console.log('🎨 ThemeTracker v0.2.0')
  console.log('━'.repeat(50))
  console.log('Real-time theme auditing for Dew Design System')
  console.log('')
}

/**
 * Start ThemeTracker Live server
 */
const startThemeTracker = async () => {
  showBanner()
  console.log('🚀 Starting ThemeTracker Live...')

  const projectRoot = process.cwd()

  // Initialize configuration
  try {
    const configLoader = new ConfigLoader(projectRoot)
    const config = await configLoader.loadConfig()

    console.log(`📂 Project: ${path.basename(projectRoot)}`)
    console.log(`🌐 Server will start on: http://${config.server.host}:${config.server.port}`)

    if (!config.dewConfig.tokensPath) {
      console.log('')
      console.log('⚠️  Dew Design System configuration not found!')
      console.log('💡 Run "themetracker init" to create a sample config file')
      console.log('🔧 Or ensure dew tokens are available in your project')
      console.log('')
    }
  } catch (error) {
    console.error('❌ Configuration error:', error.message)
    console.log('💡 Run "themetracker init" to create a config file')
    process.exit(1)
  }

  // Check if server script exists
  if (!fs.existsSync(serverScript)) {
    console.error('❌ Server script not found:', serverScript)
    process.exit(1)
  }

  // Start the server
  const serverProcess = spawn('node', [serverScript], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      THEMETRACKER_PROJECT_ROOT: projectRoot,
      THEMETRACKER_PACKAGE_ROOT: packageRoot
    }
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
  const shutdown = (signal) => {
    console.log(`\n🛑 Shutting down ThemeTracker Live... (${signal})`)
    serverProcess.kill(signal)
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  // Auto-open browser after a short delay
  setTimeout(async () => {
    try {
      const configLoader = new ConfigLoader(projectRoot)
      const config = await configLoader.loadConfig()

      if (config.server.autoOpen) {
        const { spawn } = require('child_process')
        const url = `http://${config.server.host}:${config.server.port}`

        // Try different commands for different OS
        const platform = process.platform
        if (platform === 'darwin') {
          spawn('open', [url])
        } else if (platform === 'win32') {
          spawn('start', [url], { shell: true })
        } else {
          spawn('xdg-open', [url])
        }
      }
    } catch (error) {
      console.log('💡 Please open http://localhost:3001 in your browser')
    }
  }, 2000)
}

/**
 * Initialize configuration file
 */
const initConfig = async () => {
  showBanner()
  console.log('🔧 Initializing ThemeTracker configuration...')

  const projectRoot = process.cwd()
  const configLoader = new ConfigLoader(projectRoot)

  try {
    const created = await configLoader.createSampleConfig()

    if (created) {
      console.log('✅ Configuration file created successfully!')
      console.log('')
      console.log('🎨 NEW: Comprehensive CSS Variable Fallback Support!')
      console.log('   ✅ var(--color-text-primary, #12344d) - NOT flagged')
      console.log('   ✅ var(--spacing-md, 16px) - NOT flagged')
      console.log('   ❌ color: #12344d; - WILL be flagged')
      console.log('')
      console.log('🎯 NEW: CSS Properties Ignore List!')
      console.log('   Configure ignoreProperties: ["margin", "padding"] to')
      console.log('   completely ignore violations for specific CSS properties')
      console.log('')
      console.log('📝 Next steps:')
      console.log('1. Edit themetracker.config.js to match your project structure')
      console.log('2. Ensure Dew Design System tokens are available')
      console.log('3. Run "themetracker start" to begin auditing')
      console.log('')
      console.log('💡 Tip: ThemeTracker will auto-detect most settings if not configured')
      console.log('🚀 Your CSS variable fallbacks are now properly supported!')
    } else {
      console.log('ℹ️  Configuration file already exists')
      console.log('💡 Edit themetracker.config.js to customize settings')
      console.log('🎨 Note: Enhanced CSS variable fallback support is now active!')
      console.log('🎯 Note: CSS properties ignore list feature is now available!')
    }
  } catch (error) {
    console.error('❌ Failed to create configuration:', error.message)
    process.exit(1)
  }
}

/**
 * Show project information and configuration status
 */
const showInfo = async () => {
  showBanner()
  console.log('📊 Project Information')
  console.log('━'.repeat(30))

  const projectRoot = process.cwd()
  console.log(`📂 Project root: ${projectRoot}`)
  console.log(`📦 Project name: ${path.basename(projectRoot)}`)

  try {
    const configLoader = new ConfigLoader(projectRoot)
    const config = await configLoader.loadConfig()

    console.log('\n🔧 Configuration:')
    console.log(`   Config file: ${config._configFile || 'Auto-detected defaults'}`)
    console.log(`   Source directories: ${config.sourceDirectories.include.join(', ')}`)
    console.log(`   Dew tokens: ${config.dewConfig.tokensPath || 'Not found'}`)
    console.log(`   Server port: ${config.server.port}`)

    // Check for common project files
    console.log('\n📋 Project structure:')
    const checkFile = (file) => (fs.existsSync(path.join(projectRoot, file)) ? '✅' : '❌')
    console.log(`   package.json: ${checkFile('package.json')}`)
    console.log(`   src/: ${checkFile('src')}`)
    console.log(`   components/: ${checkFile('components')}`)
    console.log(`   tailwind.config.js: ${checkFile('tailwind.config.js')}`)

    // Quick file scan
    const tracker = new ThemeTracker({ projectRoot })
    await tracker.init()
    const files = await tracker.scanFiles()
    const stats = tracker.getScanStats()

    console.log('\n📈 File scan preview:')
    console.log(`   Total files found: ${stats.totalFiles}`)
    console.log(`   Files to analyze: ${stats.processedFiles}`)
    console.log(`   Files skipped: ${stats.skippedFiles}`)
  } catch (error) {
    console.error('\n❌ Configuration error:', error.message)
    console.log('💡 Run "themetracker init" to create a configuration file')
  }
}

/**
 * Show usage help
 */
const showHelp = () => {
  showBanner()
  console.log('Usage:')
  console.log('  themetracker <command> [options]')
  console.log('')
  console.log('Commands:')
  console.log('  start                   Start ThemeTracker Live server')
  console.log('  init                    Create configuration file')
  console.log('  info                    Show project information')
  console.log('  help                    Show this help message')
  console.log('')
  console.log('Options:')
  console.log('  --port <number>         Override server port')
  console.log("  --no-open              Don't auto-open browser")
  console.log('  --debug                 Enable debug logging')
  console.log('')
  console.log('Examples:')
  console.log('  themetracker start                    # Start with auto-detection')
  console.log('  themetracker start --port 3002        # Start on custom port')
  console.log('  themetracker init                     # Create config file')
  console.log('  themetracker info                     # Check project status')
  console.log('')
  console.log('Features:')
  console.log('  ✅ Real-time theme auditing')
  console.log('  ✅ Dew Design System integration')
  console.log('  ✅ CSS/SCSS file analysis')
  console.log('  ✅ Interactive dashboard UI')
  console.log('  ✅ WebSocket-based live updates')
  console.log('  ✅ Smart project auto-detection')
  console.log('')
  console.log('Access:')
  console.log('  🌐 Dashboard: http://localhost:3001')
  console.log('  📊 Summary: http://localhost:3001/src/summary.html')
  console.log('')
  console.log('Documentation:')
  console.log('  📖 https://github.com/your-org/themetracker#readme')
  console.log('')
}

/**
 * Parse command line arguments
 */
const parseArgs = (argv) => {
  const args = {
    command: 'start',
    options: {}
  }

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]

    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=')

      switch (key) {
        case 'port':
          args.options.port = parseInt(value || argv[++i])
          break
        case 'no-open':
          args.options.autoOpen = false
          break
        case 'debug':
          args.options.debug = true
          process.env.DEBUG = '1'
          break
        case 'help':
          args.command = 'help'
          break
        default:
          console.warn(`⚠️  Unknown option: --${key}`)
      }
    } else if (arg === '-h' || arg === 'help') {
      args.command = 'help'
    } else if (args.command === 'start') {
      // Only override the default 'start' command, not explicitly set commands
      args.command = arg
    }
  }

  return args
}

/**
 * Main CLI handler
 */
const main = async () => {
  const args = parseArgs(process.argv)

  try {
    switch (args.command) {
      case 'start':
        await startThemeTracker()
        break
      case 'init':
        await initConfig()
        break
      case 'info':
        await showInfo()
        break
      case 'help':
      case '--help':
      case '-h':
        showHelp()
        break
      default:
        console.error(`❌ Unknown command: ${args.command}`)
        console.log('Run "themetracker help" for usage information')
        process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (args.options.debug) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Run CLI if called directly
if (require.main === module) {
  main()
}

module.exports = {
  startThemeTracker,
  initConfig,
  showInfo,
  showHelp,
  main
}
