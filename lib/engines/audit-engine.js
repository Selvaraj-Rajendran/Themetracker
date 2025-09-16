#!/usr/bin/env node
/**
 * ThemeTracker v0.2 - Enhanced Audit Engine
 * Real-time theme auditing with live UI updates
 */

const fs = require("fs");
const path = require("path");

/**
 * Cache for loaded design token color values to avoid repeated file reads
 */
let designTokenColorsCache = null;
let lastConfigPath = null;

/**
 * Load approved Tailwind colors from configuration (with caching)
 */
const loadApprovedTailwindColors = (config) => {
  const configPath = config?.designTokenConfig?.tokensPath;

  // Return cached result if config hasn't changed
  if (designTokenColorsCache && lastConfigPath === configPath) {
    return designTokenColorsCache;
  }

  if (!configPath) {
    console.warn(
      "Warning: No design token config path specified, using fallback colors"
    );
    designTokenColorsCache = [
      "color-text-brand",
      "color-text-primary",
      "color-text-secondary",
      "color-fill-brand",
      "color-fill-surface",
      "color-boundary-border",
    ];
    lastConfigPath = configPath;
    return designTokenColorsCache;
  }

  try {
    const fullPath = path.resolve(configPath);
    const designTokenColors = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const newDesignTokenColors = Object.keys(designTokenColors);

    // Only log when cache is first populated
    if (!designTokenColorsCache) {
      console.log(
        `✅ Loaded ${newDesignTokenColors.length} design token color values`
      );
    }

    designTokenColorsCache = newDesignTokenColors;
    lastConfigPath = configPath;
    return designTokenColorsCache;
  } catch (error) {
    console.warn(
      `Warning: Could not load design token colors from ${configPath}, using fallback colors`
    );
    designTokenColorsCache = [
      "color-text-brand",
      "color-text-primary",
      "color-text-secondary",
      "color-fill-brand",
      "color-fill-surface",
      "color-boundary-border",
    ];
    lastConfigPath = configPath;
    return designTokenColorsCache;
  }
};

// Create dynamic Tailwind violation checker
const createTailwindColorViolationChecker = (approvedColors) => {
  const approvedColorPattern = approvedColors.join("|");
  return {
    unapprovedColorTokens: new RegExp(
      "className\\s*=\\s*[\\`\"'].*(?:bg-color-(?!(?:" +
        approvedColorPattern +
        "))[a-zA-Z-]+|text-color-(?!(?:" +
        approvedColorPattern +
        "))[a-zA-Z-]+|border-color-(?!(?:" +
        approvedColorPattern +
        "))[a-zA-Z-]+).*[\\`\"']",
      "g"
    ),
    approvedColorTokens: new RegExp(
      "(?:bg-|text-|border-)(?:" + approvedColorPattern + ")",
      "g"
    ),
  };
};

/**
 * Comprehensive CSS Variable Fallback Detection
 * Handles various scenarios including:
 * - var(--color-text-primary, #12344d)
 * - var(--button-text-align, relative)  \
 * - var(--color-boundary-border-mildest , #000000) [extra spaces]
 * - Var(--position, relative) [uppercase]
 * - var(--font-semibold, 600) [numeric]
 * - var(--primary, var(--secondary, fallback)) [nested]
 */
const extractCssProperty = (match) => {
  // Extract CSS property name from the match
  // Examples: "margin: 16px" -> "margin", "font-size: 14px" -> "font-size"
  const colonIndex = match.indexOf(":");
  if (colonIndex === -1) return null;

  return match.substring(0, colonIndex).trim().toLowerCase();
};

const isPropertyIgnored = (match, config) => {
  const ignoreProperties = config?.analysis?.violations?.ignoreProperties || [];
  if (ignoreProperties.length === 0) return false;

  const property = extractCssProperty(match);
  if (!property) return false;

  return ignoreProperties.includes(property);
};

