# PagePin

**[中文文档](README.zh-CN.md)** | **[User Manual](manual.md)** | **[Changelog](CHANGELOG.md)**

A Chrome / Edge extension for adding element-level text annotations to any HTML page in the browser, then exporting a self-contained annotated HTML file that anyone can open and review — no extension required.

## Why

What product managers deliver is changing. Prototypes from traditional tools (Axure, Mockplus, and the like) used to carry element-level remarks built in — a developer could click a button in the prototype and read its requirement note right there, in context. See it, read it — understanding requirements was fast.

Increasingly, though, the deliverable is a **static HTML prototype plus a separate PRD**. The page only shows what things look like; the requirements live in another document. So when developers and testers read the page, they have to constantly map "this element on the page" to "the paragraph in the PRD that describes it." The remarks that used to sit on the elements are gone, and the cost of understanding quietly goes up.

PagePin pins the remarks back where they belong — **attached directly to the page element, readable in place**.

**Principles:**

- **Remarks stay with the element** — annotate what you see; notes are pinned to concrete elements instead of scattered across a separate document.
- **Zero friction, non-invasive** — works on any HTML regardless of where the prototype came from; no server, no account; the source page's semantics are left untouched.
- **The deliverable stays a single portable file** — export one self-contained annotated HTML that anyone can open without installing anything, fitting the "HTML + PRD" handoff habit.

**Who it helps:**

- **Developers, testers, and reviewers** — read element-level remarks directly on the HTML prototype, without the back-and-forth between page and PRD.
- **Product managers / requirement owners** — pin notes onto the HTML without going back to the prototyping tool, and share a single annotated file.

## Features

- **Element picker** — DevTools-style hover-to-highlight, click to annotate
- **Numbered icons** — each annotation shows a sequence number on its target element; numbers auto-fill after deletion
- **Annotation list** — side panel with locate (scroll + highlight), edit, and delete per entry
- **Auto-save** — annotations persist in local browser storage keyed by page URL; they survive navigation and reloads, restore automatically when the page is reopened, and clear after a successful export
- **Dynamic page support** — MutationObserver keeps icons in sync when the page DOM changes; CSS-selector snapshot re-binds annotations after popup elements are destroyed and recreated
- **Draggable UI** — toolbar and viewer bar can be repositioned by their pushpin icon, and the annotation list by its header, to avoid blocking page content
- **One-click export** — downloads a single `.annotated.html` file with all data and the viewer script embedded
- **Viewer built in** — exported files show numbered icons, single-annotation popups, and a full annotation list with locate + highlight, all without the extension

## Install

1. Clone or download this repository.
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project root directory.
5. For local `file://` HTML files, open the extension details and enable **Allow access to file URLs**.

## Quick Start

1. Open any HTML page in the browser.
2. Click the PagePin extension icon → floating menu appears.
3. Click **开始批注** → hover to highlight → click an element → type your remark → **保存**.
4. Click **导出 HTML** → save the `.annotated.html` file.
5. Open the exported file in any browser to review annotations.

> Annotations are saved automatically to local browser storage keyed by page URL: accidental navigation or reloads won't lose them — reopen the page and they are restored automatically (on other http(s) pages, click the extension icon to restore). They are cleared after a successful export.

For full instructions, see the **[User Manual](manual.md)** ([中文](manual.zh-CN.md)).

## Screenshots

Adding annotations:

![Adding annotations](添加批注.png)

Viewing annotations in an exported page:

![Viewing annotations in an exported page](导出的页面查看批注.png)

## Browser Support

- Chrome 88+
- Edge 88+ (Chromium-based)

## License

[MIT](LICENSE)
