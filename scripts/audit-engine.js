#!/usr/bin/env node
/**
 * ThemeTracker v0.2 - Enhanced Audit Engine
 * Real-time theme auditing with live UI updates
 */

const fs = require('fs')
const path = require('path')

// Load approved Tailwind colors from tailwind-dew-colors.json
const loadApprovedTailwindColors = () => {
  try {
    const dewColorsPath = path.join(
      __dirname,
      '../../src/styles/dewStyles/tailwind-dew-colors.json'
    )
    const dewColors = JSON.parse(fs.readFileSync(dewColorsPath, 'utf8'))
    return Object.keys(dewColors)
  } catch (error) {
    console.warn('Warning: Could not load tailwind-dew-colors.json, using fallback color list')
    return [
      'color-text-brand',
      'color-text-primary',
      'color-text-secondary',
      'color-fill-brand',
      'color-fill-surface',
      'color-boundary-border'
    ] // Fallback minimal list
  }
}

const APPROVED_TAILWIND_COLORS = loadApprovedTailwindColors()

// Create dynamic Tailwind violation checker
const createTailwindColorViolationChecker = () => {
  const approvedColorPattern = APPROVED_TAILWIND_COLORS.join('|')
  return {
    unapprovedColorTokens: new RegExp(
      'className\\s*=\\s*[\\`"\'].*(?:bg-color-(?!(?:' +
        approvedColorPattern +
        '))[a-zA-Z-]+|text-color-(?!(?:' +
        approvedColorPattern +
        '))[a-zA-Z-]+|border-color-(?!(?:' +
        approvedColorPattern +
        '))[a-zA-Z-]+).*[\\`"\']',
      'g'
    ),
    approvedColorTokens: new RegExp('(?:bg-|text-|border-)(?:' + approvedColorPattern + ')', 'g')
  }
}

const tailwindColorChecker = createTailwindColorViolationChecker()