const isColorPropertyIgnored = (match, content, matchIndex, config) => {
  const ignoreProperties = config?.analysis?.violations?.ignoreProperties || [];
  if (ignoreProperties.length === 0) return false;

  // For color-only matches, we need to look at the context to find the property
  const beforeMatch = content.substring(
    Math.max(0, matchIndex - 50),
    matchIndex
  );

  // Look for CSS property patterns before the match
  const colorPropertyPattern =
    /(background-color|color|border-color|fill|stroke|background):\s*$/;
  const match_result = beforeMatch.match(colorPropertyPattern);

  if (match_result) {
    const property = match_result[1].toLowerCase();
    return ignoreProperties.includes(property);
  }

  return false;
};
const isInsideCssVariableFallback = (match, content, matchIndex) => {
  // Get a larger context to handle nested var() calls
  const contextStart = Math.max(0, matchIndex - 200);
  const contextEnd = Math.min(content.length, matchIndex + match.length + 50);
  const context = content.substring(contextStart, contextEnd);

  // Adjust match position relative to context
  const relativeMatchIndex = matchIndex - contextStart;

  // Comprehensive CSS variable pattern:
  // - Case insensitive "var" or "Var"
  // - Flexible whitespace around parentheses and commas
  // - Supports nested var() calls
  // - Handles multiple levels of fallbacks
  const cssVarPatterns = [
    // Standard CSS variable with fallback: var(--name, fallback)
    /\b[Vv][Aa][Rr]\s*\(\s*--[a-zA-Z0-9-_]+\s*,\s*[^,)]*$/,

    // Nested CSS variables: var(--primary, var(--secondary, fallback))
    /\b[Vv][Aa][Rr]\s*\(\s*--[a-zA-Z0-9-_]+\s*,\s*[Vv][Aa][Rr]\s*\([^)]*,\s*[^,)]*$/,

    // Multiple fallbacks: var(--name, fallback1, fallback2)
    /\b[Vv][Aa][Rr]\s*\(\s*--[a-zA-Z0-9-_]+\s*(?:,\s*[^,)]*)*,\s*[^,)]*$/,
  ];

  // Check if the match is within a CSS variable fallback
  const beforeMatch = context.substring(0, relativeMatchIndex);
  const afterMatch = context.substring(relativeMatchIndex + match.length);

  // Look for CSS variable pattern before the match
  const hasCssVarBefore = cssVarPatterns.some((pattern) =>
    pattern.test(beforeMatch)
  );

  // Look for closing parenthesis after the match (with optional whitespace and semicolon)
  const hasClosingAfter = /^\s*\)\s*[;}]?/.test(afterMatch);

  // Additional check: count parentheses to ensure we're inside var()
  if (hasCssVarBefore) {
    const openParens = (beforeMatch.match(/\(/g) || []).length;
    const closeParens = (beforeMatch.match(/\)/g) || []).length;
    const isInsideParens = openParens > closeParens;

    // If we have CSS var pattern and we're inside parentheses, it's likely a fallback
    if (isInsideParens) {
      return true;
    }
  }

  return hasCssVarBefore && hasClosingAfter;
};

