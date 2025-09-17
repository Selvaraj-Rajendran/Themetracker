# ThemeTracker

🎨 **Real-time theme auditing tool with comprehensive analytics for design system migration**

ThemeTracker is a sophisticated code analysis tool designed to help teams migrate from legacy styling approaches (hardcoded values, styled-components themes) to modern CSS custom properties and design systems like design token-based systems.

[![npm version](https://badge.fury.io/js/themetracker.svg)](https://www.npmjs.com/package/themetracker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-14+-green.svg)](https://nodejs.org/)
[![Downloads](https://img.shields.io/npm/dm/themetracker.svg)](https://www.npmjs.com/package/themetracker)

## ✨ Features

### 🚀 **Quick Start**

- **Zero Configuration** - Works out of the box with auto-detection
- **Universal Compatibility** - Works with any React/JS project structure
- **Like Majestic for Jest** - Install globally and run anywhere

### 🎯 **Core Functionality**

- ✅ **Zero External Dependencies** - Uses only Node.js built-in modules
- ✅ **Real-time Analysis** - Custom WebSocket implementation for live updates
- ✅ **Interactive Dashboard** - GitHub-inspired dark UI with responsive design
- ✅ **File-by-File Auditing** - Click any file to audit instantly
- ✅ **Batch Processing** - Audit entire directories or codebase
- ✅ **CSS/SCSS Support** - Analyze stylesheets in addition to JS/TS files

### 🎨 **Design System Integration**

- ✅ **Design System Ready** - Built-in support for design tokens
- ✅ **Configurable Patterns** - Customize violation detection
- ✅ **CSS Custom Properties** - Promotes `var(--*)` usage patterns
- ✅ **Smart Auto-Detection** - Finds config files automatically

### 📊 **Advanced Analytics**

- ✅ **Contextual File Classification** - UI components, pages, utilities
- ✅ **Coverage Metrics Engine** - Comprehensive coverage analysis with trends
- ✅ **Components Metrics** - Page-by-page component hierarchy analysis
- ✅ **Violation Categorization** - Separates themeable vs non-themeable violations
- ✅ **Priority Scoring** - Identifies critical files and quick wins

### 🤖 **AI Integration (NEW!)**

- ✅ **MCP Server Support** - Model Context Protocol for AI assistants
- ✅ **Cursor Integration** - Real-time violation detection in Cursor IDE
- ✅ **Automated Fix Suggestions** - AI-powered theme compliance fixes
- ✅ **Design System Context** - AI understands your specific design tokens

## 🚀 Installation & Usage

### Global Installation (Recommended)

```bash
# Install globally
npm install -g themetracker

# Run in any project
cd /your-react-project
themetracker start
```

### npx Usage (No Installation Required)

```bash
# Run directly without installing
cd /your-react-project
npx themetracker start
```

### AI Integration with MCP (NEW!)

```bash
# Start MCP server for AI integration
cd /your-react-project
themetracker mcp

# Then configure in Cursor settings:
{
  "mcpServers": {
    "themetracker": {
      "command": "npx",
      "args": ["themetracker", "mcp"]
    }
  }
}
```

### Local Development Dependency

```bash
# Install as dev dependency
npm install --save-dev themetracker

# Add to package.json scripts
{
  "scripts": {
    "theme-audit": "themetracker start"
  }
}

# Run via npm
npm run theme-audit
```

## 🎯 Quick Start Guide

### 1. **Start ThemeTracker**

```bash
themetracker start
```

**What happens:**

- 🔍 Auto-detects your project structure (`src/`, `components/`, etc.)
- 🎨 Looks for design system configuration
- 🌐 Starts server on `http://localhost:3001`
- 🚀 Opens interactive dashboard in your browser
- ⚡ Begins real-time file monitoring

### 2. **Initialize Configuration (Optional)**

```bash
themetracker init
```

Creates a `themetracker.config.js` file with all available options:

```javascript
module.exports = {
  designTokens: {
    tokensPath: "src/styles/tokens/colors.json",
  },
  sourceDirectories: {
    include: ["src", "components"],
  },
  // ... many more options
};
```

### 3. **Check Project Status**

```bash
themetracker info
```

Shows:

- 📂 Project structure detected
- 🎨 Design system configuration status
- 📊 Quick file scan preview
- 🔧 Current configuration

## 📊 Dashboard Features

### **Main Dashboard** (`http://localhost:3001`)

```
📁 Project Structure (Sidebar)     |  📋 Analysis Panel (Main)
├── 📂 components/                 |
│   ├── Button.js        🟢 92%    |  File: components/UserCard.js
│   ├── Card.js          🟡 67%    |  Coverage: 67% | Type: UI Component
│   └── Modal.js         🔴 23%    |
├── 📂 pages/                      |  🚨 Violations Found: 5
│   └── Dashboard.js     🟢 88%    |  ━━━━━━━━━━━━━━━━━━━━━━━━━━━
└── 📂 utils/                      |
    └── helpers.js       ⚫ 12%    |  🔴 HIGH PRIORITY (Line 45)
                                   |  Found: background: #ffffff;
[🔍 Audit All] [📊 Report] [🔄]   |  💡 Use var(--color-fill-surface)
```

**Color Coding:**

- 🟢 **Green (90%+)**: Excellent theme coverage
- 🟡 **Yellow (40-89%)**: Needs improvement
- 🔴 **Red (<40%)**: Critical issues
- ⚫ **Gray**: Appropriately styled (utility files)

### **Summary Dashboard** (`/src/summary.html`)

```
📈 Theme Coverage Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Coverage: 73.2%  |  Total Files: 127  |  Violations: 234

📊 File Type Breakdown:
┌─────────────────┬─────────┬──────────┬─────────────┐
│ File Type       │ Count   │ Coverage │ Status      │
├─────────────────┼─────────┼──────────┼─────────────┤
│ UI Components   │ 45      │ 81.2%    │ 🟢 Excellent │
│ Page Components │ 12      │ 67.8%    │ 🟡 Fair      │
│ CSS/SCSS Files  │ 8       │ 74.5%    │ 🟢 Good      │
│ Utility Files   │ 34      │ 15.3%    │ ⚫ Expected  │
└─────────────────┴─────────┴──────────┴─────────────┘
```

## 🎨 Violation Detection

### **JavaScript/TypeScript Files**

```javascript
// ❌ Detected Violations
const Button = styled.button`
  background: #ffffff;                    // → var(--color-fill-surface)
  margin: 16px;                          // → var(--spacing-200)
  ${({ theme }) => theme.colors.primary} // → var(--color-fill-brand)
`;

// Tailwind violations
className="bg-blue-500 text-gray-700 p-4"  // → Use design token classes

// ✅ Approved Patterns
background: var(--color-fill-surface);
className="bg-color-brand-primary text-color-text-primary"
```

### **CSS/SCSS Files** (New!)

```css
/* ❌ CSS Violations */
.component {
  background-color: #ffffff; /* → var(--color-fill-surface) */
  margin: 16px; /* → var(--spacing-200) */
  font-size: 14px; /* → var(--text-sm) */
  box-shadow: 0 2px 4px #ccc; /* → var(--shadow-sm) */
}

/* ❌ SCSS Violations */
/* → Use design token CSS variables */
color: darken($primary-color, 10%); /* → Use design token color tokens */

/* ✅ Approved Patterns */
.component {
  background: var(--color-fill-surface);
  margin: var(--spacing-200);
}
```

## 🔧 Configuration

### **Auto-Detection (Zero Config)**

ThemeTracker automatically detects:

- 📂 Source directories: `src/`, `app/`, `components/`
- 🎨 Design token config files: `src/styles/tokens/colors.json`
- 📄 File types: `.js`, `.jsx`, `.ts`, `.tsx`, `.css`, `.scss`
- 🚫 Files to ignore: tests, mocks, node_modules, etc.

### **Custom Configuration**

Create `themetracker.config.js` for custom settings:

```javascript
module.exports = {
  // Design System
  designTokens: {
    tokensPath: "src/styles/tokens/colors.json",
    cssVariablePrefix: "--",
  },

  // Source scanning
  sourceDirectories: {
    include: ["src", "components", "pages"],
    focus: ["src/components"], // Only scan specific dirs
  },

  // File types
  fileTypes: {
    javascript: { extensions: ["js", "jsx", "ts", "tsx"], enabled: true },
    styles: { extensions: ["css", "scss", "sass"], enabled: true },
  },

  // Enhanced ignore patterns
  ignore: {
    directories: ["node_modules", "dist", "__tests__"],
    filePatterns: ["*.test.*", "*.mock.*", "*.d.ts"],
    pathPatterns: ["/test/", "/mocks/", "/utils/"],
  },

  // Analysis settings
  analysis: {
    includeCssFiles: true,
    violations: {
      hardcodedColors: true,
      cssHardcodedValues: true,
      scssVariables: true,
    },
  },

  // Server settings
  server: {
    port: 3001,
    autoOpen: true,
  },
};
```

## 🎯 CLI Commands

```bash
# Start interactive dashboard
themetracker start
themetracker start --port 3002 --no-open

# Start MCP server for AI integration
themetracker mcp

# Initialize configuration
themetracker init

# Show project information
themetracker info

# Show help
themetracker help
```

## 📋 Supported File Types

| File Type  | Extensions       | Analysis                                          |
| ---------- | ---------------- | ------------------------------------------------- |
| JavaScript | `.js`, `.jsx`    | ✅ Styled-components, className, hardcoded values |
| TypeScript | `.ts`, `.tsx`    | ✅ Same as JavaScript + type definitions          |
| CSS        | `.css`           | ✅ Hardcoded colors, spacing, typography          |
| SCSS/Sass  | `.scss`, `.sass` | ✅ CSS + SCSS variables, functions                |
| Less       | `.less`          | ✅ CSS + Less variables                           |

## 🎨 Design Token Integration

### **Token Detection**

ThemeTracker automatically loads your design token definitions:

```json
// src/styles/tokens/colors.json
{
  "color-brand-primary": "#0066cc",
  "color-text-primary": "#1a1a1a",
  "color-surface": "#ffffff",
  "spacing-md": "1rem",
  "radius-sm": "0.25rem"
}
```

### **Approved vs Violation Patterns**

```javascript
// ✅ Approved
className="bg-color-brand-primary"  // From design token
var(--color-fill-surface)           // CSS custom properties

// ❌ Violations
className="bg-blue-500"            // Hardcoded Tailwind
background: #ffffff                // Hardcoded hex
```

## 📊 Migration Strategy

### **Recommended Workflow**

#### **Phase 1: Assessment**

```bash
themetracker start
# → Click "Coverage Report"
# → Review critical files (red indicators)
# → Export baseline metrics
```

#### **Phase 2: Quick Wins**

Focus on files with 80%+ potential:

- Badge, Tooltip, Icon components
- Simple layout components

#### **Phase 3: Core Components**

Tackle complex, high-impact components:

- Form components, navigation, data display

#### **Phase 4: Pages & Integration**

Complete migration at page level

## 🛠 Advanced Features

### **Real-time Updates**

- 🔌 WebSocket-based live communication
- ⚡ Instant feedback as you make changes
- 📊 Live progress tracking during batch operations

### **Smart File Classification**

```javascript
// Automatically categorized by content analysis
"ui-component"    → 80-95% coverage expected
"page-component"  → 60-80% coverage expected
"style-file"      → 70-90% coverage expected
"utility"         → 10-30% coverage expected (appropriate)
```

### **Contextual Analysis**

- Different expectations for different file types
- Intelligent violation prioritization
- Contextual recommendations

### **Performance Optimized**

- Processes large codebases efficiently
- Memory usage controls
- Concurrent file processing

## 🔧 Troubleshooting

### **Common Issues**

**No files found:**

```bash
themetracker info  # Check detected directories
themetracker init  # Create config file
```

**Design tokens not found:**

```bash
# Check these paths exist:
src/styles/tokens/colors.json
styles/tokens/colors.json
theme/tokens.json
```

**Port already in use:**

```bash
themetracker start --port 3002
```

**WebSocket connection fails:**

- Check firewall settings
- Restart: `Ctrl+C` then `themetracker start`
- Clear browser cache

## 📖 Examples

### **Example 1: React Component Migration**

```bash
cd my-react-app
themetracker start
# → Click components/Button.js
# → See violations: hardcoded colors, spacing
# → Follow suggestions to use var(--*)
# → Watch coverage improve in real-time
```

### **Example 2: CSS File Analysis**

```bash
# ThemeTracker now analyzes CSS/SCSS too!
# → Detects hardcoded values in stylesheets
# → Suggests CSS custom property replacements
# → Tracks SCSS variable usage
```

### **Example 3: Large Codebase Audit**

```bash
cd enterprise-app
themetracker start
# → Click "Audit All Files"
# → Watch real-time progress (1000+ files)
# → Review summary dashboard
# → Export coverage report
```

## 🚀 Development

### **Package Structure**

```
themetracker/
├── bin/themetracker          # CLI executable
├── lib/
│   ├── index.js             # Main API
│   ├── cli.js               # CLI implementation
│   ├── server.js            # HTTP + WebSocket server
│   ├── engines/             # Analysis engines
│   ├── config/              # Configuration management
│   └── utils/               # Utilities
├── assets/ui/               # Dashboard UI (preserved exactly)
└── templates/               # Config templates
```

### **API Usage**

```javascript
const { ThemeTracker } = require("themetracker");

const tracker = new ThemeTracker({ projectRoot: "/path/to/project" });
await tracker.init();

const files = await tracker.scanFiles();
const server = await tracker.startServer({ port: 3001 });
```

## 📋 Migration from Embedded Version

If you're currently using ThemeTracker embedded in your project:

### **Before (Embedded)**

```bash
npm run theme-tracker:start
```

### **After (Package)**

```bash
npm install -g themetracker
themetracker start
```

**Benefits:**

- ✅ Use in any project without copying files
- ✅ Automatic updates via npm
- ✅ Consistent experience across projects
- ✅ Enhanced features and better performance

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- 📦 [npm package](https://www.npmjs.com/package/themetracker)
- 🐛 [Report Issues](https://github.com/your-org/themetracker/issues)
- 📖 [Documentation](https://github.com/your-org/themetracker#readme)

---

**Ready to improve your theme coverage?**

```bash
npx themetracker start
```

**Watch your design system migration progress in real-time!** 🚀
