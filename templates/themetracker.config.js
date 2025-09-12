/**
 * ThemeTracker Configuration for Your Project
 *
 * ✅ COMPREHENSIVE CSS VARIABLE FALLBACK SUPPORT
 * All CSS variable fallbacks are now properly supported and will NOT be flagged as violations:
 *
 * ✅ SUPPORTED SCENARIOS:
 * - var(--color-text-primary, #12344d)           [hex fallback]
 * - var(--button-text-align, relative)           [keyword fallback]
 * - var(--color-boundary-border-mildest , #000000) [extra spaces]
 * - Var(--position, relative)                    [uppercase "Var"]
 * - var(--font-semibold, 600)                    [numeric fallback]
 * - var(--spacing-md, 16px)                      [unit fallbacks]
 * - var(--primary, var(--secondary, fallback))   [nested variables]
 * - var( --spaced-var , value )                  [extra whitespace]
 * - VAR(--UPPERCASE-VAR, value)                  [case variations]
 *
 * This config file allows you to customize ThemeTracker behavior for your project.
 * All paths are relative to the project root where this config file is located.
 */

module.exports = {
  // =========================================================================
  // DEW DESIGN SYSTEM CONFIGURATION
  // =========================================================================
  dewConfig: {
    // Path to Dew Design System tokens/colors configuration
    // ThemeTracker will auto-detect common paths if not specified
    tokensPath: 'src/styles/dewStyles/tailwind-dew-colors.json',

    // Alternative paths to check (in order of preference)
    fallbackPaths: [
      'styles/dew/colors.json',
      'theme/dew-tokens.json',
      'dew-theme.json',
      'src/styles/tokens.json'
    ],

    // CSS variables prefix (for CSS custom properties detection)
    cssVariablePrefix: '--dew-',

    // When dew tokens are imported as a package (future support)
    packageName: '@dew/design-system', // null if not using package
    packageTokensPath: 'dist/tokens.json' // path within the package
  },

  // =========================================================================
  // SOURCE DIRECTORIES
  // =========================================================================
  sourceDirectories: {
    // Primary directories to scan (auto-detected if empty)
    include: ['src', 'app', 'components', 'lib', 'pages'],

    // Specific subdirectories to focus on (empty = scan all)
    focus: [
      // "src/components",  // Uncomment to focus only on components
      // "src/pages"        // Uncomment to focus only on pages
    ],

    // Maximum depth to scan (prevents infinite recursion)
    maxDepth: 10,

    // Auto-detect common project structures
    autoDetect: true
  },

  // =========================================================================
  // FILE TYPES TO ANALYZE
  // =========================================================================
  fileTypes: {
    // JavaScript/TypeScript files
    javascript: {
      extensions: ['js', 'jsx', 'ts', 'tsx'],
      enabled: true
    },

    // CSS/SCSS files (NEW FEATURE!)
    styles: {
      extensions: ['css', 'scss', 'sass', 'less'],
      enabled: true
    },

    // Vue.js single file components
    vue: {
      extensions: ['vue'],
      enabled: false // Enable if you're using Vue
    },

    // Svelte components
    svelte: {
      extensions: ['svelte'],
      enabled: false // Enable if you're using Svelte
    }
  },

  // =========================================================================
  // IGNORE PATTERNS (Enhanced from current logic)
  // =========================================================================
  ignore: {
    // Directory patterns to completely skip
    directories: [
      // Build outputs
      'node_modules',
      'dist',
      'build',
      'coverage',
      'out',
      '.next',
      '.nuxt',
      '.output',

      // Version control
      '.git',
      '.svn',
      '.hg',

      // IDE/Editor
      '.vscode',
      '.idea',
      '.vs',

      // Cache directories
      '.cache',
      '.parcel-cache',
      '.webpack',

      // Testing
      '__tests__',
      'test',
      'tests',
      'spec',
      'specs',

      // Documentation/Stories
      'stories',
      'docs',
      'documentation',
      '.storybook',

      // Mock/Test data
      'mocks',
      'mock',
      '__mocks__',
      'fixtures',

      // Utilities (typically no styling)
      'utils',
      'util',
      'helpers',
      'helper',
      'services',
      'service',
      'api',
      'apis',
      'store',
      'stores',
      'config',
      'configs',
      'constants',
      'constant',
      'types',
      'models',
      'interfaces',
      'enums',
      'definitions',

      // Package manager
      '.pnpm',
      '.yarn',

      // Framework specific
      'theme-tracker' // Don't scan ourselves!
    ],

    // File name patterns to skip
    filePatterns: [
      // Test files
      '*.test.*',
      '*.spec.*',
      'test.*',
      '*.test',
      '*.spec',

      // Story files
      '*.stories.*',
      '*.story.*',
      'stories.*',

      // Mock files
      '*mock*',
      '*Mock*',
      '*.mock.*',

      // TypeScript definition files
      '*.d.ts',

      // Configuration files
      '*.config.*',
      '*.conf.*',

      // Index/barrel export files (typically no styling)
      'index.*',

      // Utility file patterns
      '*.types.*',
      '*.model.*',
      '*.interface.*',
      '*.enum.*',
      '*.constants.*',
      '*.service.*',
      '*.util.*',
      '*.utils.*',
      '*.helper.*',
      '*.api.*',

      // Build/generated files
      '*.generated.*',
      '*.gen.*',
      '*.min.*',
      'bundle.*',
      'chunk.*'
    ],

    // Path patterns to skip (anywhere in the path)
    pathPatterns: [
      // Testing
      '/test/',
      '/tests/',
      '/__tests__/',
      '/spec/',
      '/specs/',

      // Stories/Documentation
      '/stories/',
      '/docs/',
      '/.storybook/',

      // Mocks
      '/mock/',
      '/mocks/',
      '/__mocks__/',
      '/fixtures/',

      // Utilities
      '/utils/',
      '/util/',
      '/helpers/',
      '/helper/',
      '/services/',
      '/service/',
      '/api/',
      '/apis/',
      '/store/',
      '/stores/',
      '/config/',
      '/configs/',
      '/constants/',
      '/constant/',
      '/types/',
      '/models/',
      '/interfaces/',
      '/enums/',
      '/definitions/',

      // Build outputs
      '/dist/',
      '/build/',
      '/coverage/',
      '/out/',
      '/.next/',

      // Version control
      '/.git/',

      // Package specific
      '/node_modules/'
    ],

    // Custom ignore patterns (regex) - for advanced users
    customPatterns: [
      // Example: Ignore files with "legacy" in the name
      // /legacy/i,
      // Example: Ignore specific file patterns
      // /\.backup\./,
      // Example: Ignore files in vendor directories
      // /\/vendor\//
    ]
  },

  // =========================================================================
  // ANALYSIS CONFIGURATION
  // =========================================================================
  analysis: {
    // Include CSS/SCSS analysis (new feature)
    includeCssFiles: true,

    // === COMPONENTS ANALYSIS (Framework-specific) ===
    // Enable/disable React/JSX component analysis
    // Set to false for non-React projects (Vue, Angular, vanilla JS, etc.)
    enableComponentsAnalysis: true,

    // Framework type for component analysis
    // Options: 'react', 'vue', 'angular', 'vanilla', 'disabled'
    frameworkType: 'react',

    // File classification thresholds
    fileClassification: {
      // Minimum lines of JSX/styling content to be considered a UI component
      minStylingLines: 3,

      // Keywords that indicate UI component files
      uiComponentIndicators: [
        'styled',
        'className',
        'css',
        'emotion',
        'makeStyles',
        'useStyles',
        'theme'
      ],

      // Keywords that indicate utility/logic files (lower styling expectations)
      utilityIndicators: [
        'util',
        'helper',
        'service',
        'api',
        'config',
        'constant',
        'type',
        'interface',
        'enum'
      ]
    },

    // Coverage calculation
    coverage: {
      // Expected coverage by file type
      expectedCoverage: {
        'ui-component': { min: 80, target: 95 },
        'page-component': { min: 60, target: 80 },
        utility: { min: 10, target: 30 },
        container: { min: 40, target: 70 },
        other: { min: 30, target: 60 }
      }
    },

    // Violation detection settings
    violations: {
      // Enable/disable specific violation types
      hardcodedColors: true,
      hardcodedSpacing: true,
      hardcodedFontSizes: true,
      hardcodedBorderRadius: true,
      hardcodedShadows: true,
      styledComponentsTheme: true,
      tailwindHardcoded: true,
      cssInJs: true,

      // CSS/SCSS specific violations (new)
      cssHardcodedValues: true,
      scssVariables: true,

      // CSS Properties to completely ignore (NEW FEATURE!)
      // Any hardcoded values for these properties will be ignored
      ignoreProperties: [
        // Example: Uncomment to ignore hardcoded values for these properties
        // 'margin',
        // 'padding',
        // 'box-shadow',
        // 'border-radius',
        // 'font-size',
        // 'gap',
        // 'top',
        // 'left',
        // 'right',
        // 'bottom'
      ],

      // Severity levels
      severityWeights: {
        'hardcoded-color': 3,
        'styled-components-theme': 2,
        'tailwind-hardcoded': 2,
        'hardcoded-spacing': 1,
        'hardcoded-font-size': 1,
        'hardcoded-border-radius': 0.5
      }
    }
  },

  // =========================================================================
  // SERVER CONFIGURATION
  // =========================================================================
  server: {
    // HTTP server port
    port: 3001,

    // Server host
    host: 'localhost',

    // Auto-open browser when starting
    autoOpen: true,

    // WebSocket configuration
    websocket: {
      port: 8080, // WebSocket will use HTTP port + 1 by default
      timeout: 30000,
      maxClients: 10
    }
  },

  // =========================================================================
  // OUTPUT CONFIGURATION
  // =========================================================================
  output: {
    // Console log level
    logLevel: 'info', // "debug", "info", "warn", "error"

    // Progress reporting
    showProgress: true,

    // Save reports to files
    saveReports: false,
    reportsDirectory: 'theme-tracker-reports',

    // Export formats
    exportFormats: ['json'] // "json", "csv", "html"
  },

  // =========================================================================
  // ADVANCED CONFIGURATION
  // =========================================================================
  advanced: {
    // Maximum files to process (safety limit)
    maxFiles: 2000,

    // Parallel processing
    concurrency: 4, // Number of files to process simultaneously

    // Memory usage optimization
    chunkSize: 100, // Process files in chunks of this size

    // Cache analysis results
    enableCache: false,
    cacheDirectory: '.theme-tracker-cache'
  }
}