// Enhanced violation patterns for design token-based systems
const VIOLATION_PATTERNS = [
  {
    type: "hardcoded-color",
    pattern:
      /#[0-9a-fA-F]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/g,
    severity: "high",
    suggestion:
      "Use theme.colors or CSS custom properties from your design token system",
    // Custom validation function to exclude CSS variable fallbacks and ignored properties
    isValidViolation: (match, content, matchIndex, config) => {
      return (
        !isInsideCssVariableFallback(match, content, matchIndex) &&
        !isColorPropertyIgnored(match, content, matchIndex, config)
      );
    },
  },
  // Tailwind CSS violation patterns
  {
    type: "tailwind-hardcoded-colors",
    pattern:
      /className\s*=\s*["'`][^"'`]*(?:bg-(?:red|blue|green|yellow|purple|pink|gray|indigo|cyan|teal|orange|amber|lime|emerald|sky|violet|fuchsia|rose)-\d+|text-(?:red|blue|green|yellow|purple|pink|gray|indigo|cyan|teal|orange|amber|lime|emerald|sky|violet|fuchsia|rose)-\d+|border-(?:red|blue|green|yellow|purple|pink|gray|indigo|cyan|teal|orange|amber|lime|emerald|sky|violet|fuchsia|rose)-\d+)[^"'`]*["'`]/g,
    severity: "high",
    suggestion:
      "Replace Tailwind hardcoded colors with custom CSS variables or theme-based classes",
  },
  {
    type: "tailwind-hardcoded-spacing",
    pattern:
      /className\s*=\s*["'`][^"'`]*(?:p-\d+|px-\d+|py-\d+|pt-\d+|pb-\d+|pl-\d+|pr-\d+|m-\d+|mx-\d+|my-\d+|mt-\d+|mb-\d+|ml-\d+|mr-\d+|gap-\d+|space-x-\d+|space-y-\d+)[^"'`]*["'`]/g,
    severity: "medium",
    suggestion:
      "Replace Tailwind hardcoded spacing with design system spacing tokens",
  },
  {
    type: "tailwind-hardcoded-sizing",
    pattern:
      /className\s*=\s*["'`][^"'`]*(?:w-\d+|h-\d+|min-w-\d+|min-h-\d+|max-w-\d+|max-h-\d+)[^"'`]*["'`]/g,
    severity: "low",
    suggestion:
      "Consider using design system sizing tokens for consistent layouts",
  },
  {
    type: "tailwind-hardcoded-typography",
    pattern:
      /className\s*=\s*["'`][^"'`]*(?:text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black))[^"'`]*["'`]/g,
    severity: "medium",
    suggestion:
      "Use design system typography tokens instead of Tailwind font utilities",
  },
  {
    type: "tailwind-hardcoded-borders",
    pattern:
      /className\s*=\s*["'`][^"'`]*(?:border-\d+|rounded-(?:none|sm|md|lg|xl|2xl|3xl|full)|border-(?:solid|dashed|dotted|double|hidden|none))[^"'`]*["'`]/g,
    severity: "low",
    suggestion: "Use design system border and radius tokens for consistency",
  },
  {
    type: "tailwind-arbitrary-values",
    pattern: /className\s*=\s*["'`][^"'`]*\[[^\]]+\][^"'`]*["'`]/g,
    severity: "high",
    suggestion:
      "Replace Tailwind arbitrary values with design system tokens or custom CSS variables",
  },
  {
    type: "hardcoded-layout-positioning",
    pattern:
      /(?:gap|top|right|bottom|left):\s*[^;]*\d+(?:\.\d+)?(?:px|rem|em)[^;]*/g,
    severity: "medium",
    suggestion:
      "Replace hardcoded gap/positioning values with CSS variables (e.g., var(--spacing-xs), var(--spacing-md), var(--spacing-lg))",
    // Exclude CSS variables and ignored properties
    isValidViolation: (match, content, matchIndex, config) => {
      return !match.includes("var(") && !isPropertyIgnored(match, config);
    },
  },
  {
    type: "hardcoded-margin-padding",
    pattern: /(?:margin|padding):\s*[^;]*\d+(?:\.\d+)?px[^;]*/g,
    severity: "medium",
    suggestion:
      "Replace margin/padding values with CSS variables or theme spacing tokens (e.g., var(--spacing-xs), var(--spacing-sm))",
    // Exclude CSS variables and ignored properties
    isValidViolation: (match, content, matchIndex, config) => {
      return !match.includes("var(") && !isPropertyIgnored(match, config);
    },
  },
  {
    type: "hardcoded-font-size",
    pattern: /font-size:\s*\d+px/g,
    severity: "medium",
    suggestion: "Use theme.typography.fontSize tokens",
    // Exclude CSS variables and ignored properties
    isValidViolation: (match, content, matchIndex, config) => {
      return !match.includes("var(") && !isPropertyIgnored(match, config);
    },
  },
  {
    type: "hardcoded-border-radius",
    pattern: /border-radius:\s*\d+px/g,
    severity: "low",
    suggestion: "Use theme.radius tokens",
    // Exclude CSS variables and ignored properties
    isValidViolation: (match, content, matchIndex, config) => {
      return !match.includes("var(") && !isPropertyIgnored(match, config);
    },
  },
  {
    type: "hardcoded-box-shadow",
    pattern: /box-shadow:\s*[^;]+;/g,
    severity: "low",
    suggestion: "Use theme.shadows tokens",
    // Exclude CSS variables and ignored properties
    isValidViolation: (match, content, matchIndex, config) => {
      return !match.includes("var(") && !isPropertyIgnored(match, config);
    },
  },
  {
    type: "theme-object-box-shadow",
    pattern:
      /box-shadow:\s*[^;]*\$\{\s*\(\{\s*theme:\s*\{\s*colors?\s*\}\s*\}\)\s*=>\s*[^}]+\}/g,
    severity: "high",
    suggestion:
      "Replace theme object usage with CSS variables (e.g., var(--color-card-box-shadow))",
  },
  {
    type: "theme-object-color",
    pattern:
      /color:\s*\$\{\s*\(\{\s*theme:\s*\{\s*colors?\s*\}\s*\}\)\s*=>\s*[^}]+\}/g,
    severity: "high",
    suggestion:
      "Replace theme object usage with CSS variables (e.g., var(--color-text-primary))",
  },
  {
    type: "theme-object-border",
    pattern:
      /border:\s*[^;]*\$\{\s*\(\{\s*theme:\s*\{\s*palette:\s*\{\s*s\s*\}\s*\}\s*\}\)\s*=>\s*[^}]+\}/g,
    severity: "high",
    suggestion:
      "Replace theme object usage with CSS variables (e.g., var(--color-border-100))",
  },
  {
    type: "styled-components-theme-destructure",
    pattern: /\$\{\s*\(\{\s*theme:\s*\{[^}]*\}\s*\}\)\s*=>\s*[^}]*\}/g,
    severity: "high",
    suggestion:
      "Replace styled-components theme destructuring with CSS variables",
  },
  {
    type: "styled-components-multiline-theme-function",
    pattern:
      /\$\{\s*\(\{\s*theme[^}]*\}\s*\)\s*=>\s*\{[\s\S]*?return\s*`[\s\S]*?`[\s\S]*?\}\s*\}/g,
    severity: "critical",
    suggestion:
      "Replace multiline theme function with CSS variables. Convert theme.colors access to var(--color-*) and move complex logic to separate functions.",
  },
  {
    type: "styled-components-theme-parameter-destructure",
    pattern: /\$\{\s*\(\{\s*theme[^}]*\}\s*\)\s*=>\s*/g,
    severity: "high",
    suggestion:
      "Replace theme parameter destructuring with CSS variables. Use var(--color-*), var(--spacing-*), etc. instead of accessing theme object.",
  },
  {
    type: "theme-colors-access",
    pattern:
      /\$\{\s*\(\{\s*theme:\s*\{\s*colors?\s*\}\s*\}\)\s*=>\s*colors?\.[^}]+\}/g,
    severity: "high",
    suggestion:
      "Replace theme.colors access with CSS variables (e.g., var(--color-*))",
  },
  {
    type: "theme-palette-access",
    pattern:
      /\$\{\s*\(\{\s*theme:\s*\{\s*palette[^}]*\}\s*\}\)\s*=>\s*[^}]+\}/g,
    severity: "high",
    suggestion:
      "Replace theme.palette access with CSS variables (e.g., var(--color-*))",
  },
  {
    type: "multiline-theme-destructure",
    pattern:
      /\$\{\(\{\s*theme:\s*\{\s*palette:\s*\{\s*s\s*\}\s*\}\s*\}\)\s*=>\s*s\[\d+\]\}/gs,
    severity: "high",
    suggestion:
      "Replace multiline theme.palette destructuring with CSS variables (e.g., var(--color-s-100))",
  },
  {
    type: "template-literal-theme-access",
    pattern: /\$\{[^}]*\btheme\.[^}]*\}/g,
    severity: "medium",
    suggestion: "Replace template literal theme access with CSS variables",
  },
  {
    type: "theme-destructuring-colors",
    pattern: /theme:\s*\{\s*colors:\s*\{[^}]*\}\s*\}/g,
    severity: "critical",
    suggestion:
      "Replace theme.colors destructuring with CSS variables (var(--color-*)). Theme objects should not be used as we move to CSS variables as single source of truth",
  },
  {
    type: "hardcoded-color-names",
    pattern:
      /(?:background-color|color|border-color|fill|stroke):\s*(?:\$\{[^}]*\?\s*)?['"`]?(white|black|transparent|red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta)['"`]?(?:[^}]*\})?/gi,
    severity: "high",
    suggestion:
      "Replace hardcoded color names with CSS variables (e.g., var(--color-white), var(--color-transparent))",
    // Use comprehensive CSS variable fallback detection and ignore properties
    isValidViolation: (match, content, matchIndex, config) => {
      return (
        !isInsideCssVariableFallback(match, content, matchIndex) &&
        !isPropertyIgnored(match, config)
      );
    },
  },
  {
    type: "template-literal-hardcoded-colors",
    pattern:
      /(?:background-color|color|border-color|fill|stroke):\s*\$\{[^}]*(?:white|black|transparent|red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta)[^}]*\}/gi,
    severity: "high",
    suggestion:
      "Replace hardcoded color names in template literals with CSS variables",
  },
  {
    type: "mixed-theme-hardcoded-colors",
    pattern:
      /(?:background-color|color|border-color):\s*\$\{[^}]*(?:primary|white|black|transparent)[^}]*transparent[^}]*\}/gi,
    severity: "high",
    suggestion:
      "Replace mixed theme colors and hardcoded values with consistent CSS variables",
  },
  {
    type: "js-object-layout-positioning",
    pattern:
      /(?:gap|top|right|bottom|left):\s*['"`](?!var\()[^'"`]*\d+(?:\.\d+)?(?:px|rem|em)[^'"`]*['"`]/g,
    severity: "medium",
    suggestion:
      'Replace hardcoded gap/positioning in JavaScript objects with CSS variables (e.g., "var(--spacing-xs)", "var(--spacing-md)")',
  },
  {
    type: "js-object-margin-padding",
    pattern: /(?:margin|padding):\s*['"`][^'"`]*\d+(?:\.\d+)?px[^'"`]*['"`]/g,
    severity: "medium",
    suggestion:
      "Replace margin/padding in JavaScript objects with CSS variables or theme tokens (e.g., var(--spacing-xs))",
  },
  {
    type: "js-object-hardcoded-font-size",
    pattern: /fontSize:\s*['"`][^'"`]*\d+px[^'"`]*['"`]/g,
    severity: "medium",
    suggestion:
      "Replace hardcoded font-size in JavaScript objects with CSS variables or theme tokens",
  },
  {
    type: "js-object-hardcoded-color",
    pattern:
      /(?:color|backgroundColor|borderColor):\s*['"`](#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\))[^'"`]*['"`]/g,
    severity: "high",
    suggestion:
      "Replace hardcoded colors in JavaScript objects with CSS variables or theme tokens",
  },
  {
    type: "complex-theme-destructuring",
    pattern:
      /\$\{\s*\(\{\s*theme:\s*\{\s*(?:typography|colors?|palette)[\s\S]*?\}\s*(?:,[\s\S]*?)?\}\s*\)\s*=>\s*[\s\S]*?\}/g,
    severity: "critical",
    suggestion:
      "Replace complex theme destructuring with CSS variables. Use var(--color-*), var(--typography-*) instead of theme object access",
  },
  // Tailwind CSS violations - enforcing design token color file as single source of truth
  {
    type: "tailwind-hardcoded-colors",
    pattern:
      /className\s*=\s*[`"'].*(?:bg-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white|transparent)(?:-\d+)?|text-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|border-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?).*[`"']/g,
    severity: "critical",
    suggestion:
      "Use approved Tailwind color tokens from your design token file instead of hardcoded colors (e.g., bg-color-fill-brand, text-color-text-primary)",
  },
  {
    type: "tailwind-arbitrary-color-values",
    pattern:
      /className\s*=\s*[`"'].*(?:bg-\[#[0-9a-fA-F]{3,6}\]|text-\[#[0-9a-fA-F]{3,6}\]|border-\[#[0-9a-fA-F]{3,6}\]|bg-\[rgb\([^)]+\)\]|text-\[rgb\([^)]+\)\]|border-\[rgb\([^)]+\)\]).*[`"']/g,
    severity: "critical",
    suggestion:
      "Replace arbitrary color values in Tailwind classes with approved tokens from your design token file",
  },
  {
    type: "tailwind-unapproved-color-tokens",
    pattern:
      /className\s*=\s*[`"'].*(?:bg-color-[a-zA-Z-]+|text-color-[a-zA-Z-]+|border-color-[a-zA-Z-]+).*[`"']/g,
    severity: "high",
    suggestion:
      "Use only approved color tokens from your design token file. Check the approved token list and replace with correct token name",
  },
  {
    type: "tailwind-template-literal-hardcoded-colors",
    pattern:
      /className\s*=\s*`.*\$\{[^}]*\}.*(?:bg-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|text-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|border-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?).*`/g,
    severity: "critical",
    suggestion:
      "Replace hardcoded Tailwind colors in template literals with approved tokens from your design token file",
  },
  {
    type: "tailwind-conditional-hardcoded-colors",
    pattern:
      /className\s*=\s*[`"'].*\$\{[^}]*\?\s*['"`]?(?:bg-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|text-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?|border-(?:red|blue|green|yellow|gray|grey|purple|orange|pink|brown|cyan|magenta|black|white)(?:-\d+)?)['"`]?[^}]*\}.*[`"']/g,
    severity: "high",
    suggestion:
      "Replace hardcoded colors in conditional Tailwind classes with approved tokens from your design token file",
  },
];

// Enhanced theme token patterns including Tailwind utilities and CSS variables
const THEME_TOKEN_PATTERNS = [
  /var\(\s*--[^)]+\s*\)/g,
  /(?:bg-|text-|border-|fill-|stroke-)(?:color-[a-zA-Z-]+)/g,
  /(?:bg-|text-|border-)(?:primary|secondary|accent|surface|background)/g,
  /(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy])-(?:spacing-\w+|\w+-\d+)/g,
  /(?:text-|font-)(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)/g,
  /shadow-(?:sm|md|lg|xl|2xl|inner|none)/g,
  /rounded-(?:none|sm|md|lg|xl|2xl|3xl|full)/g,
];

