# Quarto Variables Plugin for Obsidian

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/horaciochacon)

An Obsidian plugin that brings **live preview** of [Quarto variables](https://quarto.org/docs/authoring/variables.html) directly into your Obsidian vault. Perfect for academic writing, research documentation, and scientific publishing workflows.

> 💡 **What are Quarto Variables?** Quarto's [variable system](https://quarto.org/docs/authoring/variables.html) allows you to define reusable content in `_variables.yml` files and reference them throughout your documents using `{{< var key >}}` syntax. This plugin makes those variables visible in Obsidian's Live Preview mode.

## 🔗 Works Seamlessly With
- **[QMD as MD](https://github.com/danieltomasz/qmd-as-md-obsidian)** plugin: Essential companion for `.qmd` file support in Obsidian
- **Obsidian Live Preview**: Variables appear instantly as you type and scroll
- **Multi-project workflows**: Supports multiple Quarto projects in one vault

## ✨ Features

- **🔄 Live Preview Integration**: Variables appear instantly in Obsidian's Live Preview mode
- **⚡ High Performance**: Optimized scrolling with zero-delay updates for large documents  
- **🔥 Hot Reload**: Automatically updates when you modify `_variables.yml` files
- **🎯 Cursor-Aware Editing**: Raw `{{< var key >}}` syntax appears when cursor is positioned over variables
- **📚 Multi-Project Support**: Handle multiple Quarto projects within a single Obsidian vault
- **👁️ Reading View**: Optional variable replacement in Obsidian's Reading mode
- **🛡️ Robust Error Handling**: Graceful handling of missing variables and YAML syntax errors
- **🧠 Smart Caching**: Intelligent variable caching for optimal performance

## 📦 Installation

### From Obsidian Community Plugins (Coming Soon)

1. Open Obsidian Settings (`Ctrl/Cmd + ,`)
2. Go to **Community Plugins** and disable **Safe Mode** if enabled
3. Click **Browse** and search for "Quarto Variables"
4. Click **Install** and then **Enable**

### Manual Installation (Current)

1. Download the latest release from the [releases page](https://github.com/horaciochacon/obsidian-quarto-variables/releases)
2. Extract the files to your vault's plugins folder: 
   ```
   YourVault/.obsidian/plugins/quarto-variables/
   ```
3. Reload Obsidian (`Ctrl/Cmd + R`) and enable the plugin in **Settings > Community Plugins**

### Prerequisites

- **Obsidian**: Version 1.5.0 or higher
- **[QMD as MD](https://github.com/danieltomasz/qmd-as-md-obsidian)** plugin (recommended): For proper `.qmd` file syntax highlighting and editing support

### Development Installation

```bash
git clone https://github.com/horaciochacon/obsidian-quarto-variables.git
cd obsidian-quarto-variables
npm install
npm run build
```

Then copy `main.js`, `styles.css`, and `manifest.json` to your vault's plugins folder.

## 🚀 Usage

### Setting Up Your Obsidian Vault

Create Quarto projects within your Obsidian vault with this structure:

```
Your Obsidian Vault/
├── Research Project/
│   ├── _quarto.yml          # Quarto project configuration
│   ├── _variables.yml       # Your variables definition
│   ├── manuscript.qmd       # Main document
│   └── chapters/
│       ├── introduction.qmd
│       └── methods.qmd
└── Another Project/
    ├── _quarto.yml
    ├── _variables.yml
    └── report.qmd
```

### 1. Create Your Variables File

In your project folder, create a `_variables.yml` file following [Quarto's variable syntax](https://quarto.org/docs/authoring/variables.html):

```yaml
# _variables.yml
author: "Dr. Jane Smith"
institution: "University of Research"
year: 2024
project:
  name: "My Research Project"
  version: "1.0.0"
  funding: "NSF Grant #12345"

stats:
  participants: 150
  response_rate: 0.87
  study_duration: "6 months"
```

### 2. Use Variables in Your QMD Files

In your `.qmd` files, use the standard [Quarto variable syntax](https://quarto.org/docs/authoring/variables.html):

```markdown
---
title: "{{< var project.name >}}"
author: "{{< var author >}} ({{< var institution >}})"
date: "{{< var year >}}"
---

# Introduction

This {{< var study_duration >}} study was conducted in {{< var year >}} by {{< var author >}}.

We recruited {{< var stats.participants >}} participants and achieved a {{< var stats.response_rate >}} response rate.

*Funding: {{< var project.funding >}}*
```

### 3. See Variables in Live Preview

- **In Live Preview**: Variables show their resolved values automatically
- **When editing**: Place cursor over a variable to see the raw `{{< var key >}}` syntax  
- **Auto-updates**: Changes to `_variables.yml` appear instantly in all documents

## ⚙️ Configuration

Access plugin settings in **Settings > Community Plugins > Quarto Variables**:

- **📖 Enable in Reading View**: Show variable replacements in Reading mode
- **🔍 Highlight Unresolved Variables**: Red underline for missing variables
- **🎨 Placeholder Styling**: Customize variable appearance
- **⏱️ Cache Settings**: Control variable caching behavior
- **🐛 Debug Mode**: Enable console logging for troubleshooting

## 📋 Available Commands

Access these via Command Palette (`Ctrl/Cmd + P`):

- **Refresh Quarto Variables**: Manually refresh all cached variables
- **Toggle Highlight Unresolved**: Toggle highlighting of missing variables

## 🧠 How Variables Work

Variables support nested structures using dot notation (following [Quarto's standard](https://quarto.org/docs/authoring/variables.html)):

```yaml
# _variables.yml  
title: "My Research"
author:
  name: "Dr. Smith" 
  email: "smith@university.edu"
stats:
  n_participants: 150
  effect_size: 0.87
```

```markdown
Title: {{< var title >}}                    <!-- "My Research" -->
Author: {{< var author.name >}}             <!-- "Dr. Smith" -->
Contact: {{< var author.email >}}           <!-- "smith@university.edu" -->
Sample: {{< var stats.n_participants >}}    <!-- "150" -->
```

## 🔧 Compatibility

- **Obsidian**: 1.5.0+ (Desktop only)
- **[QMD as MD](https://github.com/danieltomasz/qmd-as-md-obsidian)**: Recommended for `.qmd` syntax highlighting
- **Live Preview**: Required for real-time variable display
- **Reading View**: Optional variable replacement available

## 🎯 Performance

Optimized for large documents and many variables:
- **⚡ Zero-delay updates** when variables are cached
- **🔄 Smart scrolling** with 100ms debouncing for uncached content  
- **💾 Intelligent caching** with automatic cleanup
- **👀 Viewport-only processing** for memory efficiency

## ❓ Troubleshooting

### Variables Not Showing?
1. Ensure you have a `_quarto.yml` file in your project root
2. Check that `_variables.yml` is in the same folder as `_quarto.yml`
3. Verify YAML syntax is valid
4. Try the "Refresh Quarto Variables" command

### Performance Issues?
1. Enable Debug Mode in settings to check console for errors
2. Use "Refresh Quarto Variables" command to clear cache
3. Check that variable names use valid syntax (letters, numbers, dots, underscores only)

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests  
4. Ensure all tests pass: `npm test`
5. Submit a pull request

### Development Setup
```bash
git clone https://github.com/horaciochacon/obsidian-quarto-variables.git
cd obsidian-quarto-variables
npm install
npm run dev     # Development build with hot reload
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support & Donations

If this plugin helps your workflow, consider supporting its development:

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/horaciochacon)

### Get Help

- [GitHub Issues](https://github.com/horaciochacon/obsidian-quarto-variables/issues) - Bug reports and feature requests
- [Obsidian Community Forum](https://forum.obsidian.md/) - General discussion and help

### Show Your Support

- ⭐ Star this repository on GitHub
- ☕ [Buy me a coffee](https://ko-fi.com/horaciochacon) to support development
- 🐛 Report bugs and suggest features via GitHub Issues
- 📖 Help improve documentation

---

This plugin is not affiliated with Posit PBC (makers of Quarto) or Obsidian. It's an independent community project designed to improve the Quarto + Obsidian workflow.