#!/usr/bin/env node
/**
 * Components Metrics Engine
 * Analyzes component hierarchy and theme usage for each page route
 */

const fs = require('fs')
const path = require('path')
const { analyzeFile } = require('./audit-engine')

// Common/reusable components to exclude from duplicate counting
const COMMON_COMPONENTS = new Set([
  // Layout components
  'Flex',
  'Box',
  'Grid',
  'Container',
  'Wrapper',
  'Layout',
  'Section',
  // UI components
  'Button',
  'Input',
  'Text',
  'Typography',
  'Link',
  'Image',
  'Icon',
  // Form components
  'Form',
  'Field',
  'Label',
  'Checkbox',
  'Radio',
  'Select',
  'TextArea',
  // Navigation
  'Nav',
  'Menu',
  'MenuItem',
  'Breadcrumb',
  'Tabs',
  'Tab',
  // Feedback
  'Alert',
  'Toast',
  'Modal',
  'Dialog',
  'Tooltip',
  'Loading',
  'Spinner',
  // Data display
  'Table',
  'Card',
  'List',
  'Item',
  'Badge',
  'Tag',
  'Divider',
  // Utilities
  'Portal',
  'Provider',
  'Context',
  'HOC',
  'withRouter',
  'utils',
  'helpers'
])

// Main page routes (excluding login routes)
const MAIN_PAGE_ROUTES = [
  { name: 'Dashboard', path: 'pages/Dashboard' },
  { name: 'Profile', path: 'pages/Profile' },
  { name: 'Security', path: 'pages/Security' },
  { name: 'Organisation', path: 'pages/Organisation' },
  { name: 'Bills', path: 'pages/Bills' },
  { name: 'UsersAndGroups', path: 'pages/Users' },
  { name: 'AuditLogs', path: 'pages/AuditLogs' },
  { name: 'AccountTransfer', path: 'pages/AccountTransfer' },
  { name: 'ConfigureMFA', path: 'pages/ConfigureMFA' },
  { name: 'OAuthErrorPage', path: 'pages/OAuthErrorPage' },
  { name: 'OauthConsent', path: 'pages/APIOauth/Consent' },
  { name: 'SelectAccount', path: 'pages/APIOauth/SelectAccount' },
  { name: 'ManageActiveSessions', path: 'pages/Security/SessionManagement/ManageSessions' }
]

class ComponentsMetricsEngine {
  constructor(srcPath = '../../src') {
    this.srcPath = path.resolve(__dirname, srcPath)
    this.componentTree = {}
    this.componentMetrics = {}
    this.pageMetrics = {}
    this.globalComponentRegistry = new Map() // Track all components globally
    this.uniqueComponentsPerPage = {} // Track unique components per page
    this.componentInstanceTracker = new Map() // Track component instances across pages
    this.processedFiles = new Set() // Avoid processing same file multiple times
    
    // Dynamic CSS variables and Tailwind classes
    this.validCssVariables = new Set()
    this.validTailwindClasses = new Set()
    this.validSpacingVariables = new Set()
    this.validShadowVariables = new Set()
    
    // Load design system tokens on initialization
    this.loadDesignSystemTokens()
  }  /**
   * Load CSS variables and Tailwind classes from design system files
   */
  loadDesignSystemTokens() {
    try {
      // Load CSS variables from colors.css
      this.loadCssVariablesFromFile(path.resolve(this.srcPath, 'styles/dewStyles/colors.css'))

      // Load spacing and other variables from numbers.css
      this.loadCssVariablesFromFile(path.resolve(this.srcPath, 'styles/dewStyles/numbers.css'))

      // Load Tailwind classes from tailwind-dew-colors.json
      this.loadTailwindClassesFromFile(
        path.resolve(this.srcPath, 'styles/dewStyles/tailwind-dew-colors.json')
      )

      console.log(`📋 Loaded ${this.validCssVariables.size} CSS variables`)
      console.log(`📋 Loaded ${this.validTailwindClasses.size} Tailwind classes`)
    } catch (error) {
      console.error('⚠️ Error loading design system tokens:', error.message)
      console.log('📋 Falling back to basic pattern matching')
    }
  }

