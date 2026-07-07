# Thallo Technical Direction Notes

Thallo aims to become an open-source alternative to Typora: a smooth,
minimal, WYSIWYG-style Markdown editor for writing, reading, and publishing.
The planned application stack is Tauri 2, Vue 3, and TypeScript.

This document records early technical direction and trade-offs for future
development.

## Product Positioning

The central product question is whether Thallo should be Markdown-first or
WYSIWYG-first.

Markdown-first means the Markdown source text is the canonical document state.
The editor may render headings, links, images, formulas, and code blocks
inline, but the saved document should preserve the user's Markdown as much as
possible.

WYSIWYG-first means the editor's structured document model is the canonical
state. Markdown becomes an import/export or storage format. This can make rich
editing easier, but saved Markdown may be normalized and may not preserve every
source-level detail.

For a Typora-like editor, the recommended default direction is:

```text
Markdown-first, with localized WYSIWYG behavior.
```

However, if the project values polished rich editing more than exact source
preservation, a ProseMirror or Milkdown-based approach is also viable.

## Editor Core Options

### CodeMirror 6

CodeMirror 6 is the recommended conservative choice for a Markdown-first
architecture.

Advantages:

- Markdown source can remain the single source of truth.
- Strong extension system for commands, keymaps, decorations, widgets, syntax
  highlighting, and editor state.
- Better fit for preserving source formatting, unusual Markdown, comments,
  whitespace, and custom user style.
- Good foundation for progressively adding Typora-like inline rendering.

Challenges:

- WYSIWYG behavior must be built carefully with decorations and widgets.
- Cursor movement, selection, deletion, IME input, and undo behavior around
  hidden syntax markers and rendered widgets are difficult.
- Rich table editing is harder than in a structured document editor.

Possible approach:

- Keep Markdown text as canonical state.
- Use decorations to visually simplify Markdown syntax when the cursor is
  outside a range.
- Use widgets for formulas, images, diagrams, and other rendered blocks.
- When the cursor enters a rendered region, reveal the original Markdown source.

### ProseMirror / Milkdown

ProseMirror and Milkdown are stronger choices for a WYSIWYG-first architecture.
Milkdown is especially relevant because it builds Markdown-oriented editing on
top of ProseMirror.

Advantages:

- Mature document schema, transactions, plugins, selections, input rules, and
  node views.
- Rich text editing, tables, images, links, drag behavior, and block nodes are
  easier to model.
- Better fit for toolbar-driven editing and structured document operations.
- Faster path to a polished "product-like" editor.

Challenges:

- Markdown source round-tripping becomes more complex.
- Opening Markdown requires parsing into a structured document model.
- Saving Markdown requires serializing that model back to Markdown.
- Non-standard Markdown, HTML blocks, comments, unusual blank lines, reference
  links, table formatting, and user-specific formatting may be normalized or
  lost unless explicitly modeled.

This is acceptable if Thallo defines Markdown as a storage/export format rather
than a source-preserving editing format.

## Markdown Round-Trip Trade-Off

The round-trip concern is not only about switching between source mode and
rendered mode. It depends on which model is canonical.

If Markdown source is canonical:

```text
Markdown source -> rendered/editor view -> Markdown source
```

Loss is mostly limited to explicit conversion boundaries.

If a rich document AST is canonical:

```text
Markdown source -> document AST -> Markdown serialization
```

The editor may discard or normalize source details that do not exist in the
structured model.

Examples that may be hard to preserve:

- Extra blank lines and spacing style.
- HTML comments.
- HTML blocks.
- Reference link placement.
- Table alignment and source formatting.
- Escapes and unusual indentation.
- Non-standard Markdown syntax.
- Plugin-defined Markdown syntax.

If Thallo's plugin system does not focus on extending Markdown syntax, this risk
is much smaller. For plugins like PicGo image upload, export tools, file tools,
AI writing helpers, themes, and status bar actions, ProseMirror/Milkdown remains
a reasonable option.

## Markdown Parsing and Rendering

Recommended rendering pipeline:

- `remark-parse` for Markdown parsing.
- `remark-gfm` for GitHub Flavored Markdown.
- `remark-math` for math syntax.
- `remark-rehype` to convert Markdown AST to HTML AST.
- `rehype-katex` for formula output.
- `rehype-sanitize` to control unsafe HTML.
- `rehype-stringify` for HTML serialization.
- `shiki` for code highlighting and theme-aligned rendering.

`markdown-it` is also a strong alternative when speed, simplicity, and plugin
availability are more important than a unified AST pipeline.

## Formula Rendering

KaTeX is recommended as the default formula renderer.

Reasons:

- Fast enough for live rendering.
- Suitable for inline and block formula widgets.
- Good fit for editor interactions where only changed regions should be
  rerendered.

Suggested behavior:

- Inline math renders when the cursor is outside the formula.
- Block math renders as a widget when inactive.
- Entering a formula reveals the original source.
- Failed render should keep the source visible and show a lightweight error.
- Cache render results by source hash.

MathJax can be added later as an optional compatibility plugin for LaTeX
features unsupported by KaTeX.

## Plugin System Direction

The initial plugin system should avoid exposing unrestricted native or script
execution. Capabilities should be declared explicitly.

Suggested plugin layers:

