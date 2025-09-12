#!/usr/bin/env node
/**
 * Files Coverage Engine - Theme Coverage Metrics Analysis
 * Analyzes audit data and generates comprehensive coverage reports
 */

/**
 * Analyze theme coverage metrics from audit data
 * @param {Object} auditData - Raw audit data from audit-engine
 * @returns {Object} Comprehensive coverage metrics
 */
function generateCoverageMetrics(auditData) {
  const entries = Object.entries(auditData)

  if (entries.length === 0) {
    return getEmptyMetrics()
  }

  const metrics = {
    overview: calculateOverviewMetrics(entries),
    fileTypes: analyzeFileTypes(entries),
    violations: analyzeViolations(entries),
    coverage: analyzeCoverageDistribution(entries),
    trends: analyzeTrends(entries),
    recommendations: generateRecommendations(entries),
    criticalFiles: identifyCriticalFiles(entries),
    quickWins: identifyQuickWins(entries),
    patterns: analyzeViolationPatterns(entries)
  }

  return metrics
}

/**
 * Helper function to safely get violations array and count
 */
function getViolations(result) {
  return Array.isArray(result.violationsList) ? result.violationsList : []
}

function getViolationCount(result) {
  // The audit engine stores violations as a count (number) and violationsList as array
  if (typeof result.violations === 'number') {
    return result.violations
  }
  // Fallback to violationsList length if violations is not a number
  return getViolations(result).length
}

/**
 * Calculate high-level overview metrics
 */
function calculateOverviewMetrics(entries) {
  const totalFiles = entries.length
  let totalViolations = 0
  let coverageSum = 0
  const statusCounts = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    critical: 0
  }

  // Track violations by severity
  const violationsBySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  }

  entries.forEach(([, result]) => {
    totalViolations += getViolationCount(result)
    coverageSum += result.coverage
    statusCounts[result.status]++

    // Count violations by severity
    const violations = getViolations(result)
    violations.forEach((violation) => {
      if (violationsBySeverity.hasOwnProperty(violation.severity)) {
        violationsBySeverity[violation.severity]++
      }
    })
  })

  const averageCoverage = Math.round(coverageSum / totalFiles)
  const complianceScore = calculateComplianceScore(statusCounts, totalFiles)

  return {
    totalFiles,
    totalViolations,
    criticalViolations: violationsBySeverity.critical,
    highViolations: violationsBySeverity.high,
    mediumViolations: violationsBySeverity.medium,
    lowViolations: violationsBySeverity.low,
    averageCoverage,
    complianceScore,
    statusDistribution: statusCounts,
    auditedPercentage: 100 // All files in auditData are audited
  }
}

/**
 * Analyze file types and their coverage patterns
 */
function analyzeFileTypes(entries) {
  const fileTypes = {
    component: { count: 0, totalCoverage: 0, violations: 0, files: [] },
    page: { count: 0, totalCoverage: 0, violations: 0, files: [] },
    layout: { count: 0, totalCoverage: 0, violations: 0, files: [] },
    utility: { count: 0, totalCoverage: 0, violations: 0, files: [] },
    wrapper: { count: 0, totalCoverage: 0, violations: 0, files: [] },
    unknown: { count: 0, totalCoverage: 0, violations: 0, files: [] }
  }

  entries.forEach(([filePath, result]) => {
    const type = result.fileType || 'unknown'
    const typeData = fileTypes[type] || fileTypes.unknown

    typeData.count++
    typeData.totalCoverage += result.coverage
    typeData.violations += getViolationCount(result)
    typeData.files.push({ filePath, result })
  })

  // Calculate averages and insights
  Object.keys(fileTypes).forEach((type) => {
    const typeData = fileTypes[type]
    if (typeData.count > 0) {
      typeData.averageCoverage = Math.round(typeData.totalCoverage / typeData.count)
      typeData.averageViolations = Math.round(typeData.violations / typeData.count)
      typeData.worstFile = typeData.files.sort((a, b) => a.result.coverage - b.result.coverage)[0]
      typeData.bestFile = typeData.files.sort((a, b) => b.result.coverage - a.result.coverage)[0]
    } else {
      typeData.averageCoverage = 0
      typeData.averageViolations = 0
    }
  })

  return fileTypes
}

/**
 * Analyze violation patterns and types
 */
