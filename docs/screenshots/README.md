# README screenshots

The hero image in the top-level `README.md` (`hero.png`) is generated, not hand-cropped. This note records how to refresh it as the app evolves. Producing it has two halves: **building the scene** (creative, done by hand in the running app) and **capturing it** (mechanical, done by `scripts/shoot-hero.mjs`).

## What makes a good hero

The hero should look like *a lot is going on*, while the focused equation stays legible. The current one combines, in a single frame:

- A **graphable** equation — exactly one variable, so the live graph renders.
- **Trig + a radical** — `sin` gives the graph a wave; `sqrt` gives the equation visual texture.
- A **branching history tree** with a fork and a warning badge (squaring both sides of a radical equation surfaces the extraneous-root warning).
- A **loop (∞) bubble** — when a move lands back on an equation canonically equal to an earlier step, the tree draws a fuchsia "loop back to step N" bubble. The saved scene already contains one (a transpose branch returns to the initial state), so it comes for free; no special action needed.
- The full set of **colored handles**: move (emerald targets), simplify (amber), substitute (teal).
- An open **detail tooltip** on the active node, showing the step's rendered equation.

## Part A — build the scene (in the running app)

1. Start the dev server (`npm run dev`) and clear local state for a clean slate: in the browser console, `localStorage.clear()`.
2. Load a graphable, wavy equation, e.g. `2*sin(x)+1 = sqrt(x+4)` via `?eq=`.
3. Make several moves to grow the history; **square both sides** (→ warning), and **revisit an earlier step and take a different move** (→ a fork). To seed a **loop bubble**, on one branch make a move that returns to an earlier equation (e.g. transpose a term across `=` and back). Leave it parked on a rich-looking step.
4. **Share → Workspace** to copy the `?ws=…` link.

### The substitution (teal) caveat

Substitution handles only appear when a variable is **defined in another tab** (e.g. a `x = sqrt(5)` tab), and the graph only renders when the active equation has **exactly one variable**. Those two facts are why the fact lives in a *separate* tab. But the `?ws=` link serializes **only the active tab's history** — so the fact tab does *not* travel in the link. The capture script recreates it (see below); you don't need to include it when sharing.

## Part B — capture it

Pass the link to the script. To avoid shell-mangling a ~1.5 KB blob, write it to a file first and use `--ws-file`:

```sh
# dev server must be running
printf '%s' '<paste the ?ws= link>' > screenshots/ws_url.txt
npm run shoot:hero -- --ws-file screenshots/ws_url.txt --fact "x = sqrt(5)" \
  --graph --select-leftmost --hover-node active --out docs/screenshots/hero.png
```

The script (`scripts/shoot-hero.mjs`, fully commented):

1. Serializes an `x = sqrt(5)` fact tab, then loads your workspace, then **merges the fact tab into the workspace** via `localStorage` and reloads — so the teal substitution handles and the "Substitutions" strip appear.
2. Suppresses the onboarding overlay and the **cookie-consent banner** (both would otherwise occlude the frame).
3. **Opens the graph** if `--graph` is passed (the `g` shortcut; it always loads closed since graph state isn't in the share link).
4. **`--select-leftmost`** clicks the leftmost branch's node so its equation fills the canvas; **`--hover-node active`** then parks that node's detail tooltip open. (`--hover-node` also takes `loop` for the ∞ bubble's "Loop Detected" card, or `leftmost`.)
5. Writes a 2× (retina) PNG.

Drop `--fact` if you don't want substitution handles; drop `--graph` to leave the graph closed; drop `--select-leftmost`/`--hover-node` to capture the scene as-parked.

> All node queries are scoped to the history panel (`[aria-label="Derivation history"]`) — the equation reader *also* exposes `role="treeitem"`, so an unscoped selector would pick canvas terms instead of history nodes.

## The social preview

`ui/public/social-preview.png` (the Open Graph / link-unfurl card) embeds `hero.png` inside a browser mockup defined in `ui/public/social-preview.html`. After refreshing `hero.png`, rebuild the composite:

```sh
npm run build-social-preview
```

> Keep `hero.png` reasonably sized (it ships in the repo). The current capture is ~380 KB at 1440×900 @2×.
