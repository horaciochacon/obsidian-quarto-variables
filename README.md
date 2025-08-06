# Quarto Variables Plugin for Obsidian

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/horaciochacon)

Live preview of Quarto variables from `_variables.yml` in your `.qmd` files directly within Obsidian.

> 💡 **New to Quarto?** [Quarto](https://quarto.org) is an open-source scientific and technical publishing system built on Pandoc. This plugin brings Quarto's variable system to Obsidian for seamless academic writing.

## Features

- **Live Preview**: See variable values in real-time while editing `.qmd` files
- **Hot Reload**: Automatically updates when `_variables.yml` changes
- **Multi-Project Support**: Works with multiple Quarto projects in the same vault
- **Reading View Support**: Optional variable replacement in Reading mode
- **Cursor-Aware**: Shows raw tokens when cursor is over them for easy editing
- **Performance Optimized**: Viewport-only processing for large documents
- **Error Handling**: Graceful handling of missing variables and YAML errors

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Quarto Variables"
4. Install and enable the plugin

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/horaciochacon/obsidian-quarto-variables/releases)
2. Extract the files to your vault's plugins folder: `VaultFolder/.obsidian/plugins/quarto-variables/`
3. Reload Obsidian and enable the plugin in Settings > Community Plugins

### Development Installation

```bash
git clone https://github.com/horaciochacon/obsidian-quarto-variables.git
cd obsidian-quarto-variables
npm install
npm run build
```

Then copy `main.js`, `styles.css`, and `manifest.json` to your vault's plugins folder.

## Usage

### Basic Setup

1. Create a `_quarto.yml` file in your project root
2. Create a `_variables.yml` file in the same directory
3. Define your variables in YAML format:

```yaml
# _variables.yml
author: "Dr. Jane Smith"
year: 2024
project:
  name: "My Research Project"
  version: "1.0.0"

stats:
  participants: 150
  response_rate: 0.87
```

### Using Variables in QMD Files

Use the standard Quarto variable syntax in your `.qmd` files:

```markdown
---
title: "{{<var project.name>}}"
author: "{{<var author>}}"
---

# Introduction

This study was conducted in {{<var year>}} by {{<var author>}}.

We had {{<var stats.participants>}} participants with a {{<var stats.response_rate>}} response rate.
```

### Live Preview

When you open a `.qmd` file in Obsidian's Live Preview mode, the plugin will:

1. Find the nearest `_quarto.yml` file by walking up the directory tree
2. Load variables from the corresponding `_variables.yml` file
3. Replace `{{<var key>}}` placeholders with their values in real-time
4. Update automatically when you modify `_variables.yml`

### Cursor Editing

When you place your cursor inside a variable placeholder, it temporarily shows the raw `{{<var key>}}` syntax so you can edit it easily.

## Settings

Access settings via Settings > Quarto Variables:

- **Enable in Reading View**: Show variable replacements in Reading mode
- **Highlight Unresolved Variables**: Add red wavy underline for missing variables
- **Placeholder CSS Class**: Custom CSS class for styled variables
- **Placeholder Color**: Color for resolved variable values
- **Cache TTL**: How long to cache loaded variables (milliseconds)
- **Debug Mode**: Enable console logging for troubleshooting

## Project Structure

The plugin supports multiple Quarto projects within a single Obsidian vault:

```
vault/
├── project-a/
│   ├── _quarto.yml
│   ├── _variables.yml
│   └── chapter1.qmd
└── project-b/
    ├── _quarto.yml
    ├── _variables.yml
    └── report.qmd
```

Each `.qmd` file will use variables from its closest parent project.

## Commands

- **Refresh Quarto Variables**: Manually refresh all cached variables
- **Toggle Highlight Unresolved**: Toggle highlighting of missing variables

## Variable Resolution

Variables are resolved using dot notation:

```yaml
# _variables.yml
simple: "value"
nested:
  level1:
    level2: "deep value"
```

```markdown
Simple: {{<var simple>}}           <!-- "value" -->
Nested: {{<var nested.level1.level2>}}  <!-- "deep value" -->
```

### Supported Data Types

All YAML data types are converted to strings:

- Strings: `"hello"` → `hello`
- Numbers: `42` → `42`
- Booleans: `true` → `true`
- Arrays: `[1, 2, 3]` → `1,2,3`

## Performance

The plugin is optimized for performance:

- **Viewport-only processing**: Only processes visible text
- **Debounced updates**: Batches rapid changes
- **Regex caching**: Compiled patterns for fast matching
- **Memory limit**: <2MB per editor instance
- **Target performance**: <5ms per 1,000 lines

## Error Handling

### Missing Variables

Unresolved variables can be:
- Left as-is (default behavior)
- Highlighted with red wavy underline (configurable)

### YAML Errors

- Malformed YAML shows a one-time notification
- Plugin continues to work with cached data
- Errors logged to console in debug mode

### Missing Files

- Missing `_variables.yml` files are handled gracefully
- One-time notification shown per project
- Plugin continues to work without variables

## Compatibility

- **Obsidian**: v1.5.0+
- **qmd-as-md Plugin**: Fully compatible
- **CodeMirror 6**: Uses latest APIs
- **Platforms**: Desktop only (uses Node.js APIs)

## Development

### Setup

```bash
git clone https://github.com/horaciochacon/obsidian-quarto-variables.git
cd obsidian-quarto-variables
npm install
```

### Commands

```bash
npm run dev     # Development build with hot reload
npm run build   # Production build  
npm run test    # Run unit tests
```

### Testing

The plugin includes comprehensive tests:

- Unit tests for core modules
- Integration tests with example vault
- Performance benchmarks
- Mock Obsidian API

Run tests with: `npm test`

### Architecture

```
src/
├── main.ts                    # Plugin entry point
├── modules/
│   ├── ProjectResolver.ts     # Find Quarto projects  
│   ├── VariableCache.ts       # Load and cache YAML
│   ├── PlaceholderScanner.ts  # Regex pattern matching
│   ├── VariableWidget.ts      # CodeMirror widget
│   ├── PlaceholderRenderer.ts # Live Preview rendering
│   └── ReadingPostProcessor.ts # Reading mode support
├── settings/
│   └── SettingsTab.ts         # Configuration UI
└── types/
    └── index.ts               # TypeScript definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass: `npm test`
5. Submit a pull request

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