/**
 * Get full context around a line
 */
const getFullContext = (lines, lineIndex, contextLines = 2) => {
  const start = Math.max(0, lineIndex - contextLines);
  const end = Math.min(lines.length, lineIndex + contextLines + 1);

  return lines
    .slice(start, end)
    .map((line, idx) => {
      const actualLineNum = start + idx + 1;
      const marker = start + idx === lineIndex ? "→ " : "  ";
      return `${marker}${actualLineNum}: ${line}`;
    })
    .join("\n");
};

/**
 * Extract violations from content
 */
const extractViolations = (content, filePath, config, fileType) => {
  const violations = [];
  const lines = content.split("\n");
  const approvedColors = loadApprovedTailwindColors(config);
  const tailwindChecker = createTailwindColorViolationChecker(approvedColors);

  // Check standard violation patterns
  VIOLATION_PATTERNS.forEach((pattern) => {
    let match;
    while ((match = pattern.pattern.exec(content)) !== null) {
      // Check if this pattern has a custom validation function
      if (
        pattern.isValidViolation &&
        !pattern.isValidViolation(match[0], content, match.index, config)
      ) {
        continue; // Skip this match as it's not a valid violation (e.g., CSS variable fallback or ignored property)
      }

      const lineNumber = content.substring(0, match.index).split("\n").length;
      const lineContent = lines[lineNumber - 1] || "";

      violations.push({
        type: pattern.type,
        severity: pattern.severity,
        message: `${pattern.type.replace(/-/g, " ")} detected`,
        line: lineNumber,
        column: match.index - content.lastIndexOf("\n", match.index),
        context: lineContent.trim(),
        fullContext: getFullContext(lines, lineNumber - 1, 2),
        suggestion: pattern.suggestion,
        match: match[0],
      });
    }
  });

  // Check for unapproved Tailwind color tokens
  let unapprovedMatch;
  while (
    (unapprovedMatch = tailwindChecker.unapprovedColorTokens.exec(content)) !==
    null
  ) {
    const lineNumber = content
      .substring(0, unapprovedMatch.index)
      .split("\n").length;
    const lineContent = lines[lineNumber - 1] || "";

    violations.push({
      type: "unapproved-tailwind-color",
      severity: "high",
      message: "Unapproved Tailwind color token detected",
      line: lineNumber,
      column:
        unapprovedMatch.index -
        content.lastIndexOf("\n", unapprovedMatch.index),
      context: lineContent.trim(),
      fullContext: getFullContext(lines, lineNumber - 1, 2),
      suggestion: `Use approved design token color values: ${approvedColors
        .slice(0, 3)
        .join(", ")}, etc.`,
      match: unapprovedMatch[0],
    });
  }

  // Additional checks for CSS/SCSS files
  if (["css", "scss", "sass", "less"].includes(fileType)) {
    const scssVarPattern =
      /\$[a-zA-Z-]+:\s*(?:#[0-9a-fA-F]+|rgb|rgba|[\d.]+(?:px|rem|em))/g;
    let scssMatch;
    while ((scssMatch = scssVarPattern.exec(content)) !== null) {
      const lineNumber = content
        .substring(0, scssMatch.index)
        .split("\n").length;
      const lineContent = lines[lineNumber - 1] || "";

      violations.push({
        type: "scss-hardcoded-variable",
        severity: "medium",
        message: "SCSS variable with hardcoded value",
        line: lineNumber,
        column: scssMatch.index - content.lastIndexOf("\n", scssMatch.index),
        context: lineContent.trim(),
        fullContext: getFullContext(lines, lineNumber - 1, 2),
        suggestion:
          "Use CSS custom properties or import values from design tokens",
        match: scssMatch[0],
      });
    }
  }

  return violations;
};

/**
 * Extract theme tokens from content
 */
const extractThemeTokens = (content, config) => {
  const tokens = [];

  THEME_TOKEN_PATTERNS.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      tokens.push(match[0]);
    }
  });

  // Extract approved Tailwind color usage
  if (config?.designTokenConfig) {
    const approvedColors = loadApprovedTailwindColors(config);
    const checker = createTailwindColorViolationChecker(approvedColors);

    let approvedMatch;
    while (
      (approvedMatch = checker.approvedColorTokens.exec(content)) !== null
    ) {
      tokens.push(approvedMatch[0]);
    }
  }

  return [...new Set(tokens)];
};

