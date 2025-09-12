#!/usr/bin/env node
/**
 * Dashboard Engine - Unified Analytics for Project Insights Dashboard
 * 
 * This engine consolidates data from audit-engine.js and provides 
 * comprehensive analytics specifically designed for the summary dashboard.
 * It replaces both files-coverage-engine.js and components-metrics-engine.js
 * with a unified, framework-agnostic approach.
 */

const path = require('path')
const { FileScanner } = require('../utils/file-scanner')
const { ConfigLoader } = require('../config/config-loader')

class DashboardEngine {
  constructor(projectRoot, config = {}) {
    this.projectRoot = projectRoot
    this.config = config
    this.auditData = {}
    
    // Initialize file scanning for ignored files tracking
    this.configLoader = new ConfigLoader(this.projectRoot)
    this.fileScanner = new FileScanner(this.configLoader)
    this.scanStats = null
    
    this.fileTypes = {
      components: 0,
      pages: 0,
      styles: 0,
      utilities: 0,
      other: 0
    }
    this.violations = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }
  }

  /**
   * Refresh file scan statistics to get ignored files data
   */
  async refreshScanStats() {
    try {
      console.log('🔍 Refreshing file scan statistics...')
      // Run file scan to get current statistics including ignored files
      await this.fileScanner.scanProject(this.projectRoot)
      this.scanStats = this.fileScanner.getStats()
      console.log(`📊 Scan stats: ${this.scanStats.totalFiles} total, ${this.scanStats.processedFiles} analyzed, ${this.scanStats.skippedFiles} ignored`)
    } catch (error) {
      console.warn('⚠️ Could not refresh scan stats:', error.message)
      this.scanStats = null
    }
  }

  /**
   * Generate comprehensive dashboard analytics from audit data
   * @param {Object} auditData - Raw audit results from audit-engine
   * @returns {Object} Complete dashboard analytics
   */
  async generateDashboardAnalytics(auditData) {
    console.log('📊 Starting Dashboard Analytics Generation...')
    
    this.auditData = auditData
    const entries = Object.entries(auditData)
    
    // Get file scan statistics to include ignored files data
    await this.refreshScanStats()
    
    if (entries.length === 0) {
      return this.getEmptyAnalytics()
    }

    // Generate all analytics in parallel for better performance
    const [
      overview,
      fileTypes,
      violations,
      components,
      coverage,
      recommendations
    ] = await Promise.all([
      this.generateOverviewMetrics(entries),
      this.analyzeFileTypes(entries),
      this.analyzeViolations(entries),
      this.analyzeComponents(entries),
      this.analyzeCoverageDistribution(entries),
      this.generateRecommendations(entries)
    ])

    const analytics = {
      overview,
      fileTypes,
      violations,
      components,
      coverage,
      recommendations,
      scanStatistics: this.scanStats ? {
        totalFilesFound: this.scanStats.totalFiles,
        totalFilesAnalyzed: this.scanStats.processedFiles,
        totalFilesIgnored: this.scanStats.skippedFiles,
        totalDirectoriesIgnored: this.scanStats.skippedDirectories,
        analysisRate: this.scanStats.totalFiles > 0 ? 
          Math.round((this.scanStats.processedFiles / this.scanStats.totalFiles) * 100) : 0
      } : null,
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    }

    console.log('✅ Dashboard Analytics Generated:', {
      totalFiles: analytics.overview.totalFiles,
      totalFilesFound: analytics.scanStatistics?.totalFilesFound || 'unknown',
      totalFilesIgnored: analytics.scanStatistics?.totalFilesIgnored || 'unknown',
      totalComponents: analytics.components?.summary?.totalUniqueComponents || 0
    })
    
    return analytics
  }

  /**
   * Generate overview metrics for the main dashboard cards
   */
  async generateOverviewMetrics(entries) {
    let totalViolations = 0
    let coverageSum = 0
    const statusDistribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0
    }

    const violationSeverityCount = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    entries.forEach(([, result]) => {
      // Count status distribution
      statusDistribution[result.status]++
      
      // Sum coverage
      coverageSum += result.coverage || 0
      
      // Count violations by severity
      const violations = Array.isArray(result.violationsList) ? result.violationsList : []
      totalViolations += violations.length
      
      violations.forEach(violation => {
        const severity = violation.severity || 'medium'
        violationSeverityCount[severity]++
      })
    })

    const averageCoverage = entries.length > 0 ? Math.round(coverageSum / entries.length) : 0

    return {
      totalFiles: entries.length,
      totalViolations,
      averageCoverage,
      statusDistribution,
      criticalViolations: violationSeverityCount.critical,
      highViolations: violationSeverityCount.high,
      mediumViolations: violationSeverityCount.medium,
      lowViolations: violationSeverityCount.low
    }
  }

  /**
   * Analyze file types distribution for the dashboard
   */
  async analyzeFileTypes(entries) {
    const fileTypes = {
      components: 0,
      pages: 0,
      styles: 0,
      utilities: 0,
      other: 0
    }

    const fileExtensions = {
      '.js': 0,
      '.jsx': 0,
      '.ts': 0,
      '.tsx': 0,
      '.css': 0,
      '.scss': 0,
      '.sass': 0,
      '.less': 0
    }

    entries.forEach(([filePath, result]) => {
      const ext = path.extname(filePath).toLowerCase()
      if (fileExtensions.hasOwnProperty(ext)) {
        fileExtensions[ext]++
      }

      // Classify file type based on path and content
      const normalizedPath = filePath.toLowerCase()
      
      if (this.isComponentFile(normalizedPath, result)) {
        fileTypes.components++
      } else if (this.isPageFile(normalizedPath, result)) {
        fileTypes.pages++
      } else if (this.isStyleFile(normalizedPath, ext)) {
        fileTypes.styles++
      } else if (this.isUtilityFile(normalizedPath, result)) {
        fileTypes.utilities++
      } else {
        fileTypes.other++
      }
    })

    return {
      ...fileTypes,
      extensions: fileExtensions,
      breakdown: {
        javascript: fileExtensions['.js'] + fileExtensions['.jsx'],
        typescript: fileExtensions['.ts'] + fileExtensions['.tsx'],
        styles: fileExtensions['.css'] + fileExtensions['.scss'] + fileExtensions['.sass'] + fileExtensions['.less']
      }
    }
  }

  /**
   * Analyze violations for the dashboard violations chart
   */
  async analyzeViolations(entries) {
    const violationTypes = {}
    const violationPatterns = {}
    let totalViolations = 0
    
    const severityCount = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    entries.forEach(([, result]) => {
      const violations = Array.isArray(result.violationsList) ? result.violationsList : []
      
      violations.forEach(violation => {
        totalViolations++
        
        // Count by severity
        const severity = violation.severity || 'medium'
        severityCount[severity]++
        
        // Count by type
        const type = violation.type || 'unknown'
        violationTypes[type] = (violationTypes[type] || 0) + 1
        
        // Analyze patterns
        if (violation.message) {
          const pattern = this.extractViolationPattern(violation.message)
          violationPatterns[pattern] = (violationPatterns[pattern] || 0) + 1
        }
      })
    })

    // Get top violation types
    const topViolationTypes = Object.entries(violationTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }))

    return {
      ...severityCount,
      total: totalViolations,
      byType: violationTypes,
      topTypes: topViolationTypes,
      patterns: violationPatterns
    }
  }

  /**
   * Analyze components (framework-agnostic with optional React support)
   */
  async analyzeComponents(entries) {
    const isReactProject = this.config?.analysis?.frameworkType === 'react' && 
                          this.config?.analysis?.enableComponentsAnalysis

    if (!isReactProject) {
      return {
        enabled: false,
        framework: this.config?.analysis?.frameworkType || 'unknown',
        message: 'Components analysis disabled or not applicable for this framework',
        summary: {
          totalComponents: 0,
          totalUniqueComponents: 0,
          componentsWithThemeUsage: 0,
          usagePercentage: 0
        }
      }
    }

    // React-specific component analysis
    console.log('🧩 Analyzing React components...')
    
    const componentFiles = entries.filter(([filePath, result]) => 
      this.isComponentFile(filePath, result)
    )

    const pageFiles = entries.filter(([filePath, result]) => 
      this.isPageFile(filePath, result)
    )

    // Analyze page-level metrics
    const pageMetrics = {}
    
    for (const [filePath, result] of pageFiles) {
      const pageName = this.extractPageName(filePath)
      const relatedComponents = this.findRelatedComponents(filePath, componentFiles)
      
      pageMetrics[pageName] = {
        name: pageName,
        path: filePath,
        totalComponents: relatedComponents.length,
        themeUsageCount: relatedComponents.filter(comp => comp.hasThemeUsage).length,
        averageCoverage: this.calculateAverageCoverage([result, ...relatedComponents.map(c => c.result)]),
        status: result.status,
        pageSpecificComponents: relatedComponents.filter(comp => comp.isPageSpecific),
        commonComponents: relatedComponents.filter(comp => comp.isCommon)
      }
    }

    const summary = {
      totalComponents: componentFiles.length,
      totalUniqueComponents: componentFiles.length, // Simplified for now
      componentsWithThemeUsage: componentFiles.filter(([, result]) => 
        result.themeTokens && result.themeTokens.length > 0
      ).length,
      usagePercentage: componentFiles.length > 0 
        ? Math.round((componentFiles.filter(([, result]) => 
            result.themeTokens && result.themeTokens.length > 0
          ).length / componentFiles.length) * 100)
        : 0
    }

    return {
      enabled: true,
      framework: 'react',
      summary,
      pageMetrics,
      componentBreakdown: {
        commonComponents: componentFiles.filter(([filePath]) => 
          this.isCommonComponent(filePath)
        ).length,
        pageSpecificComponents: componentFiles.filter(([filePath]) => 
          this.isPageSpecificComponent(filePath, pageFiles)
        ).length,
        sharedComponents: componentFiles.length - 
          componentFiles.filter(([filePath]) => this.isCommonComponent(filePath)).length -
          componentFiles.filter(([filePath]) => this.isPageSpecificComponent(filePath, pageFiles)).length
      }
    }
  }

  /**
   * Analyze coverage distribution
   */
  async analyzeCoverageDistribution(entries) {
    const coverageBuckets = {
      '90-100': 0,  // Excellent
      '70-89': 0,   // Good  
      '50-69': 0,   // Fair
      '30-49': 0,   // Poor
      '0-29': 0     // Critical
    }

    const coverageByFileType = {}

    entries.forEach(([filePath, result]) => {
      const coverage = result.coverage || 0
      const fileType = this.classifyFileType(filePath, result)
      
      // Update coverage buckets
      if (coverage >= 90) coverageBuckets['90-100']++
      else if (coverage >= 70) coverageBuckets['70-89']++
      else if (coverage >= 50) coverageBuckets['50-69']++
      else if (coverage >= 30) coverageBuckets['30-49']++
      else coverageBuckets['0-29']++

      // Track coverage by file type
      if (!coverageByFileType[fileType]) {
        coverageByFileType[fileType] = { total: 0, sum: 0, files: [] }
      }
      coverageByFileType[fileType].total++
      coverageByFileType[fileType].sum += coverage
      coverageByFileType[fileType].files.push({ filePath, coverage })
    })

    // Calculate averages by file type
    Object.keys(coverageByFileType).forEach(fileType => {
      const data = coverageByFileType[fileType]
      data.average = data.total > 0 ? Math.round(data.sum / data.total) : 0
    })

    return {
      buckets: coverageBuckets,
      byFileType: coverageByFileType,
      totalFiles: entries.length
    }
  }

  /**
   * Generate actionable recommendations
   */
  async generateRecommendations(entries) {
    const recommendations = []
    
    // Analyze for quick wins
    const quickWins = entries.filter(([, result]) => {
      const coverage = result.coverage || 0
      return (coverage >= 65 && coverage < 70) || (coverage >= 85 && coverage < 90)
    })

    if (quickWins.length > 0) {
      recommendations.push({
        type: 'quick-wins',
        priority: 'high',
        title: `${quickWins.length} Quick Wins Available`,
        description: 'Files close to next coverage tier that can be easily improved',
        action: 'Focus on these files for immediate impact',
        files: quickWins.slice(0, 5).map(([filePath, result]) => ({
          filePath,
          currentCoverage: result.coverage,
          targetCoverage: result.coverage >= 85 ? 90 : 70,
          effort: 'low'
        }))
      })
    }

    // Analyze critical files
    const criticalFiles = entries.filter(([, result]) => result.status === 'critical')
    
    if (criticalFiles.length > 0) {
      recommendations.push({
        type: 'critical-attention',
        priority: 'critical',
        title: `${criticalFiles.length} Critical Files Need Attention`,
        description: 'Files with very low theme coverage requiring immediate action',
        action: 'Prioritize these files for theme migration',
        files: criticalFiles.slice(0, 5).map(([filePath, result]) => ({
          filePath,
          currentCoverage: result.coverage,
          violations: (result.violationsList || []).length,
          effort: 'high'
        }))
      })
    }

    // Analyze violation patterns
    const commonViolations = this.findCommonViolationPatterns(entries)
    if (commonViolations.length > 0) {
      recommendations.push({
        type: 'pattern-fixes',
        priority: 'medium',
        title: 'Common Violation Patterns Found',
        description: 'Systematic issues that can be fixed across multiple files',
        action: 'Consider automated fixes or team guidelines',
        patterns: commonViolations.slice(0, 3)
      })
    }

    return recommendations
  }

  // Helper methods for file classification
  isComponentFile(filePath, result) {
    const normalizedPath = filePath.toLowerCase()
    return (
      normalizedPath.includes('/component') ||
      normalizedPath.includes('/ui/') ||
      (result && result.fileType === 'ui-component') ||
      /\/[A-Z][a-zA-Z]*\.(jsx?|tsx?)$/.test(filePath) // PascalCase files
    )
  }

  isPageFile(filePath, result) {
    const normalizedPath = filePath.toLowerCase()
    return (
      normalizedPath.includes('/page') ||
      normalizedPath.includes('/route') ||
      normalizedPath.includes('/view') ||
      (result && result.fileType === 'page-component')
    )
  }

  isStyleFile(filePath, ext) {
    return ['.css', '.scss', '.sass', '.less'].includes(ext)
  }

  isUtilityFile(filePath, result) {
    const normalizedPath = filePath.toLowerCase()
    return (
      normalizedPath.includes('/util') ||
      normalizedPath.includes('/helper') ||
      normalizedPath.includes('/service') ||
      normalizedPath.includes('/api') ||
      (result && result.fileType === 'utility')
    )
  }

  classifyFileType(filePath, result) {
    if (this.isComponentFile(filePath, result)) return 'component'
    if (this.isPageFile(filePath, result)) return 'page'
    if (this.isStyleFile(filePath, path.extname(filePath))) return 'style'
    if (this.isUtilityFile(filePath, result)) return 'utility'
    return 'other'
  }

  extractPageName(filePath) {
    const pathParts = filePath.split('/')
    const fileName = pathParts[pathParts.length - 1]
    return path.basename(fileName, path.extname(fileName))
  }

  findRelatedComponents(pagePath, componentFiles) {
    // Simplified: find components in same directory or subdirectories
    const pageDir = path.dirname(pagePath)
    return componentFiles
      .filter(([componentPath]) => componentPath.startsWith(pageDir))
      .map(([componentPath, result]) => ({
        path: componentPath,
        result,
        hasThemeUsage: result.themeTokens && result.themeTokens.length > 0,
        isPageSpecific: this.isPageSpecificComponent(componentPath, [[pagePath]]),
        isCommon: this.isCommonComponent(componentPath)
      }))
  }

  isCommonComponent(filePath) {
    const normalizedPath = filePath.toLowerCase()
    return (
      normalizedPath.includes('/common/') ||
      normalizedPath.includes('/shared/') ||
      normalizedPath.includes('/ui/') ||
      normalizedPath.includes('/component/ui/')
    )
  }

  isPageSpecificComponent(componentPath, pageFiles) {
    const componentDir = path.dirname(componentPath)
    return pageFiles.some(([pagePath]) => {
      const pageDir = path.dirname(pagePath)
      return componentDir.startsWith(pageDir)
    })
  }

  calculateAverageCoverage(results) {
    if (results.length === 0) return 0
    const sum = results.reduce((acc, result) => acc + (result.coverage || 0), 0)
    return Math.round(sum / results.length)
  }

  extractViolationPattern(message) {
    // Extract common patterns from violation messages
    if (message.includes('hardcoded color')) return 'hardcoded-colors'
    if (message.includes('hardcoded spacing')) return 'hardcoded-spacing'
    if (message.includes('theme object')) return 'theme-object-usage'
    if (message.includes('CSS-in-JS')) return 'css-in-js'
    if (message.includes('Tailwind')) return 'tailwind-issues'
    return 'other'
  }

  findCommonViolationPatterns(entries) {
    const patterns = {}
    
    entries.forEach(([, result]) => {
      const violations = Array.isArray(result.violationsList) ? result.violationsList : []
      violations.forEach(violation => {
        const pattern = this.extractViolationPattern(violation.message || '')
        patterns[pattern] = (patterns[pattern] || 0) + 1
      })
    })

    return Object.entries(patterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }))
  }

  getEmptyAnalytics() {
    return {
      overview: {
        totalFiles: 0,
        totalViolations: 0,
        averageCoverage: 0,
        statusDistribution: { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 },
        criticalViolations: 0,
        highViolations: 0,
        mediumViolations: 0,
        lowViolations: 0
      },
      fileTypes: {
        components: 0,
        pages: 0,
        styles: 0,
        utilities: 0,
        other: 0,
        extensions: {},
        breakdown: { javascript: 0, typescript: 0, styles: 0 }
      },
      violations: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0,
        byType: {},
        topTypes: [],
        patterns: {}
      },
      components: {
        enabled: false,
        message: 'No audit data available',
        summary: { totalComponents: 0, totalUniqueComponents: 0, componentsWithThemeUsage: 0, usagePercentage: 0 }
      },
      coverage: {
        buckets: { '90-100': 0, '70-89': 0, '50-69': 0, '30-49': 0, '0-29': 0 },
        byFileType: {},
        totalFiles: 0
      },
      recommendations: [],
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  }
}

// Export the engine
module.exports = { DashboardEngine }

// CLI usage
if (require.main === module) {
  console.log('🎯 Dashboard Engine - Run via server.js or import as module')
  console.log('💡 Use: new DashboardEngine(projectRoot, config)')
}