// Enhanced violation patterns for Dew Design System
// Note: width, height, and line-height are excluded from hardcoded spacing violations
// as these are typically dynamic, structural properties that cannot be consumed from CSS variables
const VIOLATION_PATTERNS = [
  {
    type: 'hardcoded-color',
    pattern: /#[0-9a-fA-F]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/g,
    severity: 'high',
    suggestion: 'Use theme.colors or CSS custom properties from Dew Design System'
  },
  // Tailwind CSS violation patterns
  {
    type: 'tailwind-hardcoded-colors',
    pattern: /className\s*=\s*["'`][^"'`]*(?:bg-(?:red|blue|green|yellow|purple|pink|gray|indigo|cyan|teal|orange|amber|lime|emerald|sky|violet|fuchsia|rose)-\d+|text-(?:red|blue|green|yellow|purple|pink|gray|indigo|cyan|teal|orange|amber|lime|emerald|sky|violet|fuchsia|rose)-\d+|border-(?:red|blue|green|yellow|purple|pink|gray|indigo|cyan|teal|orange|amber|lime|emerald|sky|violet|fuchsia|rose)-\d+)[^"'`]*["'`]/g,
    severity: 'high',
    suggestion: 'Replace Tailwind hardcoded colors with custom CSS variables or theme-based classes'
  },
  {
    type: 'tailwind-hardcoded-spacing',
    pattern: /className\s*=\s*["'`][^"'`]*(?:p-\d+|px-\d+|py-\d+|pt-\d+|pb-\d+|pl-\d+|pr-\d+|m-\d+|mx-\d+|my-\d+|mt-\d+|mb-\d+|ml-\d+|mr-\d+|gap-\d+|space-x-\d+|space-y-\d+)[^"'`]*["'`]/g,
    severity: 'medium',
    suggestion: 'Replace Tailwind hardcoded spacing with design system spacing tokens'
  },
  {
    type: 'tailwind-hardcoded-sizing',
    pattern: /className\s*=\s*["'`][^"'`]*(?:w-\d+|h-\d+|min-w-\d+|min-h-\d+|max-w-\d+|max-h-\d+)[^"'`]*["'`]/g,
    severity: 'low',
    suggestion: 'Consider using design system sizing tokens for consistent layouts'
  },
  {
    type: 'tailwind-hardcoded-typography',
    pattern: /className\s*=\s*["'`][^"'`]*(?:text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black))[^"'`]*["'`]/g,
    severity: 'medium',
    suggestion: 'Use design system typography tokens instead of Tailwind font utilities'
  },
  {
    type: 'tailwind-hardcoded-borders',
    pattern: /className\s*=\s*["'`][^"'`]*(?:border-\d+|rounded-(?:none|sm|md|lg|xl|2xl|3xl|full)|border-(?:solid|dashed|dotted|double|hidden|none))[^"'`]*["'`]/g,
    severity: 'low',
    suggestion: 'Use design system border and radius tokens for consistency'
  },
  {
    type: 'tailwind-arbitrary-values',
    pattern: /className\s*=\s*["'`][^"'`]*\[[^\]]+\][^"'`]*["'`]/g,
    severity: 'high',
    suggestion:
      'Replace Tailwind arbitrary values with design system tokens or custom CSS variables'
  },
  {
    type: 'hardcoded-layout-positioning',
    pattern: /(?:gap|top|right|bottom|left):\s*(?!var\()[^;]*\d+(?:\.\d+)?(?:px|rem|em)[^;]*/g,
    severity: 'medium',
    suggestion:
      'Replace hardcoded gap/positioning values with CSS variables (e.g., var(--spacing-xs), var(--spacing-md), var(--spacing-lg))'
  },
  {
    type: 'hardcoded-margin-padding',
    pattern: /(?:margin|padding):\s*[^;]*\d+(?:\.\d+)?px[^;]*/g,
    severity: 'medium',
    suggestion:
      'Replace margin/padding values with CSS variables or theme spacing tokens (e.g., var(--spacing-xs), var(--spacing-sm))'
  },
  {
    type: 'hardcoded-font-size',
    pattern: /font-size:\s*\d+px/g,
    severity: 'medium',
    suggestion: 'Use theme.typography.fontSize tokens'
  },
  {
    type: 'hardcoded-border-radius',
    pattern: /border-radius:\s*\d+px/g,
    severity: 'low',
    suggestion: 'Use theme.radius tokens'
  },
  {
    type: 'hardcoded-box-shadow',
    pattern: /box-shadow:\s*[^;]+;/g,
    severity: 'low',
    suggestion: 'Use theme.shadows tokens'
  },
  {
    type: 'theme-object-box-shadow',
    pattern: /box-shadow:\s*[^;]*\$\{\s*\(\{\s*theme:\s*\{\s*colors?\s*\}\s*\}\)\s*=>\s*[^}]+\}/g,
    severity: 'high',
    suggestion: 'Replace theme object usage with CSS variables (e.g., var(--color-card-box-shadow))'
  },
  {
    type: 'theme-object-color',
    pattern: /color:\s*\$\{\s*\(\{\s*theme:\s*\{\s*colors?\s*\}\s*\}\)\s*=>\s*[^}]+\}/g,
    severity: 'high',
    suggestion: 'Replace theme object usage with CSS variables (e.g., var(--color-text-primary))'
  },
  {
    type: 'theme-object-border',
    pattern: /border:\s*[^;]*\$\{\s*\(\{\s*theme:\s*\{\s*palette:\s*\{\s*s\s*\}\s*\}\s*\}\)\s*=>\s*[^}]+\}/g,
    severity: 'high',
    suggestion: 'Replace theme object usage with CSS variables (e.g., var(--color-border-100))'
  },
  {
    type: 'styled-components-theme-destructure',
    pattern: /\$\{\s*\(\{\s*theme:\s*\{[^}]*\}\s*\}\)\s*=>\s*[^}]*\}/g,
    severity: 'high',
    suggestion: 'Replace styled-components theme destructuring with CSS variables'
  },
  {
    type: 'styled-components-multiline-theme-function',
    pattern: /\$\{\s*\(\{\s*theme[^}]*\}\s*\)\s*=>\s*\{[\s\S]*?return\s*`[\s\S]*?`[\s\S]*?\}\s*\}/g,
    severity: 'critical',
    suggestion:
      'Replace multiline theme function with CSS variables. Convert theme.colors access to var(--color-*) and move complex logic to separate functions.'
  },
  {
    type: 'styled-components-theme-parameter-destructure',
    pattern: /\$\{\s*\(\{\s*theme[^}]*\}\s*\)\s*=>\s*/g,
    severity: 'high',
    suggestion:
      'Replace theme parameter destructuring with CSS variables. Use var(--color-*), var(--spacing-*), etc. instead of accessing theme object.'
  },
  {
    type: 'theme-colors-access',
    pattern: /\$\{\s*\(\{\s*theme:\s*\{\s*colors?\s*\}\s*\}\)\s*=>\s*colors?\.[^}]+\}/g,
    severity: 'high',
    suggestion: 'Replace theme.colors access with CSS variables (e.g., var(--color-*))'
  },
  {
    type: 'theme-palette-access',
    pattern: /\$\{\s*\(\{\s*theme:\s*\{\s*palette[^}]*\}\s*\}\)\s*=>\s*[^}]+\}/g,
    severity: 'high',
    suggestion: 'Replace theme.palette access with CSS variables (e.g., var(--color-*))'
  },
  {
    type: 'multiline-theme-destructure',
    pattern: /\$\{\(\{\s*theme:\s*\{\s*palette:\s*\{\s*s\s*\}\s*\}\s*\}\)\s*=>\s*s\[\d+\]\}/gs,
    severity: 'high',
    suggestion:
      'Replace multiline theme.palette destructuring with CSS variables (e.g., var(--color-s-100))'
  },
  {
    type: 'template-literal-theme-access',
    pattern: /\$\{[^}]*\btheme\.[^}]*\}/g,
    severity: 'medium',
    suggestion: 'Replace template literal theme access with CSS variables'
  },
  {
    type: 'theme-destructuring-colors',
    pattern: /theme:\s*\{\s*colors:\s*\{[^}]*\}\s*\}/g,
    severity: 'critical',
    suggestion:
      'Replace theme.colors destructuring with CSS variables (var(--color-*)). Theme objects should not be used as we move to CSS variables as single source of truth'
  },
  {
    type: 'hardcoded-color-names',
    pattern: /(?:background-color|color|border-color|fill|stroke):\s*(?:\$\{[^}]*\?\s*)?['"`]?(white|black|transparent|red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta)['"`]?(?:[^}]*\})?/gi,
    severity: 'high',
    suggestion:
      'Replace hardcoded color names with CSS variables (e.g., var(--color-white), var(--color-transparent))'
  },
  {
    type: 'template-literal-hardcoded-colors',
    pattern: /(?:background-color|color|border-color|fill|stroke):\s*\$\{[^}]*(?:white|black|transparent|red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta)[^}]*\}/gi,
    severity: 'high',
    suggestion: 'Replace hardcoded color names in template literals with CSS variables'
  },
  {
    type: 'mixed-theme-hardcoded-colors',
    pattern: /(?:background-color|color|border-color):\s*\$\{[^}]*(?:primary|white|black|transparent)[^}]*transparent[^}]*\}/gi,
    severity: 'high',
    suggestion: 'Replace mixed theme colors and hardcoded values with consistent CSS variables'
  },
  {
    type: 'js-object-layout-positioning',
    pattern: /(?:gap|top|right|bottom|left):\s*['"`](?!var\()[^'"`]*\d+(?:\.\d+)?(?:px|rem|em)[^'"`]*['"`]/g,
    severity: 'medium',
    suggestion:
      'Replace hardcoded gap/positioning in JavaScript objects with CSS variables (e.g., "var(--spacing-xs)", "var(--spacing-md)")'
  },
  {
    type: 'js-object-margin-padding',
    pattern: /(?:margin|padding):\s*['"`][^'"`]*\d+(?:\.\d+)?px[^'"`]*['"`]/g,
    severity: 'medium',
    suggestion:
      'Replace margin/padding in JavaScript objects with CSS variables or theme tokens (e.g., var(--spacing-xs))'
  },
  {
    type: 'js-object-hardcoded-font-size',
    pattern: /fontSize:\s*['"`][^'"`]*\d+px[^'"`]*['"`]/g,
    severity: 'medium',
    suggestion:
      'Replace hardcoded font-size in JavaScript objects with CSS variables or theme tokens'
  },
  {
    type: 'js-object-hardcoded-color',
    pattern: /(?:color|backgroundColor|borderColor):\s*['"`](#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\))[^'"`]*['"`]/g,
    severity: 'high',
    suggestion: 'Replace hardcoded colors in JavaScript objects with CSS variables or theme tokens'
  },
  {
    type: 'complex-theme-destructuring',
    pattern: /\$\{\s*\(\{\s*theme:\s*\{\s*(?:typography|colors?|palette)[\s\S]*?\}\s*(?:,[\s\S]*?)?\}\s*\)\s*=>\s*[\s\S]*?\}/g,
    severity: 'critical',
    suggestion:
      'Replace complex theme destructuring with CSS variables. Use var(--color-*), var(--typography-*) instead of theme object access'
  },
  // Tailwind CSS violations - enforcing tailwind-dew-colors.json as single source of truth
  {
    type: 'tailwind-hardcoded-colors',
    pattern: /className\s*=\s*[`"'].*(?:bg-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white|transparent)(?:-\d+)?|text-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|border-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?).*[`"']/g,
    severity: 'critical',
    suggestion:
      'Use approved Tailwind color tokens from tailwind-dew-colors.json instead of hardcoded colors (e.g., bg-color-fill-brand, text-color-text-primary)'
  },
  {
    type: 'tailwind-arbitrary-color-values',
    pattern: /className\s*=\s*[`"'].*(?:bg-\[#[0-9a-fA-F]{3,6}\]|text-\[#[0-9a-fA-F]{3,6}\]|border-\[#[0-9a-fA-F]{3,6}\]|bg-\[rgb\([^)]+\)\]|text-\[rgb\([^)]+\)\]|border-\[rgb\([^)]+\)\]).*[`"']/g,
    severity: 'critical',
    suggestion:
      'Replace arbitrary color values in Tailwind classes with approved tokens from tailwind-dew-colors.json'
  },
  {
    type: 'tailwind-unapproved-color-tokens',
    pattern: /className\s*=\s*[`"'].*(?:bg-color-[a-zA-Z-]+|text-color-[a-zA-Z-]+|border-color-[a-zA-Z-]+).*[`"']/g,
    severity: 'high',
    suggestion:
      'Use only approved color tokens from tailwind-dew-colors.json. Check the approved token list and replace with correct token name'
  },
  {
    type: 'tailwind-template-literal-hardcoded-colors',
    pattern: /className\s*=\s*`.*\$\{[^}]*\}.*(?:bg-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|text-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|border-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?).*`/g,
    severity: 'critical',
    suggestion:
      'Replace hardcoded Tailwind colors in template literals with approved tokens from tailwind-dew-colors.json'
  },
  {
    type: 'tailwind-conditional-hardcoded-colors',
    pattern: /className\s*=\s*[`"'].*\$\{[^}]*\?\s*['"`]?(?:bg-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|text-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|border-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?)['"`]?[^}]*\}.*[`"']/g,
    severity: 'high',
    suggestion:
      'Replace hardcoded colors in conditional Tailwind classes with approved tokens from tailwind-dew-colors.json'
  }
]

// Enhanced theme token patterns including Dew Design System
const THEME_TOKEN_PATTERNS = [
  // Dew Design System patterns
  /--color-[a-zA-Z-]+/g,
  /var\(--color-[^)]+\)/g,
  /\.dew-[a-zA-Z-]+/g,

  // Tailwind CSS approved color patterns from tailwind-dew-colors.json
  tailwindColorChecker.approvedColorTokens,

  // Traditional theme patterns
  /theme\.colors/g,
  /theme\.layout/g,
  /theme\.typography/g,
  /theme\.spacing/g,
  /theme\.breakpoints/g,
  /theme\.shadows/g,
  /theme\.borders/g,
  /theme\.radius/g,

  // Palette patterns
  /palette\./g,
  /palette\.primary/g,
  /palette\.secondary/g,

  // CSS-in-JS theme references
  /props\.theme\./g,
  /\$\{[^}]*theme[^}]*\}/g,

  // Generic theme usage
  /theme\./g
]