  /**
   * Extract CSS variables from CSS files
   */
  loadCssVariablesFromFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Design system file not found: ${filePath}`)
        return
      }

      const content = fs.readFileSync(filePath, 'utf8')

      // Extract CSS custom properties (--variable-name)
      const cssVariablePattern = /--([\w-]+):\s*[^;}\n]+/g
      let match

      while ((match = cssVariablePattern.exec(content)) !== null) {
        const variableName = `--${match[1]}`
        this.validCssVariables.add(variableName)

        // Categorize by type for better tracking
        if (variableName.startsWith('--color-')) {
          // Color variables
        } else if (variableName.startsWith('--spacing-')) {
          this.validSpacingVariables.add(variableName)
        } else if (variableName.startsWith('--shadow-')) {
          this.validShadowVariables.add(variableName)
        }
      }

      console.log(
        `📄 Loaded ${this.validCssVariables.size} CSS variables from ${path.basename(filePath)}`
      )
    } catch (error) {
      console.error(`❌ Error reading CSS file ${filePath}:`, error.message)
    }
  }

  /**
   * Extract Tailwind classes from JSON configuration
   */
  loadTailwindClassesFromFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Tailwind config file not found: ${filePath}`)
        return
      }

      const content = fs.readFileSync(filePath, 'utf8')
      const tailwindConfig = JSON.parse(content)

      // Extract all Tailwind class names
      for (const className of Object.keys(tailwindConfig)) {
        this.validTailwindClasses.add(className)

        // Also add common Tailwind prefixes for this class
        const prefixes = ['text-', 'bg-', 'border-', 'fill-', 'stroke-', 'shadow-']
        prefixes.forEach((prefix) => {
          if (className.startsWith('color-')) {
            this.validTailwindClasses.add(`${prefix}${className}`)
          }
        })
      }

      console.log(
        `📄 Loaded ${this.validTailwindClasses.size} Tailwind classes from ${path.basename(
          filePath
        )}`
      )
    } catch (error) {
      console.error(`❌ Error reading Tailwind config ${filePath}:`, error.message)
    }
  }

  /**
   * Main method to generate comprehensive component metrics
   */
  async generateMetrics() {
    console.log('🎨 Starting Components Metrics Analysis...')

    // Step 1: Build component tree for each page
    for (const route of MAIN_PAGE_ROUTES) {
      console.log(`📄 Analyzing page: ${route.name}`)
      await this.analyzePage(route)
    }

    // Step 2: Deduplicate and categorize components
    this.deduplicateComponents()

    // Step 3: Generate summary metrics
    const summary = this.generateSummary()

    return {
      summary,
      pageMetrics: this.pageMetrics,
      componentTree: this.componentTree,
      componentMetrics: this.componentMetrics,
      uniqueComponentsPerPage: this.uniqueComponentsPerPage,
      globalComponentStats: this.getGlobalComponentStats()
    }
  }

  /**
   * Analyze a single page and its component tree
   */
  async analyzePage(route) {
    const pagePath = this.resolvePagePath(route.path)

    if (!pagePath) {
      console.log(`⚠️  Page not found: ${route.path}`)
      return
    }

    console.log(`🔍 Building component tree for: ${route.name}`)

    // Initialize page metrics
    this.pageMetrics[route.name] = {
      name: route.name,
      path: route.path,
      filePath: pagePath,
      components: [],
      totalComponents: 0,
      themeUsageCount: 0,
      averageCoverage: 0,
      status: 'pending'
    }

    // Build component tree starting from the page
    const componentTree = await this.buildComponentTree(pagePath, route.name, 0)
    this.componentTree[route.name] = componentTree

    // Calculate page-level metrics
    this.calculatePageMetrics(route.name)
  }

  /**
   * Recursively build component tree
   */
  async buildComponentTree(filePath, parentPage, depth = 0) {
    const maxDepth = 5 // Prevent infinite loops
    if (depth > maxDepth) return null

    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const componentInfo = await this.analyzeComponent(filePath, content, parentPage)

      // Find all imported components
      const imports = this.extractComponentImports(content)
      const children = []

      for (const importInfo of imports) {
        const childPath = this.resolveImportPath(importInfo.path, filePath)
        if (childPath && this.isComponentFile(childPath)) {
          const childTree = await this.buildComponentTree(childPath, parentPage, depth + 1)
          if (childTree) {
            children.push(childTree)
          }
        }
      }

      return {
        ...componentInfo,
        children,
        depth
      }
    } catch (error) {
      console.error(`Error analyzing ${filePath}:`, error.message)
      return null
    }
  }

  /**
   * Analyze individual component for theme usage
   */
  async analyzeComponent(filePath, content, parentPage) {
    const relativePath = path.relative(this.srcPath, filePath)
    const componentName = this.extractComponentName(filePath)

    // Avoid processing same file multiple times
    if (this.processedFiles.has(filePath)) {
      return this.componentMetrics[relativePath]
    }
    this.processedFiles.add(filePath)

    // Use existing audit engine to analyze violations (async)
    const auditResult = await analyzeFile(filePath)

    // Extract theme usage and usage patterns
    const themeUsage = this.extractThemeUsage(content)
    const usageInstances = this.countComponentUsageInPages(componentName, content)

    const componentInfo = {
      name: componentName,
      filePath: relativePath,
      fullPath: filePath,
      parentPage,
      coverage: auditResult.coverage || 0,
      violations: auditResult.violationsList || [],
      violationsCount: auditResult.violations || 0,
      violationAnalysis: auditResult.violationAnalysis || {},
      // New CSS Variables-based theme tracking
      cssVariables: themeUsage.cssVariables,
      cssVariableCount: themeUsage.cssVariableCount,
      tailwindClasses: themeUsage.tailwindClasses,
      tailwindCount: themeUsage.tailwindCount,
      themeUsageBreakdown: themeUsage.usageBreakdown,
      status: this.getComponentStatus(auditResult.coverage || 0),
      hasThemeUsage: themeUsage.hasUsage,
      fileType: auditResult.fileType || {},
      needsTheming: auditResult.needsTheming || false,
      usageInstances: usageInstances,
      usageDetails: {
        cssVariables: themeUsage.cssVariables,
        cssVariableCount: themeUsage.cssVariableCount,
        tailwindClasses: themeUsage.tailwindClasses,
        tailwindCount: themeUsage.tailwindCount,
        totalThemeTokens: themeUsage.cssVariableCount + themeUsage.tailwindCount,
        instances: usageInstances,
        breakdown: themeUsage.usageBreakdown
      }
    }

    // Store in component metrics and global registry
    this.componentMetrics[relativePath] = componentInfo

    // Track component instances for better deduplication
    this.trackComponentInstance(
      componentName,
      parentPage,
      usageInstances,
      componentInfo.hasThemeUsage
    )

    // Track component globally (legacy - keeping for compatibility)
    if (!this.globalComponentRegistry.has(componentName)) {
      this.globalComponentRegistry.set(componentName, {
        name: componentName,
        usedInPages: new Set([parentPage]),
        totalUsages: usageInstances.total,
        isCommon: COMMON_COMPONENTS.has(componentName),
        firstSeenAt: relativePath,
        themeUsage: componentInfo.hasThemeUsage
      })
    } else {
      const existing = this.globalComponentRegistry.get(componentName)
      existing.usedInPages.add(parentPage)
      existing.totalUsages += usageInstances.total
      if (componentInfo.hasThemeUsage) {
        existing.themeUsage = true
      }
    }

    // Add to page's component list
    if (this.pageMetrics[parentPage]) {
      this.pageMetrics[parentPage].components.push(componentInfo)
    }

    return componentInfo
  }

  /**
   * Deduplicate components and identify unique vs common components
   */
  deduplicateComponents() {
    console.log('🔍 Deduplicating components...')

    for (const pageName of Object.keys(this.pageMetrics)) {
      this.uniqueComponentsPerPage[pageName] = {
        uniqueComponents: [],
        commonComponents: [],
        pageSpecificComponents: [],
        stats: {
          total: 0,
          unique: 0,
          common: 0,
          pageSpecific: 0,
          withThemeUsage: 0
        }
      }
    }

    // Categorize each component
    for (const [componentName, info] of this.globalComponentRegistry) {
      const isCommon = info.isCommon
      const isPageSpecific = info.usedInPages.size === 1

      // Add to each page's categorized list
      for (const pageName of info.usedInPages) {
        const pageData = this.uniqueComponentsPerPage[pageName]

        if (isCommon) {
          pageData.commonComponents.push({
            name: componentName,
            ...info,
            category: 'common'
          })
        } else if (isPageSpecific) {
          pageData.pageSpecificComponents.push({
            name: componentName,
            ...info,
            category: 'page-specific'
          })
        } else {
          pageData.uniqueComponents.push({
            name: componentName,
            ...info,
            category: 'shared'
          })
        }
      }
    }

    // Calculate stats for each page
    for (const pageName of Object.keys(this.uniqueComponentsPerPage)) {
      const pageData = this.uniqueComponentsPerPage[pageName]
      const pageComponents = this.pageMetrics[pageName].components

      pageData.stats = {
        total: pageComponents.length,
        unique: pageData.uniqueComponents.length,
        common: pageData.commonComponents.length,
        pageSpecific: pageData.pageSpecificComponents.length,
        withThemeUsage: pageComponents.filter((c) => c.hasThemeUsage).length
      }

      console.log(
        `📊 ${pageName}: ${pageData.stats.total} total, ${pageData.stats.pageSpecific} page-specific, ${pageData.stats.common} common, ${pageData.stats.withThemeUsage} with theme usage`
      )
    }
  }

  /**
   * Get global component statistics
   */
  getGlobalComponentStats() {
    const stats = {
      totalUniqueComponents: this.globalComponentRegistry.size,
      commonComponents: 0,
      pageSpecificComponents: 0,
      sharedComponents: 0,
      componentsWithThemeUsage: 0,
      mostUsedComponents: [],
      mostUsedPages: {}
    }

    const componentUsage = []

    for (const [name, info] of this.globalComponentRegistry) {
      if (info.isCommon) {
        stats.commonComponents++
      } else if (info.usedInPages.size === 1) {
        stats.pageSpecificComponents++
      } else {
        stats.sharedComponents++
      }

      if (info.themeUsage) {
        stats.componentsWithThemeUsage++
      }

      componentUsage.push({
        name,
        usages: info.totalUsages,
        pages: Array.from(info.usedInPages),
        isCommon: info.isCommon,
        hasThemeUsage: info.themeUsage
      })
    }

    // Sort by usage count and get top 10
    stats.mostUsedComponents = componentUsage.sort((a, b) => b.usages - a.usages).slice(0, 10)

    // Calculate page component counts
    for (const pageName of Object.keys(this.pageMetrics)) {
      stats.mostUsedPages[pageName] = this.pageMetrics[pageName].totalComponents
    }

    return stats
  }

  /**
   * Count how many times a component is used within different contexts
   */
  countComponentUsageInPages(componentName, content) {
    const usagePatterns = [
      // JSX usage: <ComponentName
      new RegExp(`<${componentName}\\s*[^>]*>`, 'g'),
      // Import usage: import ComponentName
      new RegExp(`import\\s+(?:.*\\s+)?${componentName}(?:\\s+.*)?\\s+from`, 'g'),
      // Named import: { ComponentName }
      new RegExp(`{[^}]*\\b${componentName}\\b[^}]*}`, 'g'),
      // Function call: ComponentName(
      new RegExp(`\\b${componentName}\\s*\\(`, 'g')
    ]

    let totalInstances = 0
    const instanceDetails = {
      jsxUsage: 0,
      importUsage: 0,
      namedImport: 0,
      functionCall: 0
    }

    // Count JSX usage
    const jsxMatches = content.match(usagePatterns[0]) || []
    instanceDetails.jsxUsage = jsxMatches.length

    // Count import usage
    const importMatches = content.match(usagePatterns[1]) || []
    instanceDetails.importUsage = importMatches.length

    // Count named imports
    const namedImportMatches = content.match(usagePatterns[2]) || []
    instanceDetails.namedImport = namedImportMatches.length

    // Count function calls
    const functionCallMatches = content.match(usagePatterns[3]) || []
    instanceDetails.functionCall = functionCallMatches.length

    totalInstances =
      instanceDetails.jsxUsage +
      instanceDetails.importUsage +
      instanceDetails.namedImport +
      instanceDetails.functionCall

    return {
      total: totalInstances,
      details: instanceDetails,
      isActuallyUsed: totalInstances > 0
    }
  }

  /**
   * Track component instances across all pages for better deduplication
   */
  trackComponentInstance(componentName, parentPage, instanceCount, themeUsage) {
    if (!this.componentInstanceTracker.has(componentName)) {
      this.componentInstanceTracker.set(componentName, {
        name: componentName,
        totalInstances: 0,
        pagesUsedIn: new Map(),
        hasAnyThemeUsage: false,
        isCommon: COMMON_COMPONENTS.has(componentName)
      })
    }

    const tracker = this.componentInstanceTracker.get(componentName)
    tracker.totalInstances += instanceCount.total
    tracker.pagesUsedIn.set(parentPage, {
      instances: instanceCount.total,
      details: instanceCount.details,
      hasThemeUsage: themeUsage
    })

    if (themeUsage) {
      tracker.hasAnyThemeUsage = true
    }

    return tracker
  }
  /**
   * Extract theme usage with dynamically loaded design system tokens
   */
  extractThemeUsage(content) {
    const usage = {
      cssVariables: [],
      tailwindClasses: [],
      cssVariableCount: 0,
      tailwindCount: 0,
      hasUsage: false,
      usageBreakdown: {
        cssVariables: [],
        tailwindClasses: [],
        varFunction: [],
        dynamicAccess: []
      }
    }

    // If no design system tokens loaded, use pattern matching
    if (this.validCssVariables.size === 0) {
      return this.extractThemeUsageWithPatterns(content)
    }

    // 1. Check for CSS variable usage in var() functions
    const varUsagePattern = /var\((--[\w-]+)\)/gi
    let match
    while ((match = varUsagePattern.exec(content)) !== null) {
      const variableName = match[1]
      if (this.validCssVariables.has(variableName)) {
        usage.usageBreakdown.varFunction.push(match[0])
        usage.cssVariables.push(variableName)
      }
    }

    // 2. Check for CSS variable definitions (in case components define overrides)
    const varDefinitionPattern = /--([\w-]+):\s*[^;}\n]+/gi
    while ((match = varDefinitionPattern.exec(content)) !== null) {
      const variableName = `--${match[1]}`
      if (this.validCssVariables.has(variableName)) {
        usage.usageBreakdown.cssVariables.push(match[0])
        usage.cssVariables.push(variableName)
      }
    }

    // 3. Check for JavaScript CSS variable access
    const jsVarAccessPatterns = [
      /getPropertyValue\s*\(\s*['"`](--[\w-]+)['"`]\s*\)/gi,
      /getComputedStyle.*getPropertyValue\s*\(\s*['"`](--[\w-]+)['"`]\s*\)/gi,
      /document\.documentElement\.style\.getPropertyValue\s*\(\s*['"`](--[\w-]+)['"`]\s*\)/gi
    ]

    jsVarAccessPatterns.forEach((pattern) => {
      while ((match = pattern.exec(content)) !== null) {
        const variableName = match[1]
        if (this.validCssVariables.has(variableName)) {
          usage.usageBreakdown.dynamicAccess.push(match[0])
          usage.cssVariables.push(variableName)
        }
      }
    })

    // 4. Check for Tailwind classes
    this.validTailwindClasses.forEach((className) => {
      // Create regex pattern for the class
      const classPattern = new RegExp(
        `\\b${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'gi'
      )

      if (classPattern.test(content)) {
        usage.tailwindClasses.push(className)
        usage.usageBreakdown.tailwindClasses.push(className)
      }
    })

    // 5. Check for className strings that might contain our Tailwind classes
    const classNamePattern = /className\s*=\s*[`"']([^`"']*)[`"']/gi
    while ((match = classNamePattern.exec(content)) !== null) {
      const classNames = match[1].split(/\s+/)
      classNames.forEach((cn) => {
        if (this.validTailwindClasses.has(cn)) {
          usage.tailwindClasses.push(cn)
          usage.usageBreakdown.tailwindClasses.push(cn)
        }
      })
    }

    // Remove duplicates
    usage.cssVariables = [...new Set(usage.cssVariables)]
    usage.tailwindClasses = [...new Set(usage.tailwindClasses)]

    usage.cssVariableCount = usage.cssVariables.length
    usage.tailwindCount = usage.tailwindClasses.length

    // Component has theme usage ONLY if it uses actual design system tokens
    usage.hasUsage = usage.cssVariableCount > 0 || usage.tailwindCount > 0

    return usage
  }

  /**
   * Fallback method for pattern-based theme detection when files aren't found
   */
  extractThemeUsageWithPatterns(content) {
    const usage = {
      cssVariables: [],
      tailwindClasses: [],
      cssVariableCount: 0,
      tailwindCount: 0,
      hasUsage: false,
      usageBreakdown: {
        cssVariables: [],
        tailwindClasses: [],
        varFunction: [],
        dynamicAccess: []
      }
    }

    console.warn('📋 Using fallback pattern matching for theme detection')

    // Basic pattern matching for CSS variables
    const cssVarPattern = /var\((--color-[\w-]+)\)/gi
    let match
    while ((match = cssVarPattern.exec(content)) !== null) {
      usage.cssVariables.push(match[1])
      usage.usageBreakdown.varFunction.push(match[0])
    }

    // Basic pattern matching for common Tailwind patterns
    const tailwindPatterns = [
      /\b(text-color-[\w-]+)\b/gi,
      /\b(bg-color-[\w-]+)\b/gi,
      /\b(border-color-[\w-]+)\b/gi
    ]

    tailwindPatterns.forEach((pattern) => {
      while ((match = pattern.exec(content)) !== null) {
        usage.tailwindClasses.push(match[1])
        usage.usageBreakdown.tailwindClasses.push(match[1])
      }
    })

    usage.cssVariables = [...new Set(usage.cssVariables)]
    usage.tailwindClasses = [...new Set(usage.tailwindClasses)]
    usage.cssVariableCount = usage.cssVariables.length
    usage.tailwindCount = usage.tailwindClasses.length
    usage.hasUsage = usage.cssVariableCount > 0 || usage.tailwindCount > 0

    return usage
  }

  /**
   * Extract component imports from file content
   */
  extractComponentImports(content) {
    const imports = []

    // Match various import patterns
    const importRegex = /import\s+(?:{\s*([^}]+)\s*}|\*\s+as\s+\w+|(\w+))\s+from\s+['"]([^'"]+)['"]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const [, namedImports, defaultImport, importPath] = match

      // Skip node_modules and relative paths that aren't components
      if (importPath.startsWith('.') && this.isLikelyComponentImport(importPath)) {
        imports.push({
          path: importPath,
          type: namedImports ? 'named' : 'default',
          imports: namedImports ? namedImports.split(',').map((s) => s.trim()) : [defaultImport]
        })
      }
    }

    return imports
  }

  /**
   * Resolve import path to actual file path
   */
  resolveImportPath(importPath, fromFile) {
    const fromDir = path.dirname(fromFile)
    let resolvedPath = path.resolve(fromDir, importPath)

    // Try different extensions
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx']

    for (const ext of extensions) {
      const testPath = resolvedPath + ext
      if (fs.existsSync(testPath)) {
        return testPath
      }
    }

    return null
  }

  /**
   * Check if import path is likely a component
   */
  isLikelyComponentImport(importPath) {
    return (
      importPath.includes('/components/') ||
      importPath.includes('/pages/') ||
      /^\.\.?\/[A-Z]/.test(importPath)
    ) // Starts with capital letter
  }

  /**
   * Check if file is a component file
   */
  isComponentFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    return (
      content.includes('React') ||
      content.includes('Component') ||
      content.includes('export default') ||
      content.includes('export const')
    )
  }

  /**
   * Extract component name from file path
   */
  extractComponentName(filePath) {
    const basename = path.basename(filePath, path.extname(filePath))
    return basename === 'index' ? path.basename(path.dirname(filePath)) : basename
  }

  /**
   * Get component status based on coverage
   */
  getComponentStatus(coverage) {
    if (coverage >= 90) return 'excellent'
    if (coverage >= 70) return 'good'
    if (coverage >= 50) return 'fair'
    if (coverage >= 30) return 'poor'
    return 'critical'
  }

  /**
   * Resolve page path from route definition
   */
  resolvePagePath(routePath) {
    const srcPath = path.resolve(this.srcPath, routePath)
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx']

    for (const ext of extensions) {
      const testPath = srcPath + ext
      if (fs.existsSync(testPath)) {
        return testPath
      }
    }

    return null
  }

  /**
   * Calculate page-level metrics
   */
  calculatePageMetrics(pageName) {
    const page = this.pageMetrics[pageName]
    if (!page || page.components.length === 0) return

    const components = page.components
    page.totalComponents = components.length
    page.themeUsageCount = components.filter((c) => c.hasThemeUsage).length
    page.averageCoverage = Math.round(
      components.reduce((sum, c) => sum + c.coverage, 0) / components.length
    )
    page.status = this.getComponentStatus(page.averageCoverage)
  }

  /**
   * Generate summary metrics
   */
  generateSummary() {
    const pages = Object.values(this.pageMetrics)
    const allComponents = Object.values(this.componentMetrics)
    const globalStats = this.getGlobalComponentStats()

    const summary = {
      totalPages: pages.length,
      totalComponents: allComponents.length,
      totalUniqueComponents: globalStats.totalUniqueComponents,
      componentsWithThemeUsage: globalStats.componentsWithThemeUsage,
      usagePercentage: Math.round(
        (globalStats.componentsWithThemeUsage / globalStats.totalUniqueComponents) * 100
      ),
      componentBreakdown: {
        commonComponents: globalStats.commonComponents,
        pageSpecificComponents: globalStats.pageSpecificComponents,
        sharedComponents: globalStats.sharedComponents
      },
      // Updated theme usage metrics based on actual CSS variables and Tailwind usage
      themeUsageByType: {
        cssVariables: allComponents.reduce((sum, c) => sum + (c.cssVariableCount || 0), 0),
        tailwindClasses: allComponents.reduce((sum, c) => sum + (c.tailwindCount || 0), 0),
        totalThemeTokens: allComponents.reduce(
          (sum, c) => sum + (c.cssVariableCount || 0) + (c.tailwindCount || 0),
          0
        ),
        // Detailed breakdown
        varFunctionUsage: allComponents.reduce(
          (sum, c) => sum + (c.themeUsageBreakdown?.varFunction?.length || 0),
          0
        ),
        cssVariableDefinitions: allComponents.reduce(
          (sum, c) => sum + (c.themeUsageBreakdown?.cssVariables?.length || 0),
          0
        ),
        jsVariableAccess: allComponents.reduce(
          (sum, c) => sum + (c.themeUsageBreakdown?.dynamicAccess?.length || 0),
          0
        ),
        tailwindClassUsage: allComponents.reduce(
          (sum, c) => sum + (c.themeUsageBreakdown?.tailwindClasses?.length || 0),
          0
        )
      },
      statusDistribution: {
        excellent: allComponents.filter((c) => c.status === 'excellent').length,
        good: allComponents.filter((c) => c.status === 'good').length,
        fair: allComponents.filter((c) => c.status === 'fair').length,
        poor: allComponents.filter((c) => c.status === 'poor').length,
        critical: allComponents.filter((c) => c.status === 'critical').length
      },
      // Additional CSS variables-specific metrics
      themeAdoptionDetails: {
        componentsWithCssVariables: allComponents.filter((c) => (c.cssVariableCount || 0) > 0)
          .length,
        componentsWithTailwind: allComponents.filter((c) => (c.tailwindCount || 0) > 0).length,
        componentsWithBoth: allComponents.filter(
          (c) => (c.cssVariableCount || 0) > 0 && (c.tailwindCount || 0) > 0
        ).length,
        averageCssVariablesPerComponent:
          allComponents.length > 0
            ? Math.round(
                (allComponents.reduce((sum, c) => sum + (c.cssVariableCount || 0), 0) /
                  allComponents.length) *
                  100
              ) / 100
            : 0,
        averageTailwindPerComponent:
          allComponents.length > 0
            ? Math.round(
                (allComponents.reduce((sum, c) => sum + (c.tailwindCount || 0), 0) /
                  allComponents.length) *
                  100
              ) / 100
            : 0
      }
    }

    return summary
  }
}

// Export for use in other scripts
module.exports = { ComponentsMetricsEngine, MAIN_PAGE_ROUTES }

// CLI usage
if (require.main === module) {
  const engine = new ComponentsMetricsEngine()

  engine
    .generateMetrics()
    .then((metrics) => {
      console.log('\n🎨 Components Metrics Analysis Complete!')
      console.log('\n📊 Summary:')
      console.log(`Pages: ${metrics.summary.totalPages}`)
      console.log(`Total Components (with duplicates): ${metrics.summary.totalComponents}`)
      console.log(`Unique Components: ${metrics.summary.totalUniqueComponents}`)
      console.log(
        `With Theme Usage: ${metrics.summary.componentsWithThemeUsage} (${metrics.summary.usagePercentage}%)`
      )

      console.log('\n🔄 Component Breakdown:')
      console.log(`Common Components: ${metrics.summary.componentBreakdown.commonComponents}`)
      console.log(
        `Page-Specific Components: ${metrics.summary.componentBreakdown.pageSpecificComponents}`
      )
      console.log(`Shared Components: ${metrics.summary.componentBreakdown.sharedComponents}`)

      console.log('\n🏷️ Theme Usage by Type:')
      console.log(`CSS Variables: ${metrics.summary.themeUsageByType.cssVariables}`)
      console.log(`Tailwind Classes: ${metrics.summary.themeUsageByType.tailwindClasses}`)
      console.log(`Total Theme Tokens: ${metrics.summary.themeUsageByType.totalThemeTokens}`)

      console.log('\n🔧 Theme Usage Details:')
      console.log(`var() Function Usage: ${metrics.summary.themeUsageByType.varFunctionUsage}`)
      console.log(
        `CSS Variable Definitions: ${metrics.summary.themeUsageByType.cssVariableDefinitions}`
      )
      console.log(`JS Variable Access: ${metrics.summary.themeUsageByType.jsVariableAccess}`)

      console.log('\n📊 Theme Adoption Details:')
      console.log(
        `Components with CSS Variables: ${metrics.summary.themeAdoptionDetails.componentsWithCssVariables}`
      )
      console.log(
        `Components with Tailwind: ${metrics.summary.themeAdoptionDetails.componentsWithTailwind}`
      )
      console.log(
        `Components with Both: ${metrics.summary.themeAdoptionDetails.componentsWithBoth}`
      )
      console.log(
        `Avg CSS Variables per Component: ${metrics.summary.themeAdoptionDetails.averageCssVariablesPerComponent}`
      )
      console.log(
        `Avg Tailwind Classes per Component: ${metrics.summary.themeAdoptionDetails.averageTailwindPerComponent}`
      )

      console.log('\n📈 Status Distribution:')
      console.log(`Excellent: ${metrics.summary.statusDistribution.excellent}`)
      console.log(`Good: ${metrics.summary.statusDistribution.good}`)
      console.log(`Fair: ${metrics.summary.statusDistribution.fair}`)
      console.log(`Poor: ${metrics.summary.statusDistribution.poor}`)
      console.log(`Critical: ${metrics.summary.statusDistribution.critical}`)

      console.log('\n🔥 Most Used Components:')
      metrics.globalComponentStats.mostUsedComponents.slice(0, 5).forEach((comp) => {
        console.log(
          `${comp.name}: ${comp.usages} usages across ${comp.pages.length} pages ${
            comp.isCommon ? '(common)' : ''
          }`
        )
      })

      console.log('\n📊 Component Instance Analysis:')
      const instanceTracker = Array.from(engine.componentInstanceTracker.values())
        .sort((a, b) => b.totalInstances - a.totalInstances)
        .slice(0, 5)

      instanceTracker.forEach((comp) => {
        console.log(
          `${comp.name}: ${comp.totalInstances} total instances across ${
            comp.pagesUsedIn.size
          } pages ${comp.isCommon ? '(common)' : ''}`
        )
      })

      // Data is now runtime-only, no file saving
      console.log(`\n✅ Analysis complete - data available at runtime`)
    })
    .catch((error) => {
      console.error('❌ Error generating metrics:', error)
      process.exit(1)
    })
}
