# Scope & Capabilities

[User Guide](user-guide.md) • [Features Reference](features.md) • [**Scope & Capabilities**](scope.md) • [FAQ](faq.md) • [Documentation Index](index.md)

---

This page outlines what Algebranch can do, what it cannot do currently, and where the project is headed. Algebranch is built to help you learn and practice algebra, which means its features are designed around specific mathematical bounds.

---

## 1. What Algebranch Can Do

Algebranch is designed to support **Algebra 1 and Algebra 2** level mathematics. It acts as an interactive playground where you make the moves, and the math engine serves as a guardrail to keep your steps correct.

Supported capabilities include:
*   **Linear & Quadratic Equations**: Solving single-variable and systems of equations.
*   **Polynomials & Factoring**: Simplifying, expanding, and factoring algebraic expressions.
*   **Rationals & Radicals**: Combining fractions over a common denominator, simplifying radicals, such as rewriting $\sqrt{8}$ as $2\sqrt{2}$, and rationalizing denominators.
*   **Exact Irrationals**: Performing operations with exact representations of mathematical constants like $e$ and $\pi$.
*   **Inequalities**: Fully supporting transpositions with direction-flipping logic when multiplying or dividing by negative numbers.
*   **Completing the Square**: Transforming quadratic expressions to complete the square.
*   **Substitution**: Replacing variables with equivalent expressions across multiple workspace tabs.
*   **Visual Graphing**: Graphing equations to see variable relationships and intersection points.
*   **Complex Numbers**: Full arithmetic, powers, and roots using the imaginary unit $\mathbb{i}$ (using the unique Unicode codepoint `ⅈ` to distinguish it from a variable $i$), including conjugate rationalization of denominators and power simplification (e.g. $\mathbb{i}^2 = -1$). Gated on the `allowComplex` setting.
*   **Absolute Value**: Full algebraic operations and transpositions involving the absolute value function (`abs(x)` or rendered as $|x|$), including product, quotient, square identities, and principal root of squares (e.g. $\sqrt{x^2} = |x|$).

For the exhaustive list of every supported transformation, global operation, and interface setting, please see the [Features Reference](features.md).

---

## 2. What Algebranch Cannot Do Currently

Algebranch focuses specifically on core algebraic manipulations. The following areas are outside its current scope, though many are planned for future updates. You can track progress or contribute to these features via their respective issues:

*   **Calculus**: Operations like limits, derivatives, and integrals are not supported. See [#183](https://github.com/trebor/algebranch/issues/183).
*   **Summation & Product Notation**: Summation ($\sum$) and product ($\prod$) operators are not available. See [#182](https://github.com/trebor/algebranch/issues/182).
*   **Factorial**: The factorial operator ($!$) is not supported. See [#181](https://github.com/trebor/algebranch/issues/181).
*   **Floor, Ceiling, & Modulo**: These discrete functions are not supported. See [#180](https://github.com/trebor/algebranch/issues/180).
*   **Sets, Logic, & Linear Algebra**: Matrix math, vectors, logical operators, and set notation are not supported. See [#184](https://github.com/trebor/algebranch/issues/184).
*   **Unit Conversions**: Converting units, such as meters to feet, is not supported. See [#36](https://github.com/trebor/algebranch/issues/36).

---

## 3. Where It's Headed

Algebranch is guided by the [Operator Epic Roadmap](https://github.com/trebor/algebranch/issues/185) to expand its mathematical capabilities over time.

### The Numeric Equivalence Axis
To understand how Algebranch grows, it helps to understand how the math engine works. Unlike traditional computer algebra systems that verify algebraic steps symbolically, Algebranch verifies equivalence **numerically rather than symbolically**. 

When you make a move, the engine evaluates both the original and transformed expressions across a set of random numerical points. If they evaluate to the same value within a high-precision tolerance, the move is permitted.

This design choice has major benefits:
1.  **Pedagogical Freedom**: The engine does not care *how* you write your math, as long as it is mathematically equivalent. It will never force a specific canonical form on you.
2.  **Implementation Speed**: Numeric checking is incredibly fast, allowing real-time step validation in the browser.

However, it also frames which operators are easy or hard to add:
*   **Continuous Real Operators**: Functions like floor/ceil, and trigonometric functions are relatively easy to support because they map cleanly to real numbers.
*   **Discrete & Complex Domains**: Operators that jump domains, including complex roots, vector arithmetic, and logic, require extending the engine's internal coordinate space and random sampling strategy.

To learn more about the engineering plan and coordinate systems, follow the live roadmap in the [epic: operator roadmap toward advanced math](https://github.com/trebor/algebranch/issues/185) issue, tracked at [#185](https://github.com/trebor/algebranch/issues/185).