// File type classification patterns for contextual analysis
const FILE_TYPE_PATTERNS = {
  container: {
    patterns: [
      /Scroller/i,
      /InfiniteScroller/i,
      /InfiniteLoader/i,
      /VirtualList/i,
      /DataManager/i,
      /Manager/i,
      /Loader/i,
      /Infinite/i,
      /Virtual/i,
      /ScrollContainer/i,
      /ListContainer/i,
      /GridContainer/i,
      /TableContainer/i,
      /FormContainer/i,
      /ModalContainer/i,
      /DialogContainer/i
    ],
    expectedStyling: 'none', // Container components manage behavior, not appearance
    themeableProperties: [],
    coverageExpectation: 100, // Should be 100% since no styling expected
    description: 'Container/logic components that manage behavior and data flow'
  },
  layout: {
    patterns: [
      /Layout/i,
      /Header/i,
      /Footer/i,
      /Sidebar/i,
      /Navigation/i,
      /NavBar/i,
      /Menu/i,
      /Shell/i,
      /MainLayout/i,
      /PageLayout/i,
      /AppLayout/i
    ],
    expectedStyling: 'high', // Layout files are expected to have lots of styling
    themeableProperties: ['spacing', 'colors', 'breakpoints', 'layout'],
    coverageExpectation: 70, // Lower threshold due to structural nature
    description: 'Layout components that define page structure'
  },
  component: {
    patterns: [
      /Button/i,
      /Input/i,
      /Form(?!Container)/i, // Form but not FormContainer
      /Card/i,
      /Modal(?!Container)/i, // Modal but not ModalContainer
      /Dialog(?!Container)/i, // Dialog but not DialogContainer
      /Tooltip/i,
      /Dropdown/i,
      /Select/i,
      /Table(?!Container)/i, // Table but not TableContainer
      /Item/i,
      /Panel/i,
      /Tab/i,
      /Badge/i,
      /Alert/i,
      /Icon/i,
      /Avatar/i,
      /Chip/i,
      /Progress/i,
      /Slider/i,
      /Switch/i,
      /Checkbox/i,
      /Radio/i,
      /Calendar/i,
      /DatePicker/i,
      /TimePicker/i,
      /Accordion/i,
      /Carousel/i,
      /Stepper/i,
      /Breadcrumb/i
    ],
    expectedStyling: 'high', // UI components should be heavily themed
    themeableProperties: ['colors', 'typography', 'spacing', 'borders', 'shadows'],
    coverageExpectation: 85, // High expectation for UI components
    description: 'Reusable UI components with strong theming requirements'
  },
  utility: {
    patterns: [
      /Utils?/i,
      /Helper/i,
      /Service/i,
      /Api/i,
      /Hook/i,
      /Context/i,
      /Provider/i,
      /Store/i,
      /Action/i,
      /Reducer/i,
      /Constant/i,
      /Config/i,
      /Type/i,
      /Interface/i,
      /Schema/i,
      /Middleware/i,
      /Interceptor/i,
      /Validator/i,
      /Parser/i,
      /Transform/i,
      // TypeScript-specific patterns
      /Types/i,
      /Models/i,
      /Definitions/i,
      /Enums?/i,
      /\.types$/i,
      /\.model$/i,
      /\.interface$/i,
      /\.enum$/i,
      /\.constants?$/i
    ],
    expectedStyling: 'none', // Utility files shouldn't have styling
    themeableProperties: [],
    coverageExpectation: 100, // Should be 100% since no styling expected
    description: 'Utility files with logic, configs, or data structures'
  },
  wrapper: {
    patterns: [
      /Wrapper/i,
      /Container/i,
      /HOC/i,
      /WithAuth/i,
      /WithData/i,
      /WithTheme/i,
      /Provider/i,
      /Boundary/i,
      /Guard/i
    ],
    expectedStyling: 'minimal', // Wrapper components may have minimal structural styling
    themeableProperties: ['layout', 'spacing'],
    coverageExpectation: 90, // High expectation but allowance for structural needs
    description: 'Wrapper components that provide context or higher-order functionality'
  },
  page: {
    patterns: [
      /Page/i,
      /View/i,
      /Screen/i,
      /Route/i,
      /Dashboard/i,
      /Home/i,
      /Login/i,
      /Register/i,
      /Profile/i,
      /Settings/i,
      /Admin/i,
      /Report/i,
      /Detail/i,
      /Edit/i,
      /Create/i,
      /List(?!Container)/i // List but not ListContainer
    ],
    expectedStyling: 'medium', // Pages coordinate components, moderate styling
    themeableProperties: ['layout', 'spacing', 'colors'],
    coverageExpectation: 75, // Moderate expectation for pages
    description: 'Page-level components that coordinate other components'
  }
}

// Themeable vs Non-themeable property classification
const THEMEABLE_PROPERTIES = {
  high: ['color', 'backgroundColor', 'borderColor', 'boxShadow'],
  medium: ['fontSize', 'fontWeight', 'fontFamily', 'lineHeight'],
  low: ['margin', 'padding', 'gap', 'borderRadius', 'border']
}

const NON_THEMEABLE_PROPERTIES = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'lineHeight',
  'overflow',
  'overflowX',
  'overflowY',
  'visibility',
  'opacity',
  'transform',
  'transition',
  'animation',
  'cursor',
  'pointerEvents',
  'userSelect',
  'whiteSpace',
  'textAlign',
  'textDecoration',
  'listStyle',
  'content',
  'zIndex',
  'flex',
  'flexDirection',
  'justifyContent',
  'alignItems',
  'flexWrap',
  'flexGrow',
  'flexShrink'
]

