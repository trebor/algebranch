# 🚀 Algebranch - Publishing Checklist

This checklist tracks high-level tasks, features, and refinements that need to be completed before publishing the Algebranch project.

---

## 📈 Current Progress Summary
* **Total Tasks**: 26
* **Completed**: 16
* **Remaining**: 10

---

## 🛠️ checklist

### 📐 1. Core Algebraic Engine & Deduplication
- [x] Implement point-evaluation and interval arithmetic equivalence engine.
- [x] Deduplicate sibling branches in history tree (avoid redundant calculations).
- [x] Standardize candidate/source/target nomenclature.
- [x] Filter out commutative & associative duplicates in simplify suggestions.
- [x] Implement context-aware mouse target cursor indicators.
- [x] Expand preset library to include multi-field stock equations (Physics, Science fields, complexity levels).
- [ ] Develop a mechanism for equation substitution / combining expressions (e.g. replacing E with m * c^2).
- [x] Think hard about parentheses in the AST (parsing, matching, formatting, and structural redundant stripping).

### 🎨 2. History Tree Layout & Loop UI
- [x] Render beautiful curved SVG S-bezier connection lines.
- [x] Design a centered 44px Loop Terminal Bubble with step-index badge and `∞` icon.
- [x] Symmetrical Synced Highlights (rose neon glows when hovering loop bubbles/ancestors).
- [x] Animated neon-rose electrical dashed flow lines on loop target hover.
- [x] Selection parent redirect (go back one step just before the loop to explore a new path).
- [x] Single Active Node Highlight Contrast (selected node glows indigo, parent steps are high-contrast black glass).
- [ ] Reevaluate where to navigate to in the history when a loop is detected.
- [ ] Change the color of the highlight in the history of the current/active item (currently feels too red/error-like).


### 🎬 3. Animations & Visual Node Polish
- [x] Synchronized Operator scale exit/entry transitions.
- [x] Bounding box layout-width adjustments (pop-free reflows).
- [x] Unified 350ms FLIP transition engine for all transpositions, reductions, and timeline jumps.
- [ ] Speculative preview transition finesses (optional - minor adjustments).
- [ ] Make square root (sqrt) and nthRoot expressions prettier with premium styling.
- [ ] Scale math expressions to fit their allotted screen spaces dynamically (for both active workspace and preview panels).
- [x] Cut off long numbers after the decimal point in floating point numbers (e.g. limit rendering of constants to 4 decimal places / format appropriately).

### 🌐 4. Local Persistence & URL Sharing
- [x] Use local storage to persist derivation history trees on the browser.
- [x] Symmetrically integrate Saved Workspaces Library into Left Sidebar with tab switcher.
- [x] Implement real-time URL state synchronization (sharing active equations easily via URL).
- [x] Design a premium "Share" button in the workspace to copy the shareable link to the clipboard.

### 🚀 5. Production Polish & Publishing Prep
- [ ] Multi-device responsive dashboard layouts (mobile/tablet check).
- [ ] Add a visual guide/interactive onboarding walkthrough for new users.
- [ ] Optimize serverless Vercel function cold starts and caching headers.
- [ ] Setup production SEO meta tags, descriptions, and custom OpenGraph sharing images.
- [ ] Run comprehensive final cross-browser manual audit (Safari, Chrome, Firefox).

---

> [!NOTE]  
> To add tasks to this list, simply ask me in chat (e.g., *"Add a task to set up analytics"* or *"Mark optimize serverless functions as complete"*), and I will update this file instantly and smoothly!