function analyzeViolations(entries) {
  const violationTypes = {}
  const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 }
  const fileViolationMap = {}

  entries.forEach(([filePath, result]) => {
    // Ensure violations is an array and get length safely
    const violations = getViolations(result)
    fileViolationMap[filePath] = violations.length

    violations.forEach((violation) => {
      // Count violation types
      if (!violationTypes[violation.type]) {
        violationTypes[violation.type] = {
          count: 0,
          severity: violation.severity,
          files: new Set(),
          examples: []
        }
      }

      violationTypes[violation.type].count++
      violationTypes[violation.type].files.add(filePath)

      if (violationTypes[violation.type].examples.length < 3) {
        violationTypes[violation.type].examples.push({
          file: filePath,
          line: violation.line,
          match: violation.match
        })
      }

      // Count by severity
      severityBreakdown[violation.severity]++
    })
  })

  // Convert Sets to counts
  Object.keys(violationTypes).forEach((type) => {
    violationTypes[type].affectedFiles = violationTypes[type].files.size
    delete violationTypes[type].files
  })

  const mostCommonViolation = Object.entries(violationTypes).sort(
    ([, a], [, b]) => b.count - a.count
  )[0]

  const mostProblematicFiles = Object.entries(fileViolationMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([filePath, count]) => ({ filePath, violationCount: count }))

  // Calculate violations from critical files only
  const criticalFileViolations = entries
    .filter(([, result]) => result.status === 'critical')
    .reduce((sum, [, result]) => sum + getViolationCount(result), 0)

  return {
    violationTypes,
    severityBreakdown,
    criticalFileViolations,
    mostCommonViolation: mostCommonViolation
      ? {
          type: mostCommonViolation[0],
          ...mostCommonViolation[1]
        }
      : null,
    mostProblematicFiles
  }
}

/**
 * Analyze coverage distribution and patterns
 */
function analyzeCoverageDistribution(entries) {
  const coverageRanges = {
    '90-100': 0,
    '80-89': 0,
    '70-79': 0,
    '60-69': 0,
    '50-59': 0,
    '40-49': 0,
    '30-39': 0,
    '20-29': 0,
    '10-19': 0,
    '0-9': 0
  }

  const coverageValues = []

  entries.forEach(([, result]) => {
    const coverage = result.coverage
    coverageValues.push(coverage)

    if (coverage >= 90) coverageRanges['90-100']++
    else if (coverage >= 80) coverageRanges['80-89']++
    else if (coverage >= 70) coverageRanges['70-79']++
    else if (coverage >= 60) coverageRanges['60-69']++
    else if (coverage >= 50) coverageRanges['50-59']++
    else if (coverage >= 40) coverageRanges['40-49']++
    else if (coverage >= 30) coverageRanges['30-39']++
    else if (coverage >= 20) coverageRanges['20-29']++
    else if (coverage >= 10) coverageRanges['10-19']++
    else coverageRanges['0-9']++
  })

  coverageValues.sort((a, b) => a - b)
  const median = coverageValues[Math.floor(coverageValues.length / 2)]
  const q1 = coverageValues[Math.floor(coverageValues.length * 0.25)]
  const q3 = coverageValues[Math.floor(coverageValues.length * 0.75)]

  return {
    ranges: coverageRanges,
    statistics: {
      median,
      q1,
      q3,
      min: Math.min(...coverageValues),
      max: Math.max(...coverageValues),
      standardDeviation: calculateStandardDeviation(coverageValues)
    }
  }
}

/**
 * Analyze trends and patterns over time (placeholder for future enhancement)
 */