/**
 * Determine file type for classification
 */
const determineFileType = (filePath, content) => {
  const fileName = path.basename(filePath);
  const fileExt = path.extname(fileName).toLowerCase().substring(1);

  if (["css", "scss", "sass", "less"].includes(fileExt)) {
    return "style-file";
  }

  if (
    fileName.includes(".test.") ||
    fileName.includes(".spec.") ||
    filePath.includes("__tests__")
  ) {
    return "test";
  }

  if (fileName.includes(".stories.")) {
    return "story";
  }

  if (fileName.endsWith(".d.ts") || fileName.includes("types")) {
    return "types";
  }

  if (fileName.includes("config") || fileName.includes(".config.")) {
    return "config";
  }

  const uiIndicators = [
    "styled",
    "className",
    "css`",
    "emotion",
    "makeStyles",
    "useStyles",
    "theme",
    "ThemeProvider",
    "jsx",
    "tsx",
    "React.FC",
    "React.Component",
    "export default",
    "export const",
    "import.*from.*react",
  ];

  const hasUIIndicators = uiIndicators.some(
    (indicator) =>
      content.includes(indicator) || new RegExp(indicator).test(content)
  );

  const isPageComponent = /pages?\//i.test(filePath) || /Route/.test(content);
  const isContainer =
    /layout|container|wrapper|provider/i.test(fileName) ||
    /Layout|Container|Wrapper|Provider/.test(content);

  const utilityIndicators = [
    "util",
    "helper",
    "service",
    "api",
    "hook",
    "context",
  ];
  const isUtility = utilityIndicators.some(
    (indicator) =>
      fileName.toLowerCase().includes(indicator) ||
      filePath.toLowerCase().includes(indicator)
  );

  if (isPageComponent) return "page-component";
  if (isContainer) return "container";
  if (hasUIIndicators && !isUtility) return "ui-component";
  if (isUtility) return "utility";

  return "other";
};

