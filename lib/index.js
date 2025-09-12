/**
 * ThemeTracker Package Entry Point
 * Exports main functionality for programmatic usage
 */

const { ConfigLoader } = require('./config/config-loader')
const { FileScanner } = require('./utils/file-scanner')
const { createServer } = require('./server')

/**
 * Main ThemeTracker class
 */
class ThemeTracker {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd()
    this.configLoader = new ConfigLoader(this.projectRoot)
    this.fileScanner = new FileScanner(this.configLoader)
    this.server = null
    this.config = null
  }

  /**
   * Initialize ThemeTracker with configuration
   */
  async init() {
    this.config = await this.configLoader.loadConfig()
    return this.config
  }

  /**
   * Scan project files
   */
  async scanFiles() {
    if (!this.config) await this.init()
    return await this.fileScanner.scanProject(this.projectRoot)
  }

  /**
   * Start the server
   */
  async startServer(options = {}) {
    if (!this.config) await this.init()
    
    const serverConfig = {
      ...this.config.server,
      ...options,
      projectRoot: this.projectRoot,
      configLoader: this.configLoader
    }

    this.server = await createServer(serverConfig)
    return this.server
  }

  /**
   * Stop the server
   */
  async stopServer() {
    if (this.server) {
      await this.server.close()
      this.server = null
    }
  }

  /**
   * Get configuration
   */
  getConfig() {
    return this.config
  }

  /**
   * Get scan statistics
   */
  getScanStats() {
    return this.fileScanner.getStats()
  }
}

/**
 * Convenience function to start ThemeTracker
 */
async function startThemeTracker(options = {}) {
  const tracker = new ThemeTracker(options)
  await tracker.init()
  return tracker
}

/**
 * Convenience function to create config file
 */
async function createConfig(projectRoot = process.cwd()) {
  const configLoader = new ConfigLoader(projectRoot)
  return await configLoader.createSampleConfig()
}

module.exports = {
  ThemeTracker,
  startThemeTracker,
  createConfig,
  ConfigLoader,
  FileScanner
}