/*
 * ✅ CSS VARIABLE FALLBACK SUPPORT CONFIRMED
 *
 * Your theme-tracker now correctly handles ALL CSS variable fallback scenarios:
 *
 * ✅ THESE WILL NOT BE FLAGGED (correctly excluded):
 *   - color: var(--color-text-primary, #12344d);
 *   - var(--button-text-align, relative)
 *   - var(--color-boundary-border-mildest , #000000)
 *   - Var(--position, relative)
 *   - var(--font-semibold, 600)
 *   - margin: var(--spacing-md, 16px);
 *   - font-size: var(--text-size, 14px);
 *   - border-radius: var(--radius, 8px);
 *   - background: var(--bg, rgba(255, 255, 255, 0.8));
 *   - transform: var(--transform, translateX(50%));
 *
 * ❌ THESE WILL STILL BE FLAGGED (correctly identified):
 *   - color: #12344d;                 (standalone hardcoded color)
 *   - margin: 16px;                   (standalone hardcoded spacing)
 *   - font-size: 14px;                (standalone hardcoded font size)
 *   - border-radius: 8px;             (standalone hardcoded radius)
 *   - background: red;                (standalone hardcoded color name)
 *
 * 🎯 USAGE:
 *   npx themetracker start
 *
 * 📝 CUSTOMIZATION:
 *   Edit this file to customize ThemeTracker for your specific project needs.
 *   The configuration above provides sensible defaults for most React projects.
 *
 * 🎯 NEW FEATURE: CSS Properties Ignore List
 *   Use `ignoreProperties` to completely ignore violations for specific CSS properties:
 *   ignoreProperties: ['margin', 'padding', 'box-shadow']
 *
 *   This will ignore ALL hardcoded values for those properties, useful for:
 *   - Properties you want to allow hardcoded values for
 *   - Gradual migration (ignore one property at a time)
 *   - Special cases where design system tokens don't apply
 *
 * 💡 TIPS:
 *   - Use CSS variables with fallbacks for better browser support
 *   - Focus on UI components first for maximum impact
 *   - Gradually migrate utilities and pages for comprehensive coverage
 *   - Use ignoreProperties sparingly to maintain design system consistency
 *   - Check the live dashboard at http://localhost:3001 when running
 */