/**
 * Calculate contextual coverage based on file type
 */
const calculateContextualCoverage = (
  content,
  violations,
  themeTokens,
  fileType
) => {
  const severityWeights = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const violationScore = violations.reduce((total, violation) => {
    return total + (severityWeights[violation.severity] || 1);
  }, 0);

  const themeTokenCount = themeTokens.length;
  const contentLength = content.length;

  const baseCoverage =
    contentLength > 0 ? Math.max(0, 100 - violationScore * 10) : 100;

  const tokenBonus = Math.min(20, themeTokenCount * 2);

  return Math.min(100, Math.max(0, baseCoverage + tokenBonus));
};

/**
 * Get coverage status based on file type and coverage
 * Updated to require 100% coverage for 'excellent' status
 */
const getCoverageStatus = (coverage, fileType) => {
  // Stricter thresholds - only 100% coverage gets 'excellent'
  const expectedCoverage = {
    "ui-component": { min: 75, good: 85, excellent: 100 },
    "page-component": { min: 60, good: 75, excellent: 100 },
    "style-file": { min: 70, good: 85, excellent: 100 },
    utility: { min: 10, good: 25, excellent: 100 },
    container: { min: 40, good: 65, excellent: 100 },
    other: { min: 30, good: 55, excellent: 100 },
  };

  const expectations = expectedCoverage[fileType] || expectedCoverage["other"];

  // Only 100% coverage gets 'excellent'
  if (coverage >= expectations.excellent) return "excellent";
  if (coverage >= expectations.good) return "good";
  if (coverage >= expectations.min) return "fair";
  if (coverage >= expectations.min * 0.5) return "poor";
  return "critical";
};

