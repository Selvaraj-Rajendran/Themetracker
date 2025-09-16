# 🤖 ThemeTracker MCP Integration

**Revolutionary AI-powered theme violation detection and automated fixes!**

ThemeTracker now supports **Model Context Protocol (MCP)** integration, enabling AI assistants like Cursor and GitHub Copilot to access real-time theme violations and provide intelligent fix suggestions.

## 🚀 What This Enables

### **Real-time AI Code Assistance**

- **Proactive Violation Detection**: AI detects theme violations as you type
- **Intelligent Fix Suggestions**: AI suggests design system compliant alternatives
- **Automated Refactoring**: Bulk fix theme violations with AI assistance
- **Design System Context**: AI understands your specific design tokens and patterns

### **Seamless Workflow Integration**

```javascript
// ❌ You type this:
const Button = styled.button`
  background: #ffffff;
  margin: 16px;
`;

// 🤖 AI immediately suggests:
const Button = styled.button`
  background: var(--color-fill-surface);
  margin: var(--spacing-200);
`;
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Cursor / AI Assistant                   │
├─────────────────────────────────────────────────────────────┤
│                    MCP Protocol Layer                      │
├─────────────────────────────────────────────────────────────┤
│                  ThemeTracker MCP Server                   │
│  ┌─────────────────┬─────────────────┬─────────────────────┐│
│  │   Resources     │     Tools       │     Analysis        ││
│  │                 │                 │                     ││
│  │ • Violations    │ • analyze_file  │ • Audit Engine     ││
│  │ • Patterns      │ • get_fixes     │ • Dashboard Engine  ││
│  │ • Config        │ • validate_code │ • Config Loader    ││
│  └─────────────────┴─────────────────┴─────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    Your Project Files                      │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Setup & Installation

### **1. Install MCP Dependencies**

```bash
# Install ThemeTracker with MCP support
npm install -g themetracker

# Install MCP SDK (optional dependency)
npm install @modelcontextprotocol/sdk
```

### **2. Start MCP Server**

```bash
# In your project directory
cd /your-react-project
themetracker mcp
```

Output:

```
🎨 ThemeTracker v1.0.5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔌 Starting ThemeTracker MCP Server...
📂 Project: my-react-app
🎯 MCP Server ready for AI integration

💡 To integrate with Cursor:
   Add this to your Cursor settings:
   {
     "mcpServers": {
       "themetracker": {
         "command": "npx",
         "args": ["themetracker", "mcp"],
         "cwd": "/your-react-project"
       }
     }
   }
```

### **3. Configure Cursor Integration**

#### **Option A: Global Cursor Settings**

Add to `~/.cursor/config.json`:

```json
{
  "mcpServers": {
    "themetracker": {
      "command": "npx",
      "args": ["themetracker", "mcp"]
    }
  }
}
```

#### **Option B: Workspace Settings**

Add to `.cursor/config.json` in your project:

```json
{
  "mcpServers": {
    "themetracker": {
      "command": "npx",
      "args": ["themetracker", "mcp"],
      "cwd": "."
    }
  }
}
```

## 🎯 MCP Capabilities

### **Resources** (Data AI can access)

#### **📊 `themetracker://violations`**

Real-time project-wide theme violations:

```json
{
  "summary": {
    "totalFiles": 127,
    "totalViolations": 234,
    "averageCoverage": 73.2
  },
  "violationsByType": {
    "hardcoded-color": 89,
    "tailwind-color": 45,
    "hardcoded-spacing": 78
  },
  "recommendations": [...]
}
```

#### **🎨 `themetracker://patterns`**

Design system patterns and tokens:

```json
{
  "designSystem": {
  "name": "Design Token System",
    "cssVariablePrefix": "--"
  },
  "approvedPatterns": {
    "colors": ["var(--color-*)", "--color-fill*"],
    "spacing": ["var(--spacing-*)", "--border-radius*"
  },
  "examples": [
    {
      "violation": "background: #ffffff",
      "fix": "background: var(--color-fill-surface)",
      "explanation": "Use design system color tokens"
    }
  ]
}
```

### **Tools** (Actions AI can perform)

#### **🔍 `analyze_file`**

Analyze theme violations in specific files:

```javascript
// AI can call this on any file you're editing
const analysis = await mcp.callTool("analyze_file", {
  filePath: "src/components/Button.jsx",
  content: fileContent, // optional
});
```

#### **💡 `get_fix_suggestions`**

Get detailed fix suggestions:

```javascript
const fixes = await mcp.callTool("get_fix_suggestions", {
  filePath: "src/components/Button.jsx",
  lineNumber: 15,
  violationType: "hardcoded-color",
});
```

#### **✅ `validate_code`**

Validate code compliance:

```javascript
const isValid = await mcp.callTool("validate_code", {
  code: "background: var(--color-fill-surface)",
  fileType: "jsx",
});
```

## 🎬 Usage Examples

### **Example 1: Real-time Violation Detection**

**You write:**

```jsx
const Card = () => (
  <div
    style={{
      background: "#ffffff",
      padding: "16px",
      borderRadius: "8px",
    }}
  >
    Content
  </div>
);
```

**AI immediately suggests:**

```jsx
const Card = () => (
  <div
    style={{
      background: "var(--color-fill-surface)",
      padding: "var(--spacing-200)",
      borderRadius: "var(--border-radius-medium)",
    }}
  >
    Content
  </div>
);
```