function analyzeTrends(entries) {
  // For now, return current snapshot data
  // In future, this could compare with historical data
  return {
    currentSnapshot: {
      timestamp: new Date().toISOString(),
      totalFiles: entries.length,
      averageCoverage:
        entries.reduce((sum, [, result]) => sum + result.coverage, 0) / entries.length
    },
    // Placeholder for historical trends
    historical: []
  }
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(entries) {
  const recommendations = []

  // Analyze for common patterns and suggest improvements
  const lowCoverageFiles = entries.filter(([, result]) => result.coverage < 50)
  const highViolationFiles = entries.filter(([, result]) => getViolationCount(result) > 10)

  if (lowCoverageFiles.length > 0) {
    recommendations.push({
      type: 'critical',
      title: 'Address Low Coverage Files',
      description: `${lowCoverageFiles.length} files have coverage below 50%`,
      action: 'Focus on replacing hardcoded styles with theme tokens',
      priority: 'high',
      impact: 'high'
    })
  }

  if (highViolationFiles.length > 0) {
    recommendations.push({
      type: 'improvement',
      title: 'Reduce Violation Density',
      description: `${highViolationFiles.length} files have more than 10 violations each`,
      action: 'Refactor these files to use design system components',
      priority: 'medium',
      impact: 'medium'
    })
  }

  // Add more recommendation logic based on patterns
  const componentFiles = entries.filter(([, result]) => result.fileType === 'component')
  const lowCoverageComponents = componentFiles.filter(([, result]) => result.coverage < 70)

  if (lowCoverageComponents.length > 0) {
    recommendations.push({
      type: 'architecture',
      title: 'Improve Component Theming',
      description: `${lowCoverageComponents.length} components need better theme integration`,
      action: 'Components should be the most themeable - consider prop-based styling',
      priority: 'high',
      impact: 'high'
    })
  }

  return recommendations
}

/**
 * Identify critical files that need immediate attention
 */
function identifyCriticalFiles(entries) {
  return entries
    .filter(([, result]) => result.status === 'critical' || result.coverage < 30)
    .sort((a, b) => a[1].coverage - b[1].coverage)
    .slice(0, 10)
    .map(([filePath, result]) => ({
      filePath,
      coverage: result.coverage,
      violations: getViolationCount(result),
      status: result.status,
      priority: calculatePriority(result),
      estimatedEffort: estimateFixEffort(result)
    }))
}

/**
 * Identify quick wins - files that are close to the next tier
 */
function identifyQuickWins(entries) {
  const quickWins = []

  entries.forEach(([filePath, result]) => {
    const coverage = result.coverage
    let targetCoverage = null
    let effort = 'medium'

    // Check if close to next tier
    if (coverage >= 85 && coverage < 90) {
      targetCoverage = 90
      effort = 'low'
    } else if (coverage >= 65 && coverage < 70) {
      targetCoverage = 70
      effort = 'low'
    } else if (coverage >= 45 && coverage < 50) {
      targetCoverage = 50
      effort = 'medium'
    }

    if (targetCoverage) {
      quickWins.push({
        filePath,
        currentCoverage: coverage,
        targetCoverage,
        improvementNeeded: targetCoverage - coverage,
        currentStatus: result.status,
        targetStatus: getStatusFromCoverage(targetCoverage),
        effort,
        violations: getViolationCount(result)
      })
    }
  })

  return quickWins.sort((a, b) => a.improvementNeeded - b.improvementNeeded).slice(0, 15)
}

/**
 * Analyze violation patterns across files
 */
function analyzeViolationPatterns(entries) {
  const patterns = {
    fileTypeViolations: {},
    commonViolationCombinations: {},
    violationHotspots: []
  }

  // Analyze violations by file type
  entries.forEach(([, result]) => {
    const fileType = result.fileType || 'unknown'
    if (!patterns.fileTypeViolations[fileType]) {
      patterns.fileTypeViolations[fileType] = {}
    }

    // Ensure violations is an array
    const violations = getViolations(result)
    violations.forEach((violation) => {
      const type = violation.type
      patterns.fileTypeViolations[fileType][type] =
        (patterns.fileTypeViolations[fileType][type] || 0) + 1
    })
  })

  return patterns
}

/**
 * Helper Functions
 */

function getEmptyMetrics() {
  return {
    overview: {
      totalFiles: 0,
      totalViolations: 0,
      averageCoverage: 0,
      complianceScore: 0,
      statusDistribution: { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 },
      auditedPercentage: 0
    },
    fileTypes: {},
    violations: {
      violationTypes: {},
      severityBreakdown: {},
      mostCommonViolation: null,
      mostProblematicFiles: []
    },
    coverage: { ranges: {}, statistics: {} },
    trends: { currentSnapshot: {}, historical: [] },
    recommendations: [],
    criticalFiles: [],
    quickWins: [],
    patterns: {}
  }
}

function calculateComplianceScore(statusCounts, totalFiles) {
  if (totalFiles === 0) return 0

  const weights = { excellent: 100, good: 80, fair: 60, poor: 40, critical: 20 }
  let weightedSum = 0

  Object.entries(statusCounts).forEach(([status, count]) => {
    weightedSum += count * weights[status]
  })

  return Math.round(weightedSum / totalFiles)
}

function calculateStandardDeviation(values) {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  return Math.round(Math.sqrt(avgSquaredDiff) * 100) / 100
}

function calculatePriority(result) {
  if (result.coverage < 20) return 'critical'
  if (result.coverage < 40 || getViolationCount(result) > 15) return 'high'
  if (result.coverage < 60 || getViolationCount(result) > 8) return 'medium'
  return 'low'
}

function estimateFixEffort(result) {
  const violationCount = getViolationCount(result)
  if (violationCount < 5) return 'low'
  if (violationCount < 15) return 'medium'
  return 'high'
}

function getStatusFromCoverage(coverage) {
  if (coverage === 100) return 'excellent';
  if (coverage >= 90) return 'good';
  if (coverage >= 70) return 'fair';
  if (coverage >= 50) return 'poor';
  return 'critical';
}

/**
 * Export functions
 */
module.exports = {
  generateCoverageMetrics,
  calculateOverviewMetrics,
  analyzeFileTypes,
  analyzeViolations,
  analyzeCoverageDistribution,
  identifyCriticalFiles,
  identifyQuickWins
}

// CLI usage
if (require.main === module) {
  console.log('Files Coverage Engine - Use as module or via ThemeTracker server')
  console.log('Example: const { generateCoverageMetrics } = require("./files-coverage-engine")')
}
