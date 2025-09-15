module.exports = {
  // Dew Design System configuration
  dewConfig: {
    tokensPath: "../lib/autofix-rules/dewStyles/colors.css",
    cssVariablePrefix: "--",
  },

  // Source directories to scan
  sourceDirectories: {
    include: ["src"],
  },

  // File types to analyze
  fileTypes: {
    javascript: {
      extensions: ["js", "jsx", "ts", "tsx"],
      enabled: true,
    },
    styles: {
      extensions: ["css", "scss", "sass"],
      enabled: true,
    },
  },

  // Analysis settings
  analysis: {
    includeCssFiles: true,
    violations: {
      hardcodedColors: true,
      cssHardcodedValues: true,
      scssVariables: true,
      styledComponentsTheme: true,
      tailwindColors: true,
    },
  },

  // Server settings
  server: {
    port: 3001,
    host: "localhost",
    autoOpen: false, // Don't auto-open for testing
  },
};