### Editor Plugins

Contribute frontend editor behavior:

- Commands.
- Keybindings.
- Input rules.
- CodeMirror extensions or ProseMirror/Milkdown plugins.
- Toolbar actions.
- Status bar items.
- Sidebar panels.

### Markdown Pipeline Plugins

Contribute document processing behavior:

- remark plugins.
- rehype plugins.
- Export transformations.
- Diagram renderers.
- Optional Markdown syntax extensions.

This layer is only necessary if Thallo decides to support custom Markdown
syntax.

### Native Integration Plugins

Expose system capabilities through Tauri/Rust:

- PicGo-style image upload integration.
- File system tools.
- Git integration.
- Export tools such as Pandoc.
- Local services.
- Image processing.

Tauri 2 permissions and capabilities should be used to restrict native commands.
The frontend should not be able to invoke privileged commands unless the user or
application capability configuration allows them.

Example plugin manifest shape:

```json
{
  "id": "thallo-plugin-image-upload",
  "name": "Image Upload",
  "version": "0.1.0",
  "main": "dist/index.js",
  "contributes": {
    "commands": [],
    "editor": [],
    "views": ["settingsPanel"]
  },
  "permissions": {
    "fs": ["read-workspace"],
    "network": true
  }
}
```

## Theme System

Theme switching should be based on shared design tokens instead of isolated
component styles.

Recommended layers:

- Vue UI theme via CSS variables and Tailwind/shadcn-vue integration.
- Editor theme generated from the same tokens.
- Markdown preview theme using the same typography and color variables.
- Code highlighting theme aligned with the active light/dark theme.
- Print/export theme derived from the document theme.

Themes should cover:

- Background and foreground colors.
- Accent colors.
- Borders and selection colors.
- Editor typography.
- Markdown document typography.
- Code block style.
- Table, blockquote, task list, image, and formula styles.

User themes can be supported in two tiers:

- Simple JSON token themes.
- Advanced scoped CSS themes.

## Major Development Difficulties

### WYSIWYG Editing Model

The hardest part is making Markdown source feel like a rendered document without
breaking source editability.

Examples:

- Hide `**` markers when bold text is inactive.
- Reveal source when the cursor enters a formatted region.
- Render images, formulas, code blocks, and tables inline.
- Preserve correct copy, paste, delete, undo, and redo behavior.
- Avoid disrupting Chinese and other IME composition input.

### Cursor and Selection Behavior

Rendered widgets and hidden syntax markers make cursor behavior difficult.
Arrow keys, Backspace, Delete, Shift selection, mouse selection, and clipboard
operations must feel predictable.

### Markdown Fidelity

Preserving user-authored Markdown is difficult when using a structured document
model. This is less important if Thallo accepts Markdown normalization, but very
important if source fidelity is part of the product promise.

### Table Editing

Markdown table editing is a major feature on its own:

- Cell navigation.
- Insert/delete rows and columns.
- Alignment.
- Source formatting.
- Rendered editing view.
- Selection behavior.

This should probably be treated as a dedicated milestone.

### Live Rendering Performance

Formula rendering, diagrams, code highlighting, and image processing must avoid
full document rerenders.

Useful techniques:

- Incremental updates.
- Debouncing expensive renderers.
- Caching by source hash.
- Worker-based rendering for expensive diagrams.
- Virtualized rendering for large documents.

### Cross-Platform Desktop Details

Tauri is a strong fit, but WebView behavior varies across platforms.

Areas to test carefully:

- Windows WebView2.
- macOS WKWebView.
- Linux WebKitGTK.
- Font rendering.
- Clipboard behavior.
- Drag and drop.
- File dialogs.
- Native menus.
- Global shortcuts.
- IME behavior.
- Packaging, signing, and auto-update.

## Suggested Roadmap

### Stage 1: Reliable Markdown Editor

- Basic editor surface.
- Open/save Markdown files.
- Markdown preview.
- GFM support.
- Code highlighting.
- Basic theme switching.
- Basic settings.

### Stage 2: Typora-Like Local Rendering

- Inline heading, emphasis, link, and image rendering.
- KaTeX formula rendering.
- Code block rendering.
- Better cursor behavior around rendered regions.
- Autosave and recent files.

### Stage 3: Product Editing Features

- Table editing.
- Image paste and upload integration.
- PicGo-style plugin/integration.
- Command palette.
- File tree/workspace.
- Export HTML/PDF.

### Stage 4: Plugin and Theme Ecosystem

- Plugin manifest.
- Command/status/sidebar contributions.
- Permission model.
- User themes.
- Official plugin examples.
- Optional Markdown pipeline plugins.

## Current Recommendation

Start with a Markdown-first architecture unless the project explicitly decides
that Markdown normalization is acceptable.

The safest initial path is:

```text
Tauri 2 + Vue 3 + CodeMirror 6 + unified/remark/rehype + KaTeX + Shiki
```

If Thallo chooses a WYSIWYG-first direction, the strongest alternative is:

```text
Tauri 2 + Vue 3 + Milkdown/ProseMirror + Markdown import/export + KaTeX + Shiki
```

The key decision to revisit before implementing the core editor is:

```text
Should Thallo preserve Markdown source formatting, or is normalized Markdown
output acceptable after rich editing?
```
