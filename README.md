# Algebrator

A tool to manipulate mathamatical expressions, inspired by the paper [Interactive Algebra Manipulation](https://github.com/trebor/algebrator/blob/master/resources/shuffle.pdf) by [Geoffrey Irving](https://github.com/girving).  This project uses [mathjs](https://github.com/josdejong/mathjs) to parse an expression into a tree structure which can be manipulated, and [MathJax](https://github.com/mathjax/MathJax) to beautifully display the expression in the browser.

Checkout the [prototype](https://trebor.github.io/algebrator), in which you can enter a [mathjs](http://mathjs.org/docs/expressions/syntax.html) formatted expression and it will be displayed as a tree.  Some of the nodes are clickable, in which case they will be removed from the tree. The red dots will at some point be the action you can perform at any given node, but for the time being, the just look pretty, and prove I can properly plot them.

<p align="center">
  <a href="https://trebor.github.io/algebrator">
    <img src="https://raw.githubusercontent.com/trebor/algebrator/master/resources/eq-tree.png" width="500px" alt="Expression Tree"/>
  </a>
</p>

## From Interactive Algebra Manipulation:
> ### Introduction
>
> Our goal is a system for manipulating algebraic formulas interactively. Here interactively means that the user will be directing most of the changes, with assistance from the computer in making the changes quickly and verifying their correctness. In contrast, typical computer algebra systems such as Mathematica have quite powerful automatic tools for simplification, transformation, etc., but these tools do not always achieve the desired goal. A system oriented towards interactivity has two key strengths:
>
> 1. **Understanding**: A system which presents an entire derivation as a single step provides no insight as to how this transformation was achieved. Besides the educational advantages, presenting the derivation as a transparent chain of simple steps provides insight into generalizability, numerical stability, physical meaning, etc.
>
> 2. **Flexibility**: Taking simplification as an example, there are a wide range of goals that the user may wish to achieve in manipulating a formula, including efficient computability, numerical stability, or suitability for some followup transform. Although it may be possible to program the Simplify routine of a computer algebra system to achieve one of these goals, an interactive system can achieve any of them even if the user only has a vague idea of the goal in advance.

## Help Needed

I could use additional collaborators.