/**
 * Determine file type based on filename and path patterns with enhanced content analysis
 */
const determineFileType = (filePath, content) => {
  const fileName = path.basename(filePath, path.extname(filePath))
  const fullPath = filePath.toLowerCase()

  // First, check for specific container/logic patterns that should take precedence
  const containerPatterns = FILE_TYPE_PATTERNS.container.patterns
  const isContainer = containerPatterns.some((pattern) => {
    return pattern.test(fileName) || pattern.test(fullPath)
  })

  if (isContainer) {
    const confidence = calculateTypeConfidence(filePath, content, FILE_TYPE_PATTERNS.container)
    return {
      type: 'container',
      ...FILE_TYPE_PATTERNS.container,
      confidence
    }
  }

  // Then check utility patterns
  const utilityPatterns = FILE_TYPE_PATTERNS.utility.patterns
  const isUtility = utilityPatterns.some((pattern) => {
    return pattern.test(fileName) || pattern.test(fullPath)
  })

  if (isUtility) {
    const confidence = calculateTypeConfidence(filePath, content, FILE_TYPE_PATTERNS.utility)
    return {
      type: 'utility',
      ...FILE_TYPE_PATTERNS.utility,
      confidence
    }
  }

  // Check remaining file type patterns
  for (const [type, config] of Object.entries(FILE_TYPE_PATTERNS)) {
    if (type === 'container' || type === 'utility') continue // Already checked

    const isMatch = config.patterns.some((pattern) => {
      return pattern.test(fileName) || pattern.test(fullPath)
    })

    if (isMatch) {
      return {
        type,
        ...config,
        confidence: calculateTypeConfidence(filePath, content, config)
      }
    }
  }

  // Enhanced content-based classification for edge cases
  const contentClassification = classifyByContent(content)
  if (contentClassification) {
    return {
      type: contentClassification.type,
      ...FILE_TYPE_PATTERNS[contentClassification.type],
      confidence: contentClassification.confidence
    }
  }

  // Default to component if no specific pattern matches
  return {
    type: 'component',
    ...FILE_TYPE_PATTERNS.component,
    confidence: 0.5
  }
}

/**
 * Classify file type based on content analysis
 */
const classifyByContent = (content) => {
  // Check for pure logic patterns
  const logicPatterns = [
    /class.*extends.*Component/g,
    /useEffect|useState|useCallback|useMemo|useRef/g,
    /InfiniteLoader|FixedSizeList|VariableSizeList/g,
    /DataManager|makeRequest/g,
    /PropTypes\./g,
    /componentDidUpdate|componentDidMount/g
  ]

  const stylingPatterns = [
    /styled\./g,
    /css`/g,
    /emotion/g,
    /makeStyles/g,
    /createStyles/g,
    /style\s*=\s*\{[^}]*(?:color|background|margin|padding|border)/g
  ]

  const logicMatches = logicPatterns.reduce((count, pattern) => {
    const matches = content.match(pattern)
    return count + (matches ? matches.length : 0)
  }, 0)

  const stylingMatches = stylingPatterns.reduce((count, pattern) => {
    const matches = content.match(pattern)
    return count + (matches ? matches.length : 0)
  }, 0)

  // If high logic content and low/no styling, classify as container
  if (logicMatches >= 5 && stylingMatches === 0) {
    return { type: 'container', confidence: 0.8 }
  }

  // If moderate logic and no styling, classify as utility
  if (logicMatches >= 2 && stylingMatches === 0) {
    return { type: 'utility', confidence: 0.7 }
  }

  return null
}

/**
 * Calculate confidence score for file type classification
 */
const calculateTypeConfidence = (filePath, content, typeConfig) => {
  let confidence = 0.7 // Base confidence

  // Boost confidence based on content analysis
  const hasStyledComponents = /styled\./g.test(content)
  const hasCSSInJS = /css`/g.test(content)
  const hasInlineStyles = /style\s*=/g.test(content)
  const hasThemeUsage = /theme\./g.test(content)

  // Enhanced content analysis
  const hasReactHooks = /use[A-Z][a-zA-Z]*/g.test(content)
  const hasClassComponent = /class.*extends.*Component/g.test(content)
  const hasLogicPatterns = /InfiniteLoader|DataManager|makeRequest|componentDidUpdate/g.test(
    content
  )
  const hasPropTypes = /PropTypes\./g.test(content)

  switch (typeConfig.expectedStyling) {
    case 'high':
      if (hasStyledComponents || hasCSSInJS) {
        confidence += 0.2
      }
      if (hasThemeUsage && typeConfig.themeableProperties.length > 0) {
        confidence += 0.1
      }
      break

    case 'none':
      // For utility/container components
      if (!hasStyledComponents && !hasCSSInJS && !hasInlineStyles) {
        confidence += 0.3
      }
      if (hasLogicPatterns || hasReactHooks || hasClassComponent) {
        confidence += 0.2
      }
      if (hasPropTypes) {
        confidence += 0.1
      }
      break

    case 'minimal':
      // For wrapper components
      if (hasReactHooks || hasClassComponent) {
        confidence += 0.1
      }
      if (!hasStyledComponents && !hasCSSInJS) {
        confidence += 0.1
      }
      break

    case 'medium':
      // For page components
      if (hasLogicPatterns && (hasStyledComponents || hasCSSInJS)) {
        confidence += 0.2
      }
      break
  }

  return Math.min(confidence, 1.0)
}

/**
 * Calculate contextual coverage based on file type
 */
const calculateContextualCoverage = (content, violations, themeTokens, fileType) => {
  // Get base coverage using existing logic
  const baseCoverage = calculateCoverage(content, violations, themeTokens)

  // Apply contextual adjustments based on file type
  let adjustedCoverage = baseCoverage

  switch (fileType.type) {
    case 'container':
      // Container components should have no styling - if they don't, perfect score
      const hasContainerStyling = needsTheming(content)
      if (!hasContainerStyling && violations.length === 0) {
        adjustedCoverage = 100
      } else if (!hasContainerStyling && violations.length > 0) {
        // Container files with violations but no detected styling - major penalty
        adjustedCoverage = Math.max(baseCoverage - 30, 0)
      } else {
        // Penalize container files that have styling (they shouldn't)
        adjustedCoverage = Math.max(baseCoverage - 25, 0)
      }
      break

    case 'utility':
      // Utility files shouldn't have styling - if they don't, they get perfect score
      const hasAnyStyling = needsTheming(content)
      if (!hasAnyStyling && violations.length === 0) {
        adjustedCoverage = 100
      } else if (!hasAnyStyling && violations.length > 0) {
        // Utility files with violations but no detected styling - major penalty
        adjustedCoverage = Math.max(baseCoverage - 30, 0)
      } else {
        // Penalize utility files that have styling
        adjustedCoverage = Math.max(baseCoverage - 20, 0)
      }
      break

    case 'wrapper':
      // Wrapper components may have minimal structural styling
      const hasMinimalStyling = needsTheming(content)
      if (!hasMinimalStyling && violations.length === 0) {
        adjustedCoverage = 100
      } else if (hasMinimalStyling && violations.length <= 2) {
        // Allow minimal styling with few violations
        adjustedCoverage = Math.min(baseCoverage + 10, 95)
      } else if (violations.length > 2) {
        // Penalize excessive violations
        adjustedCoverage = Math.max(baseCoverage - 15, 0)
      }
      break

    case 'layout':
      // Layout files are expected to have lots of styling, so be more lenient
      // But still apply penalties for violations
      if (violations.length > 0) {
        adjustedCoverage = Math.min(baseCoverage + 5, 95) // Cap at 95% if violations exist
      } else {
        adjustedCoverage = Math.min(baseCoverage + 10, 100)
      }
      break

    case 'component':
      // Components should be heavily themed, maintain strict standards
      // Apply extra penalty for violations in components
      if (violations.length > 0) {
        const extraPenalty = Math.min(violations.length * 3, 15)
        adjustedCoverage = Math.max(baseCoverage - extraPenalty, 0)
      } else {
        adjustedCoverage = baseCoverage
      }
      break

    case 'page':
      // Pages coordinate components, moderate adjustment
      // But still penalize violations
      if (violations.length > 0) {
        adjustedCoverage = Math.min(baseCoverage, 90) // Cap at 90% if violations exist
      } else {
        adjustedCoverage = Math.min(baseCoverage + 5, 100)
      }
      break

    default:
      // Fallback for any unhandled types
      adjustedCoverage = baseCoverage
      break
  }

  return Math.round(adjustedCoverage)
}

/**
 * Analyze themeable vs non-themeable violations
 */
const analyzeViolationContext = (violations, fileType) => {
  const themeableViolations = violations.filter((violation) => {
    // Check if violation involves a themeable property
    const isThemeableProperty = Object.values(THEMEABLE_PROPERTIES)
      .flat()
      .some((prop) => violation.value.includes(prop) || violation.type.includes(prop))

    return isThemeableProperty
  })

  const nonThemeableViolations = violations.filter((violation) => {
    return NON_THEMEABLE_PROPERTIES.some(
      (prop) => violation.value.includes(prop) || violation.type.includes(prop)
    )
  })

  // Determine priority based on file type and violation context
  let priority = 'low'
  if (themeableViolations.length > 0) {
    priority = fileType.type === 'component' || fileType.type === 'layout' ? 'high' : 'medium'
  }

  return {
    themeable: themeableViolations,
    nonThemeable: nonThemeableViolations,
    themeableCount: themeableViolations.length,
    nonThemeableCount: nonThemeableViolations.length,
    priority
  }
}

/**
 * Analyze a single file for theme compliance
 */
const analyzeFile = async (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const fileName = path.basename(filePath)
    const relativePath = path.relative(process.cwd(), filePath)

    // Determine file type using contextual analysis
    const fileType = determineFileType(filePath, content)

    // Extract violations
    const violations = extractViolations(content, filePath)

    // Analyze violation context (themeable vs non-themeable)
    const violationAnalysis = analyzeViolationContext(violations, fileType)

    // Extract theme tokens
    const themeTokens = extractThemeTokens(content)

    // Calculate contextual coverage based on file type
    const coverage = calculateContextualCoverage(content, violations, themeTokens, fileType)

    // Determine status
    const status = calculateStatus(coverage)

    // Dark mode support
    const darkModeSupport = detectDarkModeSupport(content)

    // Check if component needs theming
    const needsThemingFlag = needsTheming(content)

    return {
      fileName,
      filePath: relativePath,
      coverage,
      status,
      fileType: {
        type: fileType.type,
        description: fileType.description,
        expectedStyling: fileType.expectedStyling,
        confidence: fileType.confidence,
        coverageExpectation: fileType.coverageExpectation
      },
      themeTokens: themeTokens.length,
      themeTokensList: themeTokens,
      violations: violations.length,
      violationsList: violations,
      violationAnalysis: {
        themeableViolations: violationAnalysis.themeableCount,
        nonThemeableViolations: violationAnalysis.nonThemeableCount,
        priority: violationAnalysis.priority,
        themeableList: violationAnalysis.themeable,
        nonThemeableList: violationAnalysis.nonThemeable
      },
      darkModeSupport,
      lastAnalyzed: new Date().toISOString(),
      needsTheming: needsThemingFlag,
      isAppropriatelyStyled: assessAppropriatenesss(fileType, needsThemingFlag, violations.length),
      recommendations: generateRecommendations(fileType, violations, coverage),
      contextualAnalysis: {
        isAppropriatelyStyled: assessAppropriatenesss(
          fileType,
          needsThemingFlag,
          violations.length
        ),
        recommendations: generateRecommendations(fileType, violations, coverage)
      }
    }
  } catch (error) {
    return {
      fileName: path.basename(filePath),
      filePath: path.relative(process.cwd(), filePath),
      error: error.message,
      coverage: 0,
      status: 'error',
      themeTokens: 0,
      violations: 0,
      lastAnalyzed: new Date().toISOString(),
      fileType: { type: 'unknown', description: 'Error analyzing file type' }
    }
  }
}

