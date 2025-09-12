/**
 * Enhanced File Scanner
 * Uses configuration-driven logic to scan and filter files intelligently
 */

const fs = require('fs')
const path = require('path')

class FileScanner {
  constructor(configLoader) {
    this.configLoader = configLoader
    this.scannedFiles = []
    this.skippedFiles = []
    this.stats = {
      totalDirectories: 0,
      totalFiles: 0,
      skippedDirectories: 0,
      skippedFiles: 0,
      processedFiles: 0
    }
  }

  /**
   * Scan project for relevant files based on configuration
   */
  async scanProject(projectRoot = process.cwd()) {
    const config = await this.configLoader.loadConfig()
    
    console.log('🔍 Starting file scan...')
    console.log(`📂 Project root: ${projectRoot}`)
    
    this.scannedFiles = []
    this.skippedFiles = []
    this.stats = {
      totalDirectories: 0,
      totalFiles: 0,
      skippedDirectories: 0,
      skippedFiles: 0,
      processedFiles: 0
    }

    // Get source directories to scan
    const sourceDirs = config.sourceDirectories.focus.length > 0 
      ? config.sourceDirectories.focus 
      : config.sourceDirectories.include

    console.log(`📁 Scanning directories: ${sourceDirs.join(', ')}`)

    // Scan each source directory
    for (const sourceDir of sourceDirs) {
      const fullPath = path.resolve(projectRoot, sourceDir)
      
      if (fs.existsSync(fullPath)) {
        await this.scanDirectory(fullPath, projectRoot, 0, config)
      } else {
        console.warn(`⚠️  Directory not found: ${sourceDir}`)
      }
    }

    // Log results
    this.logScanResults(config)

    return this.scannedFiles
  }

