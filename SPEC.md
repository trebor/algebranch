# Software Specification: Algebranch 

## 1. Project Overview
Algebranch is an interactive algebraic manipulation system that lets users direct step-by-step derivations. Unlike typical computer algebra systems, which rely on black-box automatic simplification, Algebranch works through a transparent chain of simple steps. This builds understanding and lets users pursue specific goals, such as numerical stability or efficient computability.

## 2. Directory Structure & Modularity
The project is split into two packages:
*   `/math-engine`: A portable TypeScript/JavaScript library for the math logic, parsing, and validation. It must have no dependencies on the DOM, React, or Next.js.
*   `/ui`: The Next.js frontend application. It handles all user interactions, visual rendering, bounding box layouts, and application state. It imports the math engine directly and runs all solving and validation in the browser (see §4.3).

## 3. Technology Stack
**UI Layer (`/ui`)**
*   **Framework:** Next.js (React)
*   **State Management:** Jotai 
*   **Styling:** CSS/Tailwind 

**Math Engine Layer (`/math-engine`)**
*   **Parsing & Storage:** math.js 
*   **Validation Engine:** Handwritten Interval Arithmetic evaluator.

## 4. Core Architecture: The Math Engine (`/math-engine`)

### 4.1 Data Representation
The core data structure is the expression tree. The engine works entirely by manipulating this tree in memory.

### 4.2 Transform Validation (Identity Testing)
Rather than heavy symbolic implication testing, the engine validates moves by identity testing.
*   **Mechanism:** To check a move, the engine plugs numbers into the equation before and after the move and sees whether the equality still holds.
*   **Evaluator:** A custom interval-arithmetic engine. Interval evaluation can only prove an equation false, but it is far more flexible and general.
*   **Performance:** Checking the available moves should be fast enough to feel comfortably interactive, with no noticeable delay as the user works.

### 4.3 Deployment & Execution Model
The math engine is a pure, portable library that runs entirely in the browser. The deployed application is a static client with no backend solving service: the UI imports the engine directly and calls its entry points (`generateValidMoves`, `getReducibleOptions`, `areEquationsEquivalent`, `autoSimplify`) in process to compute the active/candidate, reducible, and target paths for each interaction.

Node IDs are preserved across each transform so the UI's FLIP (First-Last-Invert-Play) reflow animations stay stable.

## 5. Core Architecture: The UI Layer (`/ui`)

### 5.1 Rendering Strategy
The equation is rendered by mapping the expression tree directly to the DOM.
*   Each node (variable, constant, or operation) is rendered in its own bounding box, exposing the equation's recursive structure.

### 5.2 Sizing and Layout Auto-Scaler
A dynamic auto-scaler keeps equations readable and fit to their container:
*   **Measurement**: Temporarily resets the font size to `1em` to measure the equation's natural dimensions, then computes the scale ratio.
*   **Accessible Scale Cap**: Caps the maximum font scale at `2.8em` (44.8px) for fully loaded equations, allowing small equations to scale up and fill the screen space for dyslexic and learning-disabled students. During pre-analysis loading, the cap is set to `1.6em` to maintain visual stability.
*   **Relative em Units**: All component paddings, min-widths, and handles offsets use relative `em` units so they shrink and grow linearly with the calculated font size.
*   **Animation Settle Guard**: Measurements run again shortly after a change, once layout-altering transitions (such as the FLIP position animations) have finished, so the size settles correctly.

### 5.3 The "Two-Click" Interaction Model
Moves use the recursive tree structure instead of drag-based selection:
1.  **Click to Select:** The user clicks a node in the rendered tree to select it.
2.  **System Hinting:** On selection, the engine runs identity testing (see §4.2) to find where the term can validly go.
3.  **Visual Feedback:** Only valid destinations are highlighted and selectable.
4.  **Click to Place:** The user clicks a highlighted destination; the tree updates and re-renders.

## 6. Functional Requirements

*   **F1. Initial Parsing:** Accept a string formula and parse it into an interactive tree.
*   **F2. Within-Formula Moves:** Support rearranging terms within the same side of an equation, using identity testing to ensure the ancestor node's value remains unchanged.
*   **F3. Cross-Equation Moves:** Support moving terms across the equals sign, relying on the math engine to handle automatic changes in action, such as switching from addition to subtraction.
*   **F4. Multivalued Functions:** Provide a UI mechanism (e.g., a dropdown menu or direct edit) for the user to manually choose the sign when dealing with roots, as this cannot be easily resolved by structural moving alone.
*   **F5. Global Operations:** Provide UI buttons or commands to apply new operations to both sides of the equation simultaneously (e.g., "Square both sides").
*   **F6. Simplification Pass:** Implement an automated simplification routine that tries all pairs of terms and checks whether both can be eliminated using identity testing.

## 7. Test-Driven Development (TDD) Strategy
*   **Local Move Unit Tests:** Because the system evaluates discrete, known moves, each move gets a precise unit test. Correctness is encoded directly in these tests.
*   **Interval Evaluator Rigor:** The custom interval arithmetic engine must be tested against known false identities to ensure it reliably rejects invalid operations.

## 8. Nomenclature Framework
For consistency across rendering, interaction, state, and code, Algebranch defines five states for every node in the expression tree:

1.  **Candidate (Movable)**:
    *   *Semantics*: Interactive nodes that can be repositioned (moved to a different node in the AST).
    *   *Visuals (Idle)*: Bluish interior (`THEME_GLASS.CARD_CANDIDATE_SCAN`) and blue border.
    *   *Visuals (Active Selection)*: Fades to a black interior and default cursor (Static styling) if not part of the active selection/target path.
2.  **Source**:
    *   *Semantics*: The currently selected Candidate node undergoing transposition. At most one Source exists at a time.
    *   *Visuals*: Indigo/bluish interior (`THEME_GLASS.SOURCE`) with an indigo glow shadow.
3.  **Target (Destination)**:
    *   *Semantics*: Valid mathematical destination slots receptive to receiving the active **Source** node.
    *   *Visuals*: Emerald green interior (`THEME_GLASS.TARGET`) with a pulsing green shadow.
4.  **Static (Inert)**:
    *   *Semantics*: Inert terms that cannot be repositioned in the current state.
    *   *Visuals*: Black interior (`THEME_GLASS.STATIC`) and dark gray border to establish the stable visual landscape.
5.  **Simplify / Reducible (Transformable)**:
    *   *Semantics*: Nodes containing active constant folding, distribution, or identity simplification opportunities (displaying handles/buttons).
    *   *Visuals (Idle)*: Bluish interior (`THEME_GLASS.CARD_CANDIDATE_SCAN`) showing transformability.
    *   *Visuals (Active Selection)*: Transitioned to a black interior (Static styling) with `cursor-default` to keep the user focused solely on target transpositions. Handles are still clickable but node backgrounds do not compete with the green targets.