/**
 * Extract violations from file content
 */
const extractViolations = (content, filePath) => {
  const violations = []
  const lines = content.split('\n')

  VIOLATION_PATTERNS.forEach(({ type, pattern, severity, suggestion }) => {
    // Special handling for dynamic tailwind unapproved colors
    if (type === 'tailwind-unapproved-color-tokens') {
      const dynamicPattern = tailwindColorChecker.unapprovedColorTokens
      const matches = content.match(dynamicPattern)
      if (matches) {
        matches.forEach((match) => {
          const beforeMatch = content.substring(0, content.indexOf(match))
          const lineNumber = beforeMatch.split('\n').length
          const violationLine = lines[lineNumber - 1] || ''

          // Get context around the violation
          const contextLines = []
          if (lineNumber > 1) {
            contextLines.push(`${lineNumber - 1}: ${lines[lineNumber - 2]}`)
          }
          contextLines.push(`${lineNumber}: ${violationLine} ← UNAPPROVED TAILWIND COLOR`)
          if (lineNumber < lines.length) {
            contextLines.push(`${lineNumber + 1}: ${lines[lineNumber]}`)
          }

          violations.push({
            type,
            value: match.trim(),
            location: path.basename(filePath),
            line: lineNumber,
            context: violationLine.trim(),
            fullContext: contextLines.join('\n'),
            severity,
            suggestion: `${suggestion}\n\nUnapproved color token found: ${match.trim()}\nFull line: ${violationLine.trim()}\n\nApproved colors should be from: ${APPROVED_TAILWIND_COLORS.slice(
              0,
              5
            ).join(', ')}...`
          })
        })
      }
      return // Skip the normal processing for this type
    }

    // For multiline patterns, search the entire content
    if (
      type.includes('theme-object') ||
      type.includes('styled-components') ||
      type.includes('theme-colors') ||
      type.includes('theme-palette') ||
      type.includes('complex-theme-destructuring') ||
      type.includes('multiline-theme-destructure')
    ) {
      const matches = content.match(pattern)
      if (matches) {
        matches.forEach((match) => {
          // Find the line number where this match starts
          const beforeMatch = content.substring(0, content.indexOf(match))
          const lineNumber = beforeMatch.split('\n').length
          const matchLines = match.split('\n')

          // Get context around the violation
          const contextLines = []
          const startLine = Math.max(0, lineNumber - 2)
          const endLine = Math.min(lines.length - 1, lineNumber + matchLines.length + 1)

          for (let i = startLine; i <= endLine; i++) {
            if (i >= lineNumber && i < lineNumber + matchLines.length) {
              // This line contains part of the violation - highlight it
              const violationPartIndex = i - lineNumber
              const violationPart = matchLines[violationPartIndex] || ''
              const fullLine = lines[i] || ''
              const highlightedLine = fullLine.includes(violationPart.trim())
                ? fullLine.replace(violationPart.trim(), `🔸 ${violationPart.trim()} 🔸`)
                : fullLine
              contextLines.push(`→ ${i + 1}: ${highlightedLine}`)
            } else {
              contextLines.push(`  ${i + 1}: ${lines[i] || ''}`)
            }
          }

          violations.push({
            type,
            value: match.trim(),
            location: path.basename(filePath),
            line: lineNumber,
            context: match.trim(),
            fullContext: contextLines.join('\n'),
            severity,
            suggestion: `${suggestion}\n\nFound violation: "${match.trim().substring(0, 100)}${
              match.length > 100 ? '...' : ''
            }"`
          })
        })
      }
    } else {
      // For single-line patterns, search line by line
      lines.forEach((line, index) => {
        const matches = line.match(pattern)
        if (matches) {
          matches.forEach((match) => {
            // Get more context for better violation reporting
            const lineNumber = index + 1
            const contextLines = []

            // Add previous line for context (if exists)
            if (index > 0) {
              contextLines.push(`${lineNumber - 1}: ${lines[index - 1].trim()}`)
            }

            // Add current line (the violation line) with highlighted violation
            const highlightedLine = line.replace(match, `🔸 ${match} 🔸`)
            contextLines.push(`${lineNumber}: ${highlightedLine.trim()}`)

            // Add next line for context (if exists)
            if (index < lines.length - 1) {
              contextLines.push(`${lineNumber + 1}: ${lines[index + 1].trim()}`)
            }

            violations.push({
              type,
              value: match.trim(),
              location: path.basename(filePath),
              line: lineNumber,
              context: line.trim(),
              fullContext: contextLines.join('\n'),
              severity,
              suggestion: type.startsWith('tailwind-')
                ? `${suggestion}\n\nFound violation: "${match.trim()}"\nIn line: ${line.trim()}\nFull context: Line ${lineNumber} in ${path.basename(
                    filePath
                  )}`
                : `${suggestion}\n\nFound: "${match.trim()}"\nIn line: ${line.trim()}`
            })
          })
        }
      })
    }
  })

  return violations
}