/**
 * Generate recommendations based on analysis
 */
const generateRecommendations = (violations, themeTokens, fileType, config) => {
  const recommendations = [];

  const violationsByType = violations.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});

  if (violationsByType["hardcoded-color"] > 0) {
    recommendations.push({
      priority: "high",
      type: "color-migration",
      message: `Replace ${violationsByType["hardcoded-color"]} hardcoded color(s) with design system tokens`,
      action: "Use CSS custom properties or approved Tailwind color classes",
    });
  }

  if (violationsByType["tailwind-arbitrary-values"] > 0) {
    recommendations.push({
      priority: "high",
      type: "tailwind-cleanup",
      message: `Remove ${violationsByType["tailwind-arbitrary-values"]} arbitrary Tailwind value(s)`,
      action: "Replace with design system utilities or CSS custom properties",
    });
  }

  if (violationsByType["styled-components-theme"] > 0) {
    recommendations.push({
      priority: "medium",
      type: "styled-components-migration",
      message: `Migrate ${violationsByType["styled-components-theme"]} styled-components theme usage`,
      action: "Convert to CSS custom properties for better performance",
    });
  }

  if (fileType === "ui-component" && themeTokens.length < 3) {
    recommendations.push({
      priority: "medium",
      type: "theme-adoption",
      message: "Low theme token usage for UI component",
      action: "Increase usage of design system tokens for better consistency",
    });
  }

  return recommendations;
};

