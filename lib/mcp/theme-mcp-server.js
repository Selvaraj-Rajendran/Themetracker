#!/usr/bin/env node
/**
 * ThemeTracker MCP Server
 *
 * Provides Model Context Protocol integration for ThemeTracker,
 * enabling AI assistants (Cursor, Copilot) to access theme violations
 * and design system recommendations in real-time.
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const path = require("path");
const fs = require("fs");

// Import ThemeTracker engines
const { auditFile } = require("../engines/audit-engine");
const { DashboardEngine } = require("../engines/dashboard-engine");
const { ConfigLoader } = require("../config/config-loader");

class ThemeTrackerMCPServer {
  constructor(projectRoot) {
    this.projectRoot = projectRoot || process.cwd();
    this.configLoader = new ConfigLoader(this.projectRoot);
    this.config = null;
    this.dashboardEngine = null;

    this.server = new Server(
      {
        name: "themetracker-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  async initialize() {
    if (!this.config) {
      this.config = await this.configLoader.loadConfig();
      this.dashboardEngine = new DashboardEngine(this.projectRoot, this.config);
    }
  }

  setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "themetracker://violations",
            name: "Project Theme Violations",
            description: "Current theme violations across the entire project",
            mimeType: "application/json",
          },
          {
            uri: "themetracker://patterns",
            name: "Design System Patterns",
            description: "Approved design system patterns and tokens",
            mimeType: "application/json",
          },
          {
            uri: "themetracker://config",
            name: "ThemeTracker Configuration",
            description: "Current ThemeTracker configuration and settings",
            mimeType: "application/json",
          },
        ],
      };
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "analyze_file",
            description: "Analyze theme violations in a specific file",
            inputSchema: {
              type: "object",
              properties: {
                filePath: {
                  type: "string",
                  description: "Path to the file to analyze",
                },
                content: {
                  type: "string",
                  description:
                    "Optional: file content to analyze instead of reading from disk",
                },
              },
              required: ["filePath"],
            },
          },
          {
            name: "get_fix_suggestions",
            description: "Get specific fix suggestions for theme violations",
            inputSchema: {
              type: "object",
              properties: {
                filePath: {
                  type: "string",
                  description: "Path to the file",
                },
                lineNumber: {
                  type: "number",
                  description: "Line number of the violation",
                },
                violationType: {
                  type: "string",
                  description: "Type of violation to fix",
                },
              },
              required: ["filePath", "lineNumber"],
            },
          },
          {
            name: "validate_code",
            description: "Validate if code follows design system patterns",
            inputSchema: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description: "Code snippet to validate",
                },
                fileType: {
                  type: "string",
                  description: "File type (js, jsx, ts, tsx, css, scss)",
                },
              },
              required: ["code"],
            },
          },
        ],
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const uri = request.params.uri;

        switch (uri) {
          case "themetracker://violations":
            return await this.getViolationsResource();

          case "themetracker://patterns":
            return await this.getPatternsResource();

          case "themetracker://config":
            return await this.getConfigResource();

          default:
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Unknown resource: ${uri}`
            );
        }
      }
    );

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "analyze_file":
          return await this.analyzeFile(args.filePath, args.content);

        case "get_fix_suggestions":
          return await this.getFixSuggestions(
            args.filePath,
            args.lineNumber,
            args.violationType
          );

        case "validate_code":
          return await this.validateCode(args.code, args.fileType);

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  // Resource handlers
  async getViolationsResource() {
    try {
      await this.initialize();

      // For testing purposes, generate analytics with empty audit data
      // In a real MCP server, this would use cached audit results
      const analytics = await this.dashboardEngine.generateDashboardAnalytics(
        {}
      );

      return {
        contents: [
          {
            uri: "themetracker://violations",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                summary: {
                  totalFiles: analytics.overview.totalFiles,
                  totalViolations: analytics.overview.totalViolations,
                  averageCoverage: analytics.overview.averageCoverage,
                  statusDistribution: analytics.overview.statusDistribution,
                },
                violationsByType: analytics.violations.byType,
                violationsBySeverity: {
                  critical: analytics.violations.critical,
                  high: analytics.violations.high,
                  medium: analytics.violations.medium,
                  low: analytics.violations.low,
                },
                recommendations: analytics.recommendations,
                fileTypes: analytics.fileTypes,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get violations: ${error.message}`
      );
    }
  }

  async getPatternsResource() {
    await this.initialize();
    const approvedPatterns = this.getApprovedPatterns();
    const designTokens = await this.loadDesignTokens();

    return {
      contents: [
        {
          uri: "themetracker://patterns",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              designSystem: {
                name: "Design System",
                cssVariablePrefix:
                  this.config.designTokenConfig?.cssVariablePrefix || "--",
                tokensPath: this.config.designTokenConfig?.tokensPath,
              },
              approvedPatterns: approvedPatterns,
              designTokens: designTokens,
              examples: {
                colors: [
                  {
                    violation: "background: #ffffff",
                    fix: "background: var(--color-fill-surface)",
                    explanation:
                      "Use design system color tokens instead of hardcoded hex values",
                  },
                  {
                    violation: 'className="bg-blue-500"',
                    fix: 'className="bg-color-brand-primary"',
                    explanation:
                      "Use design system class names instead of arbitrary Tailwind colors",
                  },
                ],
                spacing: [
                  {
                    violation: "margin: 16px",
                    fix: "margin: var(--spacing-200)",
                    explanation:
                      "Use design system spacing tokens for consistent spacing",
                  },
                  {
                    violation: 'className="p-4"',
                    fix: 'className="p-spacing-md"',
                    explanation:
                      "Use design system spacing classes instead of arbitrary Tailwind spacing",
                  },
                ],
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async getConfigResource() {
    await this.initialize();
    return {
      contents: [
        {
          uri: "themetracker://config",
          mimeType: "application/json",
          text: JSON.stringify(
            {
              projectRoot: this.projectRoot,
              config: this.config,
              version: require("../../package.json").version,
              capabilities: {
                fileTypes: ["js", "jsx", "ts", "tsx", "css", "scss"],
                analysisTypes: [
                  "violations",
                  "coverage",
                  "tokens",
                  "recommendations",
                ],
                integrations: [
                  "design-system",
                  "tailwind",
                  "styled-components",
                ],
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Tool handlers
  async analyzeFile(filePath, content) {
    try {
      await this.initialize();
      const absolutePath = path.resolve(this.projectRoot, filePath);

      // Use provided content or read from file
      let fileContent = content;
      if (!fileContent) {
        if (!fs.existsSync(absolutePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        fileContent = fs.readFileSync(absolutePath, "utf8");
      }

      // Perform analysis
      const analysis = await auditFile(absolutePath, this.config);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                file: {
                  path: analysis.filePath,
                  type: analysis.fileType,
                  coverage: analysis.coverage,
                  status: analysis.status,
                  linesOfCode: analysis.linesOfCode,
                },
                violations: await Promise.all(
                  analysis.violationsList.map(async (v) => ({
                    type: v.type,
                    severity: v.severity,
                    line: v.line,
                    column: v.column,
                    message: v.message,
                    context: v.context,
                    suggestion: v.suggestion,
                    aiRecommendation: await this.generateAIRecommendation(v),
                  }))
                ),
                themeTokens: analysis.themeTokens,
                recommendations: analysis.analysis.recommendations,
                summary: {
                  totalViolations: analysis.violations,
                  violationsByType: analysis.analysis.violationsByType,
                  violationsBySeverity: analysis.analysis.violationsBySeverity,
                  themeTokenCount: analysis.analysis.themeTokenCount,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to analyze file: ${error.message}`
      );
    }
  }

  async getFixSuggestions(filePath, lineNumber, violationType) {
    try {
      const analysis = await this.analyzeFile(filePath);
      const violations = JSON.parse(analysis.content[0].text).violations;

      const targetViolation = violations.find(
        (v) =>
          v.line === lineNumber && (!violationType || v.type === violationType)
      );

      if (!targetViolation) {
        throw new Error(`No violation found at line ${lineNumber}`);
      }

      // Load all available CSS variables/tokens from theme config
      const designTokens = await this.loadDesignTokens();

      // Load theme configuration for additional context
      const config = await this.configLoader.loadConfig();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                violation: {
                  type: targetViolation.type,
                  severity: targetViolation.severity,
                  message: targetViolation.message,
                  line: targetViolation.line,
                  column: targetViolation.column,
                  context: targetViolation.context,
                  fullContext: targetViolation.fullContext,
                  match: targetViolation.match,
                  originalValue: targetViolation.match,
                },
                availableTokens: {
                  colors: designTokens.colors,
                  spacing: designTokens.spacing,
                  borderRadius: designTokens.borderRadius,
                  opacity: designTokens.opacity,
                  shadow: designTokens.shadow,
                  typography: designTokens.typography,
                  all: designTokens.all,
                  metadata: designTokens.metadata,
                },
                themeConfig: {
                  cssVariablePrefix:
                    config.designTokenConfig?.cssVariablePrefix || "--",
                  tokensPath: config.designTokenConfig?.tokensPath,
                  fallbackPaths: config.designTokenConfig?.fallbackPaths,
                },
                context: {
                  filePath: filePath,
                  fileType: this.getFileType(filePath),
                  suggestedApproach: this.getSuggestedApproach(
                    targetViolation.type
                  ),
                },
                aiInstructions: {
                  task: "Map the violation to the most appropriate CSS variable/token",
                  guidance: [
                    "Analyze the violation type and the hardcoded value",
                    "Choose the most semantically appropriate CSS variable from availableTokens",
                    "Consider the context (colors for styling, spacing for layout, etc.)",
                    "Provide the replacement using var() syntax",
                    "Explain your reasoning for the mapping choice",
                  ],
                  format:
                    "Replace '" +
                    targetViolation.match +
                    "' with 'var(--appropriate-token)'",
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get fix suggestions: ${error.message}`
      );
    }
  }

  getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileTypeMap = {
      ".js": "javascript",
      ".jsx": "react",
      ".ts": "typescript",
      ".tsx": "react-typescript",
      ".css": "css",
      ".scss": "scss",
      ".sass": "sass",
      ".less": "less",
      ".vue": "vue",
      ".svelte": "svelte",
    };
    return fileTypeMap[ext] || "unknown";
  }

  getSuggestedApproach(violationType) {
    const approaches = {
      "hardcoded-color": {
        category: "color",
        suggestions: [
          "Use semantic color tokens (e.g., --color-text-primary, --color-fill-brand)",
          "Consider the purpose: text, background, border, or accent colors",
          "Check if the color has semantic meaning (primary, secondary, error, success)",
        ],
      },
      "hardcoded-spacing": {
        category: "spacing",
        suggestions: [
          "Use spacing scale tokens (e.g., --spacing-100, --spacing-200)",
          "Consider the context: margin, padding, gap, or positioning",
          "Use consistent spacing values from the design system",
        ],
      },
      "hardcoded-font-size": {
        category: "typography",
        suggestions: [
          "Use typography scale tokens (e.g., --font-size-small, --font-size-large)",
          "Consider the hierarchy: heading, body, caption, or label text",
          "Maintain consistent text sizing across the application",
        ],
      },
      "hardcoded-border-radius": {
        category: "border-radius",
        suggestions: [
          "Use border radius tokens (e.g., --border-radius-small, --border-radius-medium)",
          "Consider the component type: buttons, cards, inputs, or containers",
          "Maintain visual consistency with rounded corners",
        ],
      },
      "hardcoded-shadow": {
        category: "shadow",
        suggestions: [
          "Use shadow tokens (e.g., --shadow-small, --shadow-large)",
          "Consider the elevation level and context",
          "Use shadows to establish visual hierarchy",
        ],
      },
    };

    return (
      approaches[violationType] || {
        category: "general",
        suggestions: [
          "Use design system tokens when available",
          "Avoid hardcoded values",
        ],
      }
    );
  }

  async validateCode(code, fileType = "js") {
    try {
      await this.initialize();

      // Create a temporary file path for analysis (relative to project root)
      const tempFilePath = `temp-validation.${fileType}`;

      // Analyze the code snippet using the provided content
      const analysis = await this.analyzeFile(tempFilePath, code);
      const result = JSON.parse(analysis.content[0].text);

      const isValid = result.violations.length === 0;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                isValid,
                violations: result.violations,
                suggestions: await Promise.all(
                  result.violations.map((v) => this.generateAIRecommendation(v))
                ),
                compliance: {
                  score: result.file.coverage,
                  status: result.file.status,
                  passesDesignSystem: isValid,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to validate code: ${error.message}`
      );
    }
  }

  // Helper methods
  getApprovedPatterns() {
    return {
      colors: {
        cssVariables: ["var(--color-*)", "var(--fill-*)"],
        tailwindClasses: ["bg-color-*", "text-color-*", "border-color-*"],
        violations: ["#[0-9a-fA-F]{3,6}", "rgb\\(", "rgba\\(", "hsl\\("],
      },
      spacing: {
        cssVariables: ["var(--spacing-*)", "var(--border-radius-*)"],
        tailwindClasses: ["p-spacing-*", "m-spacing-*", "gap-spacing-*"],
        violations: ["\\d+px", "\\d+rem", "\\d+em"],
      },
      typography: {
        cssVariables: ["var(--text-*)", "var(--font-*)"],
        violations: ["font-size:\\s*\\d+", "line-height:\\s*\\d+"],
      },
    };
  }

  async loadDesignTokens() {
    try {
      const config = await this.configLoader.loadConfig();
      const designTokenConfig = config.designTokenConfig;

      const variables = {
        colors: [],
        spacing: [],
        borderRadius: [],
        opacity: [],
        shadow: [],
        typography: [],
        all: [],
      };

      const loadedFiles = [];

      // Get all possible token file paths
      const tokenPaths = this.getTokenFilePaths(designTokenConfig);

      // Load tokens from each found file
      for (const tokenPath of tokenPaths) {
        if (fs.existsSync(tokenPath)) {
          try {
            const fileTokens = await this.parseTokenFile(
              tokenPath,
              designTokenConfig
            );
            if (fileTokens && fileTokens.length > 0) {
              // Categorize tokens and add to variables
              this.categorizeTokens(fileTokens, variables);
              loadedFiles.push(tokenPath);
              console.log(
                `✅ Loaded ${fileTokens.length} tokens from ${tokenPath}`
              );
            }
          } catch (error) {
            console.warn(`⚠️  Failed to parse ${tokenPath}: ${error.message}`);
          }
        }
      }

      // Remove duplicates from all categories
      Object.keys(variables).forEach((category) => {
        if (Array.isArray(variables[category])) {
          variables[category] = [...new Set(variables[category])];
        }
      });

      console.log("📊 Design tokens summary:", {
        colors: variables.colors.length,
        spacing: variables.spacing.length,
        borderRadius: variables.borderRadius.length,
        typography: variables.typography.length,
        total: variables.all.length,
        loadedFrom: loadedFiles,
      });

      // Add metadata for AI model context
      variables.metadata = {
        loadedFrom: loadedFiles,
        totalFiles: loadedFiles.length,
        categories: {
          colors: {
            count: variables.colors.length,
            examples: variables.colors.slice(0, 3),
            description:
              "Color tokens for text, backgrounds, borders, and brand colors",
          },
          spacing: {
            count: variables.spacing.length,
            examples: variables.spacing.slice(0, 3),
            description:
              "Spacing tokens for margins, padding, gaps, and layout",
          },
          borderRadius: {
            count: variables.borderRadius.length,
            examples: variables.borderRadius.slice(0, 3),
            description:
              "Border radius tokens for rounded corners and circular elements",
          },
          typography: {
            count: variables.typography.length,
            examples: variables.typography.slice(0, 3),
            description:
              "Typography tokens for font sizes, weights, and line heights",
          },
          opacity: {
            count: variables.opacity.length,
            examples: variables.opacity.slice(0, 3),
            description: "Opacity tokens for transparency and overlay effects",
          },
          shadow: {
            count: variables.shadow.length,
            examples: variables.shadow.slice(0, 3),
            description: "Shadow tokens for elevation and depth effects",
          },
        },
        usage: {
          syntax: "var(token-name)",
          example: "color: var(--color-text-primary);",
          fallback: "var(--color-text-primary, #000000)",
        },
        config: {
          prefix: designTokenConfig.cssVariablePrefix,
          supportedFormats: designTokenConfig.supportedFormats,
        },
      };

      return variables;
    } catch (error) {
      console.warn("Failed to load design tokens:", error.message);
      return {
        colors: [],
        spacing: [],
        borderRadius: [],
        opacity: [],
        shadow: [],
        typography: [],
        all: [],
        metadata: {
          loadedFrom: [],
          totalFiles: 0,
          error: error.message,
        },
      };
    }
  }

  getTokenFilePaths(designTokenConfig) {
    const paths = [];

    // Add primary token path(s) if specified
    if (designTokenConfig.tokensPath) {
      // Support both single path (string) and multiple paths (array)
      const tokensPaths = Array.isArray(designTokenConfig.tokensPath)
        ? designTokenConfig.tokensPath
        : [designTokenConfig.tokensPath];

      tokensPaths.forEach((tokenPath) => {
        const primaryPath = path.resolve(this.projectRoot, tokenPath);
        paths.push(primaryPath);
      });
    }

    // Add fallback paths
    if (
      designTokenConfig.fallbackPaths &&
      Array.isArray(designTokenConfig.fallbackPaths)
    ) {
      designTokenConfig.fallbackPaths.forEach((fallbackPath) => {
        const fullPath = path.resolve(this.projectRoot, fallbackPath);
        paths.push(fullPath);
      });
    }

    return paths;
  }

  async parseTokenFile(filePath, designTokenConfig) {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, "utf8");

    switch (ext) {
      case ".css":
      case ".scss":
      case ".sass":
        return this.parseCSSTokens(content, designTokenConfig);

      case ".json":
        return this.parseJSONTokens(content, designTokenConfig);

      case ".js":
      case ".ts":
        return this.parseJSTokens(filePath, designTokenConfig);

      default:
        // Try to detect format from content
        if (content.includes("--") && content.includes(":")) {
          return this.parseCSSTokens(content, designTokenConfig);
        } else if (content.trim().startsWith("{")) {
          return this.parseJSONTokens(content, designTokenConfig);
        }
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  parseCSSTokens(content, designTokenConfig) {
    const prefix = designTokenConfig.cssVariablePrefix || "--";
    // Match CSS custom properties with the specified prefix
    const regex = new RegExp(
      `${prefix.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&"
      )}[a-zA-Z][a-zA-Z0-9-]*(?=\\s*:)`,
      "g"
    );
    const matches = content.match(regex);
    return matches ? [...new Set(matches)] : [];
  }

  parseJSONTokens(content, designTokenConfig) {
    try {
      const tokens = JSON.parse(content);
      const prefix = designTokenConfig.cssVariablePrefix || "--";

      // Extract all keys that could be CSS variables
      const extractTokens = (obj, path = "") => {
        let result = [];

        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}-${key}` : key;

          if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
          ) {
            // Recursively extract from nested objects
            result.push(...extractTokens(value, currentPath));
          } else {
            // This is a leaf node, create a CSS variable name
            const cssVarName = currentPath.startsWith(prefix)
              ? currentPath
              : `${prefix}${currentPath}`;
            result.push(cssVarName);
          }
        }

        return result;
      };

      return extractTokens(tokens);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  parseJSTokens(filePath, designTokenConfig) {
    try {
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(filePath)];
      const tokens = require(filePath);

      // Handle different export patterns
      let tokenObj = tokens;
      if (tokens.default) tokenObj = tokens.default;
      if (tokens.theme) tokenObj = tokens.theme;
      if (tokens.tokens) tokenObj = tokens.tokens;

      const prefix = designTokenConfig.cssVariablePrefix || "--";

      // Extract tokens similar to JSON parsing
      const extractTokens = (obj, path = "") => {
        let result = [];

        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}-${key}` : key;

          if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
          ) {
            result.push(...extractTokens(value, currentPath));
          } else {
            const cssVarName = currentPath.startsWith(prefix)
              ? currentPath
              : `${prefix}${currentPath}`;
            result.push(cssVarName);
          }
        }

        return result;
      };

      return extractTokens(tokenObj);
    } catch (error) {
      throw new Error(`Failed to parse JS/TS file: ${error.message}`);
    }
  }

  categorizeTokens(tokens, variables) {
    tokens.forEach((token) => {
      const lowerToken = token.toLowerCase();

      // Add to appropriate categories based on token name patterns
      if (
        lowerToken.includes("color") ||
        lowerToken.includes("fill") ||
        lowerToken.includes("text") ||
        lowerToken.includes("background") ||
        lowerToken.includes("border")
      ) {
        variables.colors.push(token);
      } else if (
        lowerToken.includes("spacing") ||
        lowerToken.includes("margin") ||
        lowerToken.includes("padding") ||
        lowerToken.includes("gap")
      ) {
        variables.spacing.push(token);
      } else if (
        lowerToken.includes("radius") ||
        lowerToken.includes("rounded")
      ) {
        variables.borderRadius.push(token);
      } else if (
        lowerToken.includes("opacity") ||
        lowerToken.includes("alpha")
      ) {
        variables.opacity.push(token);
      } else if (
        lowerToken.includes("shadow") ||
        lowerToken.includes("elevation")
      ) {
        variables.shadow.push(token);
      } else if (
        lowerToken.includes("font") ||
        lowerToken.includes("text") ||
        lowerToken.includes("type") ||
        lowerToken.includes("size") ||
        lowerToken.includes("weight") ||
        lowerToken.includes("line")
      ) {
        variables.typography.push(token);
      }

      // Add to all tokens
      variables.all.push(token);
    });
  }

  async generateAIRecommendation(violation) {
    const { type, suggestion, context, match } = violation;

    // Use cached design tokens if available to avoid multiple loads
    if (!this.cachedDesignTokens) {
      this.cachedDesignTokens = await this.loadDesignTokens();
    }
    const designTokens = this.cachedDesignTokens;

    // First try to find the best match from actual design tokens
    const betterSuggestion = this.findBestVariableMatch(
      match,
      type,
      designTokens
    );

    // If no better suggestion, try to extract and validate from original suggestion
    let finalSuggestion = betterSuggestion;
    if (!finalSuggestion) {
      finalSuggestion = await this.extractReplacementFromSuggestion(suggestion);
    }

    // If still no valid suggestion, provide information about available variables
    if (!finalSuggestion) {
      const relevantVars =
        type === "hardcoded-color" ? designTokens.colors : designTokens.spacing;
      finalSuggestion =
        relevantVars.length > 0
          ? `var(${relevantVars[0]})`
          : "/* Use design system variable */";
    }

    return {
      action: "replace",
      from: match,
      to: finalSuggestion,
      reasoning: `This ${type} violates the design system. ${this.getTypeExplanation(
        type
      )}`,
      confidence: this.calculateFixConfidence(violation),
      automated: this.canAutoFix(violation),
      availableVariables: designTokens.all ? designTokens.all.slice(0, 5) : [], // Show available options
    };
  }

  findBestVariableMatch(match, type, designTokens) {
    // ONLY suggest variables that actually exist in the loaded design tokens
    if (!designTokens || !designTokens.all || designTokens.all.length === 0) {
      return null;
    }

    if (type === "hardcoded-color") {
      // For white/light colors, prefer surface colors
      if (match === "#ffffff" || match === "white" || match === "#fff") {
        const surfaceVar = designTokens.colors.find((v) =>
          v.includes("fill-surface")
        );
        if (surfaceVar) return `var(${surfaceVar})`;
      }

      // For black/dark colors, prefer text colors
      if (match === "#000000" || match === "black" || match === "#000") {
        const textVar = designTokens.colors.find((v) =>
          v.includes("text-primary")
        );
        if (textVar) return `var(${textVar})`;
      }

      // For other colors, suggest brand color if available
      const brandVar = designTokens.colors.find((v) =>
        v.includes("fill-brand")
      );
      if (brandVar) return `var(${brandVar})`;

      // Fallback to first color variable
      if (designTokens.colors.length > 0) {
        return `var(${designTokens.colors[0]})`;
      }
    } else if (type === "hardcoded-spacing") {
      // Try to match pixel values to spacing variables
      const pxValue = parseInt(match.replace("px", ""));

      // Create mapping for common pixel values to spacing tokens
      const spacingMap = {
        2: designTokens.spacing.find((v) => v.includes("025")),
        4: designTokens.spacing.find((v) => v.includes("050")),
        6: designTokens.spacing.find((v) => v.includes("075")),
        8: designTokens.spacing.find((v) => v.includes("100")),
        12: designTokens.spacing.find((v) => v.includes("150")),
        16: designTokens.spacing.find((v) => v.includes("200")),
        20: designTokens.spacing.find((v) => v.includes("250")),
        24: designTokens.spacing.find((v) => v.includes("300")),
        32: designTokens.spacing.find((v) => v.includes("400")),
        40: designTokens.spacing.find((v) => v.includes("500")),
        48: designTokens.spacing.find((v) => v.includes("600")),
        56: designTokens.spacing.find((v) => v.includes("700")),
        64: designTokens.spacing.find((v) => v.includes("800")),
        72: designTokens.spacing.find((v) => v.includes("900")),
        80: designTokens.spacing.find((v) => v.includes("1000")),
      };

      // For border radius values
      const radiusMap = {
        2: designTokens.borderRadius.find((v) => v.includes("2xsmall")),
        4: designTokens.borderRadius.find((v) => v.includes("xsmall")),
        6: designTokens.borderRadius.find((v) => v.includes("small")),
        8: designTokens.borderRadius.find((v) => v.includes("medium")),
        12: designTokens.borderRadius.find((v) => v.includes("large")),
        99: designTokens.borderRadius.find((v) => v.includes("circular")),
      };

      // Check if it's a border radius value
      if (radiusMap[pxValue]) {
        return `var(${radiusMap[pxValue]})`;
      }

      // Check if it's a spacing value
      if (spacingMap[pxValue]) {
        return `var(${spacingMap[pxValue]})`;
      }

      // Fallback to closest spacing value
      if (designTokens.spacing.length > 0) {
        return `var(${designTokens.spacing[0]})`;
      }
    }

    return null;
  }

  async generateDetailedFix(violation) {
    const designTokens = await this.loadDesignTokens();

    // First try to find the best match from actual design tokens
    const betterSuggestion = this.findBestVariableMatch(
      violation.match,
      violation.type,
      designTokens
    );

    // If no better suggestion found, try to extract from original suggestion (but validate it)
    let replacement = betterSuggestion;
    if (!replacement) {
      replacement = await this.extractReplacementFromSuggestion(
        violation.suggestion
      );
    }

    // If still no valid replacement, provide a generic message
    if (!replacement) {
      replacement = `/* Use design system variable from: ${designTokens.all
        .slice(0, 3)
        .join(", ")}... */`;
    }

    return {
      type: "replacement",
      original: violation.match,
      replacement: replacement,
      line: violation.line,
      column: violation.column,
      automated: this.canAutoFix(violation),
      preview: violation.context.replace(violation.match, replacement),
      availableVariables: designTokens.all.slice(0, 10), // Show first 10 available variables
    };
  }

  async extractReplacementFromSuggestion(suggestion) {
    // Load available design tokens to validate suggestions
    const designTokens = await this.loadDesignTokens();

    // Extract var(--*) patterns
    const varMatch = suggestion.match(/var\((--[^)]+)\)/);
    if (varMatch) {
      const variable = varMatch[1];
      // ONLY return if this variable actually exists in our design tokens
      if (designTokens.all && designTokens.all.includes(variable)) {
        return `var(${variable})`;
      }
      // If the variable doesn't exist, don't suggest it
      console.warn(
        `Variable ${variable} not found in design tokens, skipping suggestion`
      );
      return null;
    }

    // Extract className patterns
    const classMatch = suggestion.match(/className="([^"]+)"/);
    if (classMatch) return classMatch[1];

    // For any other patterns, return null to avoid suggesting invalid variables
    return null;
  }

  generateFixExplanation(violation) {
    const explanations = {
      "hardcoded-color":
        "Hardcoded colors should be replaced with design system color tokens to ensure consistency and maintainability.",
      "tailwind-color":
        "Use approved design system color classes instead of arbitrary Tailwind colors.",
      "hardcoded-spacing":
        "Hardcoded spacing values should use design system spacing tokens for consistent spacing across the application.",
      "styled-component-theme":
        "Styled-components theme access should be replaced with CSS custom properties.",
    };

    return (
      explanations[violation.type] ||
      "This pattern violates design system guidelines."
    );
  }

  calculateFixConfidence(violation) {
    // Higher confidence for common patterns
    if (violation.suggestion.includes("var(--")) return 0.9;
    if (violation.suggestion.includes("className=")) return 0.85;
    return 0.7;
  }

  canAutoFix(violation) {
    // Patterns that can be automatically fixed
    const autoFixableTypes = [
      "hardcoded-color",
      "hardcoded-spacing",
      "tailwind-color",
    ];
    return autoFixableTypes.includes(violation.type);
  }

  getTypeExplanation(type) {
    const explanations = {
      "hardcoded-color":
        "Use design system color tokens instead of hardcoded values.",
      "tailwind-color": "Use approved design system classes.",
      "hardcoded-spacing": "Use spacing tokens for consistent layout.",
      "styled-component-theme": "Migrate to CSS custom properties.",
    };
    return explanations[type] || "Follow design system guidelines.";
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("ThemeTracker MCP server started successfully");
  }
}

// CLI integration
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd();
  const server = new ThemeTrackerMCPServer(projectRoot);
  server.start().catch(console.error);
}

module.exports = { ThemeTrackerMCPServer };