/**
 * Extract theme tokens from file content
 */
const extractThemeTokens = (content) => {
  const tokens = new Set()

  THEME_TOKEN_PATTERNS.forEach((pattern) => {
    const matches = content.match(pattern) || []
    matches.forEach((match) => {
      tokens.add(match)
    })
  })

  return Array.from(tokens)
}

/**
 * Calculate coverage percentage
 */
const calculateCoverage = (content, violations, themeTokens) => {
  // Count CSS-style declarations (property: value;)
  const cssStyleDeclarations = (content.match(/:\s*[^;]+;/g) || []).length

  // Count JavaScript object style declarations (property: 'value',) - excluding non-themeable properties
  const jsObjectStyleDeclarations = (
    content.match(
      /(?:margin|padding|gap|fontSize|color|backgroundColor|borderColor|border|boxShadow):\s*['"`][^'"`]*['"`]/g
    ) || []
  ).length

  // Count styled-components template literal styles - excluding non-themeable properties
  const styledComponentStyles = (
    content.match(
      /`[^`]*(?:margin|padding|gap|fontSize|color|backgroundColor|borderColor|border|boxShadow|display|position)[^`]*`/g
    ) || []
  ).length

  // Total style declarations from CSS, JS objects, and styled-components
  const totalStyleDeclarations =
    cssStyleDeclarations + jsObjectStyleDeclarations + styledComponentStyles

  // If there are violations but no style declarations detected, this indicates
  // that our detection missed some styling - apply penalty based on violations
  if (totalStyleDeclarations === 0 && violations.length > 0) {
    const highSeverityViolations = violations.filter((v) => v.severity === 'high').length
    const mediumSeverityViolations = violations.filter((v) => v.severity === 'medium').length
    const lowSeverityViolations = violations.filter((v) => v.severity === 'low').length

    const violationPenalty = Math.min(
      highSeverityViolations * 20 + mediumSeverityViolations * 15 + lowSeverityViolations * 10,
      90
    )

    return Math.max(100 - violationPenalty, 0)
  }

  // If no style declarations and no violations, it's likely a utility file
  if (totalStyleDeclarations === 0) return 100

  const themeTokenUsage = themeTokens.length

  // Base coverage from theme token usage
  const baseCoverage = Math.min(
    (themeTokenUsage / Math.max(totalStyleDeclarations * 0.3, 1)) * 100,
    100
  )

  // Enhanced penalty for violations - give more weight to high severity
  const highSeverityViolations = violations.filter((v) => v.severity === 'high').length
  const mediumSeverityViolations = violations.filter((v) => v.severity === 'medium').length
  const lowSeverityViolations = violations.filter((v) => v.severity === 'low').length

  const violationPenalty = Math.min(
    highSeverityViolations * 15 + mediumSeverityViolations * 10 + lowSeverityViolations * 5,
    80
  )

  return Math.max(Math.round(baseCoverage - violationPenalty), 0)
}

/**
 * Calculate theming status
 */
const calculateStatus = (coverage) => {
  if (coverage >= 90) return 'excellent'
  if (coverage >= 70) return 'good'
  if (coverage >= 50) return 'fair'
  if (coverage >= 30) return 'poor'
  return 'critical'
}

/**
 * Detect dark mode support
 */
const detectDarkModeSupport = (content) => {
  const darkModePatterns = [
    /--color-.*dark/g,
    /\.dew-dark-theme/g,
    /prefers-color-scheme:\s*dark/g,
    /dark.*mode/gi,
    /'dark'/g,
    /"dark"/g
  ]

  const matches = darkModePatterns.reduce((acc, pattern) => {
    return acc + (content.match(pattern) || []).length
  }, 0)

  if (matches >= 3) return 'full'
  if (matches >= 1) return 'partial'
  return 'none'
}

/**
 * Assess if file is appropriately styled for its type
 */
const assessAppropriatenesss = (fileType, needsTheming, violationCount) => {
  switch (fileType.expectedStyling) {
    case 'none':
      // Container and utility files shouldn't have styling
      return !needsTheming && violationCount === 0
    case 'minimal':
      // Wrapper files can have minimal styling
      return violationCount <= 2
    case 'high':
      // Components and layout files should be well-themed
      return needsTheming && violationCount <= 3
    case 'medium':
      // Page files should have moderate theming
      return violationCount <= 5
    default:
      return violationCount === 0
  }
}

/**
 * Generate contextual recommendations based on file type and analysis
 */
const generateRecommendations = (fileType, violations, coverage) => {
  const recommendations = []

  // Type-specific recommendations
  switch (fileType.type) {
    case 'container':
      if (violations.length > 0) {
        recommendations.push('Container components should delegate styling to child components')
        recommendations.push('Focus on logic and data flow, not presentation')
        recommendations.push('Consider moving any styling to dedicated UI components')
      } else if (coverage === 100) {
        recommendations.push('✅ Perfect! This container component correctly focuses on logic')
      }
      break

    case 'utility':
      if (violations.length > 0) {
        recommendations.push('Consider moving styling logic to appropriate component files')
        recommendations.push('Utility files should focus on logic, not presentation')
      } else if (coverage === 100) {
        recommendations.push('✅ Excellent! This utility file correctly contains no styling')
      }
      break

    case 'wrapper':
      if (violations.length > 2) {
        recommendations.push('Wrapper components should have minimal styling')
        recommendations.push('Focus on providing context and structure, not appearance')
      }
      if (coverage >= 90) {
        recommendations.push('✅ Good wrapper component with appropriate minimal styling')
      }
      break

    case 'component':
      if (coverage < fileType.coverageExpectation) {
        recommendations.push('Increase theme token usage for better consistency')
        recommendations.push('Replace hardcoded values with design system tokens')
      }
      if (violations.length > 3) {
        recommendations.push('Too many theming violations for a reusable component')
      }
      if (coverage >= 85) {
        recommendations.push('✅ Well-themed component following design system guidelines')
      }
      break

    case 'layout':
      if (violations.length > 5) {
        recommendations.push('Consider breaking down large layout components')
        recommendations.push('Use CSS Grid or Flexbox with theme tokens for layout')
      }
      if (coverage >= 70) {
        recommendations.push('✅ Good layout component with appropriate theming')
      }
      break

    case 'page':
      if (coverage < 60) {
        recommendations.push('Ensure page-level styling uses consistent theme tokens')
        recommendations.push('Consider using layout components for better theming')
      }
      if (coverage >= 75) {
        recommendations.push('✅ Well-structured page with good theme consistency')
      }
      break

    default:
      recommendations.push('Consider classifying this file type for better theme analysis')
      break
  }

  // General recommendations based on violation types
  const highSeverityViolations = violations.filter((v) => v.severity === 'high')
  if (highSeverityViolations.length > 0) {
    recommendations.push('🚨 Priority: Fix high-severity theming violations first')
    recommendations.push('Focus on replacing theme object usage with CSS variables')
  }

  const mediumSeverityViolations = violations.filter((v) => v.severity === 'medium')
  if (mediumSeverityViolations.length > 3) {
    recommendations.push('Consider addressing medium-severity violations for better consistency')
  }

  // Coverage-based recommendations
  if (coverage === 0 && violations.length > 0) {
    recommendations.push('⚠️ Critical: Multiple violations detected with no theme token usage')
  }

  return recommendations
}

/**
 * Check if component needs theming - enhanced detection
 */
const needsTheming = (content) => {
  const styledPatterns = [
    /styled\(/g,
    /styled\./g,
    /css`/g,
    /emotion/g,
    /makeStyles/g,
    /createStyles/g,
    /style\s*=\s*\{[^}]*(?:color|background|margin|padding|border|font)(?![A-Za-z])/g, // Enhanced inline style detection, excluding width/height/lineHeight
    /className.*styled/g,
    /\$\{[^}]*theme[^}]*\}/g // Theme usage in template literals
  ]

  // Patterns that indicate structural/functional styling (not themeable)
  const functionalStylePatterns = [
    /style\s*=\s*\{[^}]*(?:position|display|overflow|visibility|transform|transition|animation|width|height|lineHeight)/g,
    /height:\s*\{?height\}?/g, // Dynamic height props
    /width:\s*\{?width\}?/g, // Dynamic width props
    /lineHeight:\s*\{?lineHeight\}?/g, // Dynamic lineHeight props
    /style\s*=\s*\{?style\}?/g // Direct style prop passing
  ]

  const hasThemeableStyling = styledPatterns.some((pattern) => pattern.test(content))
  const hasFunctionalStyling = functionalStylePatterns.some((pattern) => pattern.test(content))

  // If only functional styling, doesn't need theming
  if (hasFunctionalStyling && !hasThemeableStyling) {
    return false
  }

  return hasThemeableStyling
}