  /**
   * Recursively scan a directory
   */
  async scanDirectory(currentDir, projectRoot, depth, config) {
    // Check max depth
    if (depth > config.sourceDirectories.maxDepth) {
      return
    }

    try {
      const items = fs.readdirSync(currentDir)
      this.stats.totalDirectories++

      for (const item of items) {
        const fullPath = path.join(currentDir, item)
        const relativePath = path.relative(projectRoot, fullPath)
        
        try {
          const stat = fs.statSync(fullPath)

          if (stat.isDirectory()) {
            // Check if directory should be ignored
            if (this.shouldIgnoreDirectory(item, relativePath, config)) {
              this.stats.skippedDirectories++
              continue
            }

            // Recursively scan subdirectory
            await this.scanDirectory(fullPath, projectRoot, depth + 1, config)
          } else if (stat.isFile()) {
            this.stats.totalFiles++

            // Check if file should be processed
            if (this.shouldProcessFile(fullPath, item, relativePath, config)) {
              this.scannedFiles.push(fullPath)
              this.stats.processedFiles++
            } else {
              this.skippedFiles.push({
                path: fullPath,
                reason: this.getSkipReason(fullPath, item, relativePath, config)
              })
              this.stats.skippedFiles++
            }
          }
        } catch (statError) {
          console.warn(`⚠️  Cannot access ${fullPath}:`, statError.message)
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning directory ${currentDir}:`, error.message)
    }
  }

  /**
   * Check if a directory should be ignored
   */
  shouldIgnoreDirectory(dirName, relativePath, config) {
    const lowerDirName = dirName.toLowerCase()
    const lowerRelativePath = relativePath.toLowerCase()

    // Check against ignored directory patterns
    for (const pattern of config.ignore.directories) {
      if (lowerDirName === pattern.toLowerCase()) {
        return true
      }
    }

    // Check path patterns
    for (const pattern of config.ignore.pathPatterns) {
      if (lowerRelativePath.includes(pattern.toLowerCase())) {
        return true
      }
    }

    // Special cases
    if (dirName.startsWith('.') && dirName !== '.') {
      return true // Hidden directories (except current)
    }

    return false
  }

  /**
   * Check if a file should be processed
   */
  shouldProcessFile(fullPath, fileName, relativePath, config) {
    // Check file extension
    if (!this.hasValidExtension(fileName, config)) {
      return false
    }

    // Check if file should be ignored
    if (this.configLoader.shouldIgnoreFile(relativePath, fileName)) {
      return false
    }

    // Additional checks for specific file types
    return this.passesAdditionalChecks(fullPath, fileName, config)
  }

  /**
   * Check if file has a valid extension
   */
  hasValidExtension(fileName, config) {
    const fileExt = path.extname(fileName).toLowerCase().substring(1) // Remove dot

    for (const fileType of Object.values(config.fileTypes)) {
      if (fileType.enabled && fileType.extensions.includes(fileExt)) {
        return true
      }
    }

    return false
  }

  /**
   * Additional checks for specific file types
   */
  passesAdditionalChecks(fullPath, fileName, config) {
    try {
      // For very large files, we might want to skip them
      const stat = fs.statSync(fullPath)
      if (stat.size > 1024 * 1024) { // 1MB limit
        return false
      }

      // For index files, check if they actually contain styling
      if (fileName.toLowerCase().startsWith('index.')) {
        return this.indexFileHasStyling(fullPath, config)
      }

      return true
    } catch (error) {
      console.warn(`⚠️  Cannot check file ${fullPath}:`, error.message)
      return false
    }
  }

  /**
   * Check if index file contains styling (to avoid barrel exports)
   */
  indexFileHasStyling(filePath, config) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const indicators = config.analysis.fileClassification.uiComponentIndicators

      // Look for styling indicators
      for (const indicator of indicators) {
        if (content.includes(indicator)) {
          return true
        }
      }

      // Check for CSS imports or styled components
      if (content.includes('import') && (content.includes('.css') || content.includes('styled'))) {
        return true
      }

      return false
    } catch (error) {
      return false // If we can't read it, skip it
    }
  }

  /**
   * Get reason why a file was skipped (for debugging)
   */
  getSkipReason(fullPath, fileName, relativePath, config) {
    if (!this.hasValidExtension(fileName, config)) {
      return 'Invalid file extension'
    }

    if (this.configLoader.shouldIgnoreFile(relativePath, fileName)) {
      return 'Matches ignore pattern'
    }

    try {
      const stat = fs.statSync(fullPath)
      if (stat.size > 1024 * 1024) {
        return 'File too large (>1MB)'
      }
    } catch (error) {
      return 'Cannot access file'
    }

    if (fileName.toLowerCase().startsWith('index.')) {
      return 'Index file with no styling content'
    }

    return 'Unknown reason'
  }

  /**
   * Log scan results
   */
  logScanResults(config) {
    console.log('\n📊 File Scan Results:')
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📂 Directories scanned: ${this.stats.totalDirectories}`)
    console.log(`📄 Total files found: ${this.stats.totalFiles}`)
    console.log(`✅ Files to analyze: ${this.stats.processedFiles}`)
    console.log(`⏭️  Files skipped: ${this.stats.skippedFiles}`)
    console.log(`📁 Directories ignored: ${this.stats.skippedDirectories}`)

    // Show file type breakdown
    const fileTypeStats = this.getFileTypeStats(config)
    if (Object.keys(fileTypeStats).length > 0) {
      console.log('\n📋 File Types:')
      for (const [type, count] of Object.entries(fileTypeStats)) {
        console.log(`   ${type}: ${count} files`)
      }
    }

    // Show some examples of skipped files (for debugging)
    if (config.output.logLevel === 'debug' && this.skippedFiles.length > 0) {
      console.log('\n🔍 Examples of skipped files:')
      this.skippedFiles.slice(0, 5).forEach(skipped => {
        const relativePath = path.relative(process.cwd(), skipped.path)
        console.log(`   ${relativePath} (${skipped.reason})`)
      })
      
      if (this.skippedFiles.length > 5) {
        console.log(`   ... and ${this.skippedFiles.length - 5} more`)
      }
    }

    console.log('')
  }

  /**
   * Get statistics by file type
   */
  getFileTypeStats(config) {
    const stats = {}

    for (const filePath of this.scannedFiles) {
      const fileName = path.basename(filePath)
      const fileExt = path.extname(fileName).toLowerCase().substring(1)

      for (const [typeName, typeConfig] of Object.entries(config.fileTypes)) {
        if (typeConfig.enabled && typeConfig.extensions.includes(fileExt)) {
          stats[typeName] = (stats[typeName] || 0) + 1
          break
        }
      }
    }

    return stats
  }

  /**
   * Get scanned files filtered by type
   */
  getFilesByType(typeName, config) {
    const typeConfig = config.fileTypes[typeName]
    if (!typeConfig || !typeConfig.enabled) {
      return []
    }

    return this.scannedFiles.filter(filePath => {
      const fileExt = path.extname(filePath).toLowerCase().substring(1)
      return typeConfig.extensions.includes(fileExt)
    })
  }

  /**
   * Get scan statistics
   */
  getStats() {
    return { ...this.stats }
  }

  /**
   * Get list of skipped files (for debugging)
   */
  getSkippedFiles() {
    return [...this.skippedFiles]
  }
}

module.exports = { FileScanner }