/**
 * Check for dark mode support
 */
const checkDarkModeSupport = (content) => {
  const darkModePatterns = [
    /\[data-theme="dark"\]/g,
    /@media.*prefers-color-scheme.*dark/g,
    /dark:/g,
    /\.dark\s/g,
    /--.*-dark/g,
  ];

  return darkModePatterns.some((pattern) => pattern.test(content));
};

/**
 * Analyze a single file
 */
const analyzeFile = async (filePath, config = {}) => {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const fileName = path.basename(filePath);
    const fileType = determineFileType(filePath, content);

    const violations = extractViolations(content, filePath, config, fileType);
    const themeTokens = extractThemeTokens(content, config);

    const coverage = calculateContextualCoverage(
      content,
      violations,
      themeTokens,
      fileType
    );
    const status = getCoverageStatus(coverage, fileType);

    const darkModeSupport = checkDarkModeSupport(content);
    const hasThemeUsage = themeTokens.length > 0;

    return {
      fileName,
      filePath,
      fileType,
      coverage,
      status,
      violations: violations.length,
      violationsList: violations.map((v) => ({
        type: v.type,
        severity: v.severity,
        message: v.message,
        line: v.line,
        column: v.column,
        location: `${filePath}:${v.line}:${v.column}`,
        context: v.context,
        fullContext: v.fullContext,
        suggestion: v.suggestion,
      })),
      themeTokens,
      darkModeSupport,
      hasThemeUsage,
      linesOfCode: content.split("\n").length,
      fileSize: Buffer.byteLength(content, "utf8"),
      lastModified: fs.statSync(filePath).mtime,
      analysis: {
        totalViolations: violations.length,
        violationsByType: violations.reduce((acc, v) => {
          acc[v.type] = (acc[v.type] || 0) + 1;
          return acc;
        }, {}),
        violationsBySeverity: violations.reduce((acc, v) => {
          acc[v.severity] = (acc[v.severity] || 0) + 1;
          return acc;
        }, {}),
        themeTokenCount: themeTokens.length,
        recommendations: generateRecommendations(
          violations,
          themeTokens,
          fileType,
          config
        ),
      },
    };
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
    throw error;
  }
};

/**
 * Audit a single file (wrapper for analyzeFile)
 */
const auditFile = async (filePath, config = {}) => {
  return await analyzeFile(filePath, config);
};

/**
 * Audit multiple files
 */
const auditFiles = async (filePaths, config = {}) => {
  const results = [];

  for (const filePath of filePaths) {
    try {
      const result = await analyzeFile(filePath, config);
      results.push(result);
    } catch (error) {
      console.error(`Error auditing ${filePath}:`, error);
      results.push({
        fileName: path.basename(filePath),
        filePath,
        error: error.message,
        status: "error",
      });
    }
  }

  return results;
};

module.exports = {
  analyzeFile,
  auditFile,
  auditFiles,
  extractViolations,
  extractThemeTokens,
  determineFileType,
  calculateContextualCoverage,
  generateRecommendations,
  isInsideCssVariableFallback,
};