/**
 * Get all JavaScript files recursively
 */
const getJavaScriptFiles = (dir) => {
  const files = []

  const scan = (currentDir) => {
    try {
      const items = fs.readdirSync(currentDir)

      items.forEach((item) => {
        const fullPath = path.join(currentDir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          // Skip certain directories
          if (
            !item.startsWith('.') &&
            item !== 'node_modules' &&
            item !== 'build' &&
            item !== 'dist' &&
            item !== 'coverage' &&
            !item.includes('test') &&
            !item.includes('__tests__') &&
            item !== 'theme-tracker'
          ) {
            scan(fullPath)
          }
        } else if (
          item.endsWith('.js') ||
          item.endsWith('.jsx') ||
          item.endsWith('.ts') ||
          item.endsWith('.tsx')
        ) {
          // Skip test files and mocks
          if (
            !item.includes('.test.') &&
            !item.includes('.spec.') &&
            !item.includes('mock') &&
            !item.includes('Mock')
          ) {
            files.push(fullPath)
          }
        }
      })
    } catch (error) {
      console.error(`Error scanning directory ${currentDir}:`, error.message)
    }
  }

  scan(dir)
  return files
}

/**
 * Get JavaScript files from specific target directories (components and pages ONLY)
 */
const getTargetDirectoryFiles = (baseDir) => {
  const targetDirs = [path.join(baseDir, 'src', 'components'), path.join(baseDir, 'src', 'pages')]

  let allFiles = []

  const isExcludedFile = (filePath, fileName) => {
    const lowerFileName = fileName.toLowerCase()
    const lowerFilePath = filePath.toLowerCase()

    // Exclude test files (JS, JSX, TS, TSX)
    if (
      lowerFileName.includes('.test.') ||
      lowerFileName.includes('.spec.') ||
      lowerFileName.includes('test.js') ||
      lowerFileName.includes('test.jsx') ||
      lowerFileName.includes('test.ts') ||
      lowerFileName.includes('test.tsx')
    ) {
      return true
    }

    // Exclude story files (JS, JSX, TS, TSX)
    if (
      lowerFileName.includes('.stories.') ||
      lowerFileName.includes('.story.') ||
      lowerFileName.includes('stories.js') ||
      lowerFileName.includes('stories.jsx') ||
      lowerFileName.includes('stories.ts') ||
      lowerFileName.includes('stories.tsx')
    ) {
      return true
    }

    // Exclude TypeScript definition files (.d.ts)
    if (lowerFileName.endsWith('.d.ts')) {
      return true
    }

    // Exclude mock files - Enhanced filtering (JS, JSX, TS, TSX)
    if (
      lowerFileName.includes('mock') ||
      lowerFileName === 'mock.js' ||
      lowerFileName === 'mock.jsx' ||
      lowerFileName === 'mock.ts' ||
      lowerFileName === 'mock.tsx' ||
      lowerFileName === 'mocks.js' ||
      lowerFileName === 'mocks.jsx' ||
      lowerFileName === 'mocks.ts' ||
      lowerFileName === 'mocks.tsx' ||
      lowerFileName.startsWith('mock.') ||
      lowerFileName.endsWith('.mock.js') ||
      lowerFileName.endsWith('.mock.jsx') ||
      lowerFileName.endsWith('.mock.ts') ||
      lowerFileName.endsWith('.mock.tsx') ||
      lowerFilePath.includes('/mock/') ||
      lowerFilePath.includes('/mocks/') ||
      lowerFilePath.endsWith('/mock') ||
      lowerFilePath.endsWith('/mocks')
    ) {
      return true
    }

    // Exclude index files (barrel exports with no styling) - JS, JSX, TS, TSX
    if (
      lowerFileName === 'index.js' ||
      lowerFileName === 'index.jsx' ||
      lowerFileName === 'index.ts' ||
      lowerFileName === 'index.tsx'
    ) {
      return true
    }

    // Exclude specific directories in path - Enhanced mock filtering
    if (
      lowerFilePath.includes('/stories/') ||
      lowerFilePath.includes('/mocks/') ||
      lowerFilePath.includes('/mock/') ||
      lowerFilePath.includes('/__tests__/') ||
      lowerFilePath.includes('/test/') ||
      lowerFilePath.includes('/tests/') ||
      lowerFilePath.includes('/services/') ||
      lowerFilePath.includes('/service/') ||
      lowerFilePath.includes('/utils/') ||
      lowerFilePath.includes('/util/') ||
      lowerFilePath.includes('/apis/') ||
      lowerFilePath.includes('/api/') ||
      lowerFilePath.includes('/store/') ||
      lowerFilePath.includes('/config/') ||
      lowerFilePath.includes('/helpers/') ||
      lowerFilePath.includes('/helper/') ||
      lowerFilePath.includes('/constants/') ||
      lowerFilePath.includes('/constant/') ||
      lowerFilePath.includes('/types/') ||
      lowerFilePath.includes('/models/') ||
      lowerFilePath.includes('/interfaces/') ||
      lowerFilePath.includes('/enums/') ||
      lowerFilePath.includes('/definitions/') ||
      // Additional mock directory patterns
      lowerFilePath.includes('mocks/') ||
      lowerFilePath.includes('mock/') ||
      lowerFilePath.endsWith('/mocks') ||
      lowerFilePath.endsWith('/mock')
    ) {
      return true
    }

    // Exclude TypeScript-specific utility files by name patterns
    if (
      lowerFileName.endsWith('.types.ts') ||
      lowerFileName.endsWith('.types.tsx') ||
      lowerFileName.endsWith('.model.ts') ||
      lowerFileName.endsWith('.model.tsx') ||
      lowerFileName.endsWith('.interface.ts') ||
      lowerFileName.endsWith('.interface.tsx') ||
      lowerFileName.endsWith('.enum.ts') ||
      lowerFileName.endsWith('.enum.tsx') ||
      lowerFileName.endsWith('.constants.ts') ||
      lowerFileName.endsWith('.constants.tsx') ||
      lowerFileName.endsWith('.config.ts') ||
      lowerFileName.endsWith('.config.tsx') ||
      lowerFileName.endsWith('.service.ts') ||
      lowerFileName.endsWith('.service.tsx') ||
      lowerFileName.endsWith('.util.ts') ||
      lowerFileName.endsWith('.util.tsx') ||
      lowerFileName.endsWith('.utils.ts') ||
      lowerFileName.endsWith('.utils.tsx') ||
      lowerFileName.endsWith('.helper.ts') ||
      lowerFileName.endsWith('.helper.tsx') ||
      lowerFileName.endsWith('.api.ts') ||
      lowerFileName.endsWith('.api.tsx') ||
      // Files that are just types or interfaces
      lowerFileName.startsWith('types.') ||
      lowerFileName.startsWith('interfaces.') ||
      lowerFileName.startsWith('models.') ||
      lowerFileName.startsWith('enums.') ||
      lowerFileName.startsWith('constants.')
    ) {
      return true
    }

    return false
  }

  const scanTargetDirectory = (currentDir) => {
    const files = []

    try {
      const items = fs.readdirSync(currentDir)

      items.forEach((item) => {
        const fullPath = path.join(currentDir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          // Skip system directories and unwanted directories
          // Also skip if the directory name itself indicates it should be excluded
          const dirName = item.toLowerCase()
          if (
            !item.startsWith('.') &&
            item !== 'node_modules' &&
            dirName !== 'mocks' &&
            dirName !== 'mock' &&
            dirName !== 'stories' &&
            dirName !== 'story' &&
            dirName !== '__tests__' &&
            dirName !== 'test' &&
            dirName !== 'tests' &&
            !isExcludedFile(fullPath, item)
          ) {
            const subFiles = scanTargetDirectory(fullPath)
            files.push(...subFiles)
          }
        } else if (
          item.endsWith('.js') ||
          item.endsWith('.jsx') ||
          item.endsWith('.ts') ||
          item.endsWith('.tsx')
        ) {
          // Only include files that are not excluded
          if (!isExcludedFile(fullPath, item)) {
            files.push(fullPath)
          }
        }
      })
    } catch (error) {
      console.error(`Error scanning directory ${currentDir}:`, error.message)
    }

    return files
  }

  targetDirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
      console.log(`Scanning directory: ${dir}`)
      const files = scanTargetDirectory(dir)
      allFiles = allFiles.concat(files)
      console.log(`Found ${files.length} files in ${dir}`)
    } else {
      console.warn(`Directory not found: ${dir}`)
    }
  })

  // Log some sample files for debugging
  console.log('\nSample files found:')
  allFiles.slice(0, 5).forEach((file) => {
    console.log(`  - ${path.relative(baseDir, file)}`)
  })
  if (allFiles.length > 5) {
    console.log(`  ... and ${allFiles.length - 5} more files`)
  }

  return allFiles
}

