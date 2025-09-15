/**
 * ThemeTracker Configuration Loader
 * Handles loading, validation, and merging of configuration files
 */

const fs = require("fs");
const path = require("path");

/**
 * Default configuration - fallback values
 */
const DEFAULT_CONFIG = {
  dewConfig: {
    tokensPath: null,
    fallbackPaths: [
      "lib/autofix-rules/dewStyles/colors.css",
      "lib/autofix-rules/dewStyles/numbers.css",
      "src/styles/tokens.json",
    ],
    cssVariablePrefix: "--",
    packageName: null,
    packageTokensPath: "dist/tokens.json",
  },

  sourceDirectories: {
    include: ["src", "app", "components", "lib", "pages"],
    focus: [],
    maxDepth: 10,
    autoDetect: true,
  },

  fileTypes: {
    javascript: { extensions: ["js", "jsx", "ts", "tsx"], enabled: true },
    styles: { extensions: ["css", "scss", "sass", "less"], enabled: true },
    vue: { extensions: ["vue"], enabled: false },
    svelte: { extensions: ["svelte"], enabled: false },
  },

  ignore: {
    directories: [
      "node_modules",
      "dist",
      "build",
      "coverage",
      "out",
      ".next",
      ".nuxt",
      ".output",
      ".git",
      ".svn",
      ".hg",
      ".vscode",
      ".idea",
      ".vs",
      ".cache",
      ".parcel-cache",
      ".webpack",
      "__tests__",
      "test",
      "tests",
      "spec",
      "specs",
      "stories",
      "docs",
      "documentation",
      ".storybook",
      "mocks",
      "mock",
      "__mocks__",
      "fixtures",
      "utils",
      "util",
      "helpers",
      "helper",
      "services",
      "service",
      "api",
      "apis",
      "store",
      "stores",
      "config",
      "configs",
      "constants",
      "constant",
      "types",
      "models",
      "interfaces",
      "enums",
      "definitions",
      ".pnpm",
      ".yarn",
      "theme-tracker",
    ],
    filePatterns: [
      "*.test.*",
      "*.spec.*",
      "test.*",
      "*.test",
      "*.spec",
      "*.stories.*",
      "*.story.*",
      "stories.*",
      "*mock*",
      "*Mock*",
      "*.mock.*",
      "*.d.ts",
      "*.config.*",
      "*.conf.*",
      "index.*",
      "*.types.*",
      "*.model.*",
      "*.interface.*",
      "*.enum.*",
      "*.constants.*",
      "*.service.*",
      "*.util.*",
      "*.utils.*",
      "*.helper.*",
      "*.api.*",
      "*.generated.*",
      "*.gen.*",
      "*.min.*",
      "bundle.*",
      "chunk.*",
    ],
    pathPatterns: [
      "/test/",
      "/tests/",
      "/__tests__/",
      "/spec/",
      "/specs/",
      "/stories/",
      "/docs/",
      "/.storybook/",
      "/mock/",
      "/mocks/",
      "/__mocks__/",
      "/fixtures/",
      "/utils/",
      "/util/",
      "/helpers/",
      "/helper/",
      "/services/",
      "/service/",
      "/api/",
      "/apis/",
      "/store/",
      "/stores/",
      "/config/",
      "/configs/",
      "/constants/",
      "/constant/",
      "/types/",
      "/models/",
      "/interfaces/",
      "/enums/",
      "/definitions/",
      "/dist/",
      "/build/",
      "/coverage/",
      "/out/",
      "/.next/",
      "/.git/",
      "/node_modules/",
    ],
    customPatterns: [],
  },

  analysis: {
    includeCssFiles: true,
    enableComponentsAnalysis: true,
    frameworkType: "react",
    fileClassification: {
      minStylingLines: 3,
      uiComponentIndicators: [
        "styled",
        "className",
        "css",
        "emotion",
        "makeStyles",
        "useStyles",
        "theme",
      ],
      utilityIndicators: [
        "util",
        "helper",
        "service",
        "api",
        "config",
        "constant",
        "type",
        "interface",
        "enum",
      ],
    },
    coverage: {
      expectedCoverage: {
        "ui-component": { min: 80, target: 95 },
        "page-component": { min: 60, target: 80 },
        utility: { min: 10, target: 30 },
        container: { min: 40, target: 70 },
        other: { min: 30, target: 60 },
      },
    },
    violations: {
      hardcodedColors: true,
      hardcodedSpacing: true,
      hardcodedFontSizes: true,
      hardcodedBorderRadius: true,
      hardcodedShadows: true,
      styledComponentsTheme: true,
      tailwindHardcoded: true,
      cssInJs: true,
      cssHardcodedValues: true,
      scssVariables: true,
      severityWeights: {
        "hardcoded-color": 3,
        "styled-components-theme": 2,
        "tailwind-hardcoded": 2,
        "hardcoded-spacing": 1,
        "hardcoded-font-size": 1,
        "hardcoded-border-radius": 0.5,
      },
    },
  },

  server: {
    port: 3001,
    host: "localhost",
    autoOpen: true,
    websocket: { port: 8080, timeout: 30000, maxClients: 10 },
  },

  output: {
    logLevel: "info",
    showProgress: true,
    saveReports: false,
    reportsDirectory: "theme-tracker-reports",
    exportFormats: ["json"],
  },

  advanced: {
    maxFiles: 2000,
    concurrency: 4,
    chunkSize: 100,
    enableCache: false,
    cacheDirectory: ".theme-tracker-cache",
  },
};