### **Example 2: Batch Refactoring**

**AI Message:** "I found 15 theme violations in this file. Would you like me to fix them all?"

**AI Action:**

1. Calls `analyze_file` to get all violations
2. Calls `get_fix_suggestions` for each violation
3. Applies all fixes automatically
4. Calls `validate_code` to verify compliance

### **Example 3: Smart Context Awareness**

**You ask:** _"How should I style this button component to match our design system?"_

**AI Response:**

> Based on your ThemeTracker analysis, I can see you're using a design token system. Here's the recommended approach:
>
> ```jsx
> const Button = styled.button`
>   background: var(--color-fill-brand);
>   color: var(--color-text-primary);
>   padding: var(--spacing-100) var(--spacing-200);
>   border-radius: var(--border-radius-small);
>   border: none;
> `;
> ```
>
> This follows your project's design system patterns and will give you 100% theme compliance.

## 🔧 Advanced Configuration

### **Custom MCP Server Options**

```bash
# Start with custom options
THEMETRACKER_DEBUG=1 themetracker mcp

# Or with specific config
themetracker mcp --config custom-config.js
```

### **Integration with Multiple AI Tools**

```json
{
  "mcpServers": {
    "themetracker": {
      "command": "npx",
      "args": ["themetracker", "mcp"],
      "capabilities": [
        "theme-analysis",
        "design-system-validation",
        "automated-fixes"
      ]
    }
  }
}
```

## 🎯 AI Prompts & Workflows

### **Effective AI Prompts**

#### **For Code Review:**

```
"Please analyze this component for theme violations using ThemeTracker and suggest improvements for design system compliance."
```

#### **For Refactoring:**

```
"Convert all hardcoded colors and spacing in this file to use our design token system tokens."
```

#### **For New Development:**

```
"Help me build a card component that follows our design system patterns. Use ThemeTracker to ensure 100% compliance."
```

### **Workflow Integration**

#### **1. Development Flow**

```
Write Code → AI Detects Violations → AI Suggests Fixes → Apply → Validate
```

#### **2. Code Review Flow**

```
PR Created → AI Reviews Theme Compliance → AI Comments on Violations → Developer Fixes
```

#### **3. Migration Flow**

```
Legacy Component → AI Analyzes Patterns → AI Suggests Migration → Bulk Apply → Verify
```

## 🚀 Benefits

### **For Developers**

- ✅ **Instant Feedback**: Know about violations as you type
- ✅ **Automated Fixes**: Let AI handle repetitive theme updates
- ✅ **Learning Aid**: Understand design system patterns through AI explanations
- ✅ **Consistency**: Ensure all team members follow design system guidelines

### **For Teams**

- ✅ **Faster Migration**: AI-assisted migration from legacy themes
- ✅ **Better Compliance**: Automatic adherence to design system
- ✅ **Reduced Review Time**: AI catches theme issues before PR review
- ✅ **Knowledge Sharing**: AI teaches design system best practices

### **For Design Systems**

- ✅ **Adoption Tracking**: Real-time metrics on design system usage
- ✅ **Pattern Analysis**: Understand how tokens are being used
- ✅ **Violation Insights**: Identify common migration challenges
- ✅ **Automated Governance**: Enforce design system compliance automatically

## 🔍 Troubleshooting

### **Common Issues**

#### **MCP Server Won't Start**

```bash
# Check dependencies
npm list @modelcontextprotocol/sdk

# Reinstall if needed
npm install @modelcontextprotocol/sdk

# Try with debug mode
DEBUG=1 themetracker mcp
```

#### **Cursor Can't Connect**

1. Verify MCP server is running: `themetracker mcp`
2. Check Cursor settings configuration
3. Restart Cursor after configuration changes
4. Check console for connection errors

#### **No Violations Detected**

1. Ensure ThemeTracker config is properly set up
2. Check if files are being ignored by ThemeTracker
3. Verify design tokens are loaded: `themetracker info`

### **Debug Mode**

```bash
# Start with detailed logging
DEBUG=mcp:* themetracker mcp

# Check ThemeTracker configuration
themetracker info

# Test analysis manually
themetracker start
# Then check dashboard at http://localhost:3001
```

## 🎉 What's Next?

This MCP integration opens up incredible possibilities:

### **Planned Enhancements**

- 🔄 **Auto-fix on Save**: Automatically fix violations when files are saved
- 📊 **AI Analytics**: AI-powered insights into design system adoption
- 🎨 **Visual Diff**: AI-generated before/after visual comparisons
- 🔍 **Smart Suggestions**: Context-aware recommendations based on component type
- 📱 **Cross-Platform**: Support for React Native, Vue, Angular

### **Community Features**

- 🤝 **Shared Patterns**: Community-driven design system patterns
- 📖 **AI Documentation**: AI-generated design system documentation
- 🎓 **Learning Mode**: AI tutoring for design system best practices

## 🤝 Contributing

The MCP integration is just the beginning! Help us build the future of AI-powered design systems:

1. **Test the Integration**: Try it with your projects and share feedback
2. **Suggest Features**: What AI capabilities would help your workflow?
3. **Report Issues**: Help us improve the MCP server implementation
4. **Share Patterns**: Contribute design system patterns for AI training

---

**Ready to supercharge your design system workflow with AI?**

```bash
npm install -g themetracker
cd your-project
themetracker mcp
```

**Experience the future of theme development today!** 🚀🤖
