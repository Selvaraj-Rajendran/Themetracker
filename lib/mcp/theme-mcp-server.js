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
                  this.config.dewConfig?.cssVariablePrefix || "--",
                tokensPath: this.config.dewConfig?.tokensPath,
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

      const fixSuggestion = await this.generateDetailedFix(targetViolation);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                violation: targetViolation,
                fix: fixSuggestion,
                explanation: this.generateFixExplanation(targetViolation),
                confidence: this.calculateFixConfidence(targetViolation),
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
      // Load CSS variables from autofix-rules folder
      const autofixRulesPath = path.resolve(
        this.projectRoot,
        "lib/autofix-rules/dewStyles"
      );
      const variables = {};

      // Load colors from colors.css
      const colorsPath = path.join(autofixRulesPath, "colors.css");
      if (fs.existsSync(colorsPath)) {
        const colorsContent = fs.readFileSync(colorsPath, "utf8");
        const colorMatches = colorsContent.match(/--color-[^:]+/g);
        if (colorMatches) {
          variables.colors = colorMatches.map((match) => match.trim());
        }
      }

      // Load spacing and other variables from numbers.css
      const numbersPath = path.join(autofixRulesPath, "numbers.css");
      if (fs.existsSync(numbersPath)) {
        const numbersContent = fs.readFileSync(numbersPath, "utf8");
        const numberMatches = numbersContent.match(
          /--(spacing|border-radius|opacity|shadow)-[^:]+/g
        );
        if (numberMatches) {
          variables.spacing = numberMatches.map((match) => match.trim());
        }
      }

      return variables;
    } catch (error) {
      console.warn("Failed to load design tokens:", error.message);
      return {};
    }
  }

  async generateAIRecommendation(violation) {
    const { type, suggestion, context, match } = violation;
    const designTokens = await this.loadDesignTokens();
    const betterSuggestion = this.findBestVariableMatch(
      match,
      type,
      designTokens
    );

    return {
      action: "replace",
      from: match,
      to: betterSuggestion || this.extractReplacementFromSuggestion(suggestion),
      reasoning: `This ${type} violates the design system. ${this.getTypeExplanation(
        type
      )}`,
      confidence: this.calculateFixConfidence(violation),
      automated: this.canAutoFix(violation),
    };
  }

  findBestVariableMatch(match, type, designTokens) {
    // Try to find the best matching CSS variable from autofix-rules
    if (type === "hardcoded-color") {
      if (match === "#ffffff" || match === "white") {
        return "var(--color-fill-surface)";
      }
      if (match === "#000000" || match === "black") {
        return "var(--color-text-primary)";
      }
      if (match.match(/#[0-9a-fA-F]{6}/)) {
        // For other hex colors, suggest brand color as fallback
        return "var(--color-fill-brand)";
      }
    } else if (type === "hardcoded-spacing") {
      if (match === "8px") return "var(--spacing-100)";
      if (match === "12px") return "var(--spacing-150)";
      if (match === "16px") return "var(--spacing-200)";
      if (match === "20px") return "var(--spacing-250)";
      if (match === "24px") return "var(--spacing-300)";
      if (match === "32px") return "var(--spacing-400)";
      if (match === "40px") return "var(--spacing-500)";
      if (match === "48px") return "var(--spacing-600)";
      if (match === "4px") return "var(--border-radius-xsmall)";
      if (match === "6px") return "var(--border-radius-small)";
    }
    return null;
  }

  async generateDetailedFix(violation) {
    const designTokens = await this.loadDesignTokens();
    const betterSuggestion = this.findBestVariableMatch(
      violation.match,
      violation.type,
      designTokens
    );
    const replacement =
      betterSuggestion ||
      this.extractReplacementFromSuggestion(violation.suggestion);

    return {
      type: "replacement",
      original: violation.match,
      replacement: replacement,
      line: violation.line,
      column: violation.column,
      automated: this.canAutoFix(violation),
      preview: violation.context.replace(violation.match, replacement),
    };
  }

  extractReplacementFromSuggestion(suggestion) {
    // Extract var(--*) patterns
    const varMatch = suggestion.match(/var\((--[^)]+)\)/);
    if (varMatch) return `var(${varMatch[1]})`;

    // Extract className patterns
    const classMatch = suggestion.match(/className="([^"]+)"/);
    if (classMatch) return classMatch[1];

    // Return the suggestion as-is if no pattern found
    return suggestion.split("\n")[0]; // First line only
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