/**
 * Load and merge configuration
 */
class ConfigLoader {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.config = null;
  }

  /**
   * Load configuration with auto-detection and validation
   */
  async loadConfig() {
    if (this.config) return this.config;

    // Start with default config
    let config = { ...DEFAULT_CONFIG };

    // Try to load user config file
    const userConfig = await this.loadUserConfig();
    if (userConfig) {
      config = this.mergeConfigs(config, userConfig);
    }

    // Auto-detect project structure
    if (config.sourceDirectories.autoDetect) {
      config.sourceDirectories = await this.autoDetectSourceDirectories(
        config.sourceDirectories
      );
    }

    // Auto-detect config if not specified
    if (!config.dewConfig.tokensPath) {
      config.dewConfig.tokensPath = await this.autoDetectDewConfig(
        config.dewConfig.fallbackPaths
      );
    }

    // Validate and normalize config
    config = this.validateConfig(config);

    this.config = config;
    return config;
  }

  /**
   * Load user configuration file
   */
  async loadUserConfig() {
    const configFiles = [
      "themetracker.config.js",
      "theme-tracker.config.js",
      ".themetrackerrc.js",
      "package.json", // Look for themetracker key in package.json
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(this.projectRoot, configFile);

      if (fs.existsSync(configPath)) {
        try {
          if (configFile === "package.json") {
            const packageJson = JSON.parse(fs.readFileSync(configPath, "utf8"));
            if (packageJson.themetracker) {
              console.log(`📁 Loading config from package.json`);
              return packageJson.themetracker;
            }
          } else {
            console.log(`📁 Loading config from ${configFile}`);
            delete require.cache[require.resolve(configPath)];
            return require(configPath);
          }
        } catch (error) {
          console.warn(
            `⚠️  Failed to load config from ${configFile}:`,
            error.message
          );
        }
      }
    }

    console.log(`📋 No config file found, using defaults with auto-detection`);
    return null;
  }

  /**
   * Auto-detect source directories
   */
  async autoDetectSourceDirectories(sourceConfig) {
    const detectedDirs = [];

    for (const dir of sourceConfig.include) {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        detectedDirs.push(dir);
      }
    }

    if (detectedDirs.length === 0) {
      console.warn(
        `⚠️  No source directories found, falling back to scanning project root`
      );
      return { ...sourceConfig, include: ["."] };
    }

    console.log(
      `🔍 Auto-detected source directories: ${detectedDirs.join(", ")}`
    );
    return { ...sourceConfig, include: detectedDirs };
  }

  /**
   * Auto-detect Design System configuration
   */
  async autoDetectDewConfig(fallbackPaths) {
    for (const dewPath of fallbackPaths) {
      const fullPath = path.join(this.projectRoot, dewPath);
      if (fs.existsSync(fullPath)) {
        console.log(`🎨 Found config at: ${dewPath}`);
        return dewPath;
      }
    }

    console.warn(`⚠️  Design System config not found. Checked paths:`);
    fallbackPaths.forEach((p) => console.warn(`   - ${p}`));
    console.warn(
      `   Consider creating a config file or adding design system configuration`
    );

    return null;
  }

  /**
   * Deep merge two configuration objects
   */
  mergeConfigs(base, override) {
    const result = { ...base };

    for (const key in override) {
      if (
        override[key] &&
        typeof override[key] === "object" &&
        !Array.isArray(override[key])
      ) {
        result[key] = this.mergeConfigs(base[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }

    return result;
  }

  /**
   * Validate and normalize configuration
   */
  validateConfig(config) {
    // Ensure arrays
    if (!Array.isArray(config.sourceDirectories.include)) {
      config.sourceDirectories.include = [
        config.sourceDirectories.include,
      ].filter(Boolean);
    }

    if (!Array.isArray(config.ignore.directories)) {
      config.ignore.directories = [config.ignore.directories].filter(Boolean);
    }

    if (!Array.isArray(config.ignore.filePatterns)) {
      config.ignore.filePatterns = [config.ignore.filePatterns].filter(Boolean);
    }

    if (!Array.isArray(config.ignore.pathPatterns)) {
      config.ignore.pathPatterns = [config.ignore.pathPatterns].filter(Boolean);
    }

    // Validate server port
    if (
      typeof config.server.port !== "number" ||
      config.server.port < 1000 ||
      config.server.port > 65535
    ) {
      console.warn(
        `⚠️  Invalid server port ${config.server.port}, using default 3001`
      );
      config.server.port = 3001;
    }

    // Set WebSocket port if not specified
    if (!config.server.websocket.port) {
      config.server.websocket.port = config.server.port + 1;
    }

    return config;
  }

  /**
   * Get all file extensions to analyze
   */
  getAllExtensions() {
    const config = this.config || DEFAULT_CONFIG;
    const extensions = [];

    Object.values(config.fileTypes).forEach((fileType) => {
      if (fileType.enabled) {
        extensions.push(...fileType.extensions);
      }
    });

    return [...new Set(extensions)]; // Remove duplicates
  }

  /**
   * Check if a file should be ignored
   */
  shouldIgnoreFile(filePath, fileName) {
    const config = this.config || DEFAULT_CONFIG;
    const lowerFileName = fileName.toLowerCase();
    const lowerFilePath = filePath.toLowerCase();

    // Check file patterns
    for (const pattern of config.ignore.filePatterns) {
      if (this.matchesPattern(lowerFileName, pattern)) {
        return true;
      }
    }

    // Check path patterns
    for (const pattern of config.ignore.pathPatterns) {
      if (lowerFilePath.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Check custom regex patterns
    for (const pattern of config.ignore.customPatterns) {
      if (pattern.test && pattern.test(filePath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a directory should be ignored
   */
  shouldIgnoreDirectory(dirName) {
    const config = this.config || DEFAULT_CONFIG;
    const lowerDirName = dirName.toLowerCase();

    return config.ignore.directories.some(
      (pattern) =>
        lowerDirName === pattern.toLowerCase() ||
        lowerDirName.includes(pattern.toLowerCase())
    );
  }

  /**
   * Simple pattern matching (supports * wildcards)
   */
  matchesPattern(text, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(text);
  }

  /**
   * Create a sample config file
   */
  async createSampleConfig() {
    const configPath = path.join(this.projectRoot, "themetracker.config.js");
    const templatePath = path.join(
      __dirname,
      "../../templates/themetracker.config.js"
    );

    if (fs.existsSync(configPath)) {
      console.log(`📋 Config file already exists at ${configPath}`);
      return false;
    }

    try {
      const template = fs.readFileSync(templatePath, "utf8");
      fs.writeFileSync(configPath, template);
      console.log(`✅ Created sample config file at ${configPath}`);
      console.log(
        `💡 Edit this file to customize ThemeTracker for your project`
      );
      return true;
    } catch (error) {
      console.error(`❌ Failed to create config file:`, error.message);
      return false;
    }
  }
}

module.exports = { ConfigLoader, DEFAULT_CONFIG };
