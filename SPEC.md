# Software Specification: Algebranch 

## 1. Project Overview
Algebranch is an interactive algebraic manipulation system designed to allow users to direct step-by-step mathematical derivations. Unlike typical computer algebra systems that rely on black-box automatic simplification, Algebranch focuses on user interaction to provide a transparent chain of simple steps. This approach enhances user understanding and provides the flexibility to pursue specific mathematical goals, such as numerical stability or efficient computability.

## 2. Directory Structure & Modularity
To ensure high testability and future portability, the project will be strictly divided into two distinct subdirectories:
*   `/math-engine`: A pure, portable TypeScript/JavaScript library containing the mathematical logic, parsing, and validation routines. It must have zero dependencies on the DOM, React, or Next.js.
*   `/ui`: The Next.js frontend application that imports the math engine. It handles all user interactions, visual rendering, bounding box layouts, and application state.

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
The fundamental data structure is the Expression Tree. A typical equation is assumed to have roughly 100 nodes in its expression tree. The math engine operates entirely by manipulating this tree in memory.

### 4.2 Transform Validation (Identity Testing)
Instead of relying on computationally heavy symbolic implication testing, the engine will validate moves via identity testing. 
*   **Mechanism:** To check if a proposed move is valid, the engine will plug numbers into the equation's state before and after the move to see if the formula holds. 
*   **Evaluator:** This testing will be implemented using a custom interval arithmetic engine. While interval evaluation can only prove that an equation is false, it offers massive benefits in flexibility and generality.
*   **Performance Target:** The validation engine must be capable of checking dozens of locations at once in real time (taking around 10 ms per location check) to ensure no UI lag during user interactions. 

## 5. Core Architecture: The UI Layer (`/ui`)

### 5.1 Rendering Strategy
The equation will be rendered via a direct mapping of the math engine's expression tree to the DOM. 
*   Each node (variables, constants, operations) will be rendered within its own distinct bounding box, visually exposing the recursive structure of the equation.

### 5.2 Sizing and Layout Auto-Scaler
To ensure equations fit perfectly inside their container and are highly readable, a dynamic auto-scaler is used:
*   **Measurement**: Resets the font size temporarily to `1em` to measure the true, natural scroll dimensions of the equation in the DOM, then computes the optimal scale ratio.
*   **Accessible Scale Cap**: Caps the maximum font scale at `2.8em` (44.8px) for fully loaded equations, allowing small equations to scale up and fill the screen space for dyslexic and learning-disabled students. During pre-analysis loading, the cap is set to `1.6em` to maintain visual stability.
*   **Relative em Units**: All component paddings, min-widths, and handles offsets use relative `em` units so they shrink and grow linearly with the calculated font size.
*   **Animation Settle Guard**: Sized measurements are automatically run again 380ms after changes to ensure that all layout-altering transitions (such as 350ms FLIP position animations) have fully ended, preventing race conditions from locking the equation to a shrunken size.

### 5.3 The "Two-Click" Interaction Model
The primary method of manipulating the equation relies on the recursive structure to avoid standard drag-based selection, which can be time-consuming:
1.  **Click to Select:** The user clicks or hovers over a node in the rendered expression tree. To select larger parent terms, the user may click a symbol and drag up or down to indicate how large a term to select.
2.  **System Hinting:** Upon selection, the UI queries the math engine to run interval-based identity testing to check in real time which places the term can be correctly inserted. 
3.  **Visual Feedback:** The UI provides dragging hints by making only locations which produce a correct result available for selection. 
4.  **Click to Place:** The user clicks one of the highlighted destination nodes, triggering a state update that modifies the expression tree and re-renders the DOM.

## 6. Functional Requirements

*   **F1. Initial Parsing:** The application must accept a string input formula from the user and parse it into an interactive tree.
*   **F2. Within-Formula Moves:** Support rearranging terms within the same side of an equation, using identity testing to ensure the ancestor node's value remains unchanged.
*   **F3. Cross-Equation Moves:** Support moving terms across the equals sign, relying on the math engine to handle automatic changes in action, such as switching from addition to subtraction.
*   **F4. Multivalued Functions:** Provide a UI mechanism (e.g., a dropdown menu or direct edit) for the user to manually choose the sign when dealing with roots, as this cannot be easily resolved by structural moving alone.
*   **F5. Global Operations:** Provide UI buttons or commands to apply new operations to both sides of the equation simultaneously (e.g., "Square both sides").
*   **F6. Simplification Pass:** Implement an automated simplification routine that tries all pairs of terms and checks whether both can be eliminated using identity testing.

## 7. Test-Driven Development (TDD) Strategy
*   **Local Move Unit Tests:** Because the system evaluates discrete, known moves, developers will design essentially perfect unit tests for each move. The specification of correctness for the system is encoded directly in these automated unit tests that verify each local move is valid.
*   **Interval Evaluator Rigor:** The custom interval arithmetic engine must be tested against known false identities to ensure it reliably rejects invalid operations.

## 8. Nomenclature Framework
To ensure complete semantic consistency between visual rendering, user interaction, state management, and the codebase, Algebranch defines a strict five-state conceptual framework for all nodes in the expression tree:

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