/**
 * Run audit on target directories (components and pages)
 */
const auditTargetDirectories = async (baseDir = process.cwd()) => {
  console.log(`Starting audit on target directories in: ${baseDir}`)

  const files = getTargetDirectoryFiles(baseDir)
  console.log(`Total files to audit: ${files.length}`)

  if (files.length === 0) {
    console.log('No JavaScript files found in target directories')
    return []
  }

  const results = await auditFiles(files)

  // Summary statistics
  const summary = {
    totalFiles: results.length,
    totalViolations: results.reduce((sum, r) => sum + r.violations, 0),
    averageCoverage: Math.round(results.reduce((sum, r) => sum + r.coverage, 0) / results.length),
    filesByStatus: {
      excellent: results.filter((r) => r.status === 'excellent').length,
      good: results.filter((r) => r.status === 'good').length,
      fair: results.filter((r) => r.status === 'fair').length,
      poor: results.filter((r) => r.status === 'poor').length,
      critical: results.filter((r) => r.status === 'critical').length
    }
  }

  console.log('\n=== AUDIT SUMMARY ===')
  console.log(`Total files audited: ${summary.totalFiles}`)
  console.log(`Total violations found: ${summary.totalViolations}`)
  console.log(`Average coverage: ${summary.averageCoverage}%`)
  console.log(`Status breakdown:`)
  console.log(`  Excellent: ${summary.filesByStatus.excellent}`)
  console.log(`  Good: ${summary.filesByStatus.good}`)
  console.log(`  Fair: ${summary.filesByStatus.fair}`)
  console.log(`  Poor: ${summary.filesByStatus.poor}`)
  console.log(`  Critical: ${summary.filesByStatus.critical}`)

  return { results, summary }
}

/**
 * Audit multiple files
 */
const auditFiles = async (filePaths) => {
  const results = []

  for (const filePath of filePaths) {
    const result = await analyzeFile(filePath)
    results.push(result)
  }

  return results
}

module.exports = {
  analyzeFile,
  auditFiles,
  getJavaScriptFiles,
  getTargetDirectoryFiles,
  auditTargetDirectories
}
