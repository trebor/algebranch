// Onboarding tutorial content: chapters, steps, and expected derivation chains.
// Pure data — no store/engine imports — so the math-engine test suite can
// validate every chapter's chain against the real engine (tests/onboarding.test.ts).

export interface OnboardingStep {
  title: string;
  description: string;
  highlightPath: string | null;
  nextEquation: string;
  stepLabel?: string;
  selectPath?: string;
  /** When set, the Next button performs this both-sides operation via applyGlobalOpAtom */
  globalOp?: { type: 'square' | 'sqrt' | 'add' | 'sub' | 'mul' | 'div' | 'power' | 'root'; term?: string; power?: number };
  /** Renders a color legend on this step's coach card: node kinds, or the source/target selection states */
  legend?: 'nodeTypes' | 'sourceTarget';
}

export interface OnboardingChapter {
  id: string;
  title: string;
  description: string;
  initialEquation: string;
  /**
   * Substitution facts injected for this chapter (#3): isolated equations
   * presented as "already solved in another workspace", so the substitution
   * interaction is taught in a single workspace. Each entry must parse to an
   * isolated definition (e.g. 'y = 2 * x').
   */
  facts?: string[];
  steps: OnboardingStep[];
}

export const ONBOARDING_CHAPTERS: OnboardingChapter[] = [
  {
    id: 'linear',
    title: '1. Basic Equations',
    description: 'Learn how to transpose numbers and simplify arithmetic to solve simple linear equations.',
    initialEquation: '3 * x - 4 = 11',
    steps: [
      {
        title: 'Welcome to Algebranch!',
        description: 'This is an interactive math playground. Active terms can be clicked and moved around. Immobile terms (locked in place) cannot be moved and have a dark background.',
        highlightPath: null,
        nextEquation: '3 * x - 4 = 11',
        stepLabel: 'Start',
        legend: 'nodeTypes'
      },
      {
        title: 'Isolate the Variable',
        description: 'To solve for x, we want to isolate it on the left side of the equals sign. Let\'s move the constant -4 to the other side. Click on the highlighted 4 to select it.',
        highlightPath: 'lhs/1', // constant 4 in subtraction
        nextEquation: '3 * x - 4 = 11',
        stepLabel: 'Select'
      },
      {
        title: 'Colors Changed!',
        description: 'Oh look, the colors have changed! The number 4 is now highlighted, and a target destination has appeared on the right. Click the glowing target to transpose it.',
        highlightPath: null,
        nextEquation: '3 * x = 11 + 4',
        stepLabel: 'Transpose',
        selectPath: 'lhs/1',
        legend: 'sourceTarget'
      },
      {
        title: 'Simplify Constants',
        description: 'Moving -4 across the equals sign flipped its sign to +4. Now, let\'s simplify the addition 11 + 4 to reduce it to 15.',
        highlightPath: 'rhs', // sum on the right side
        nextEquation: '3 * x = 15',
        stepLabel: 'Simplify'
      },
      {
        title: 'Divide by Coefficient',
        description: 'We have 3 * x = 15. To get x completely alone, let\'s move the multiplier 3 to the other side. Click on the highlighted 3 to select it.',
        highlightPath: 'lhs/0', // constant 3 in multiplication
        nextEquation: '3 * x = 15',
        stepLabel: 'Select'
      },
      {
        title: 'Transposing Multiplier',
        description: 'Again, the colors have changed. The selected 3 is highlighted, and the division target is glowing on the right. Click the glowing target to transpose it.',
        highlightPath: null,
        nextEquation: 'x = 15 / 3',
        stepLabel: 'Transpose',
        selectPath: 'lhs/0'
      },
      {
        title: 'Final Division',
        description: 'Now, simplify the division 15 / 3 to calculate the final answer.',
        highlightPath: 'rhs', // division node
        nextEquation: 'x = 5',
        stepLabel: 'Simplify'
      },
      {
        title: 'Equation Solved!',
        description: 'Awesome job! x = 5. You have isolated x and solved the equation step-by-step using transpositions and simplifications.',
        highlightPath: null,
        nextEquation: ''
      }
    ]
  },
  {
    id: 'complex',
    title: '2. Powers & Roots',
    description: 'Learn how to solve equations containing exponents by applying roots to both sides.',
    initialEquation: 'x ^ 2 - 9 = 0',
    steps: [
      {
        title: 'Isolate the Power',
        description: 'First, let\'s isolate the x^2 term. Click on the highlighted 9, then click the glowing target to move it to the other side. Subtracting 9 becomes adding 9, and 0 + 9 folds straight to 9.',
        highlightPath: 'lhs/1', // constant 9
        nextEquation: 'x ^ 2 = 9',
        stepLabel: 'Transpose'
      },
      {
        title: 'Square Root Both Sides',
        description: 'To undo the exponent ^2, take the square root of both sides of the equation. Click the circled = sign and choose the square root operation.',
        highlightPath: null,
        nextEquation: 'sqrt(x ^ 2) = sqrt(9)',
        stepLabel: 'Global Sqrt',
        globalOp: { type: 'sqrt' }
      },
      {
        title: 'Cancel the Root',
        description: 'The square root undoes the square: sqrt(x^2) is just x. Click the handle to simplify the left side.',
        highlightPath: 'lhs', // sqrt(x^2) node
        nextEquation: 'x = sqrt(9)',
        stepLabel: 'Simplify'
      },
      {
        title: 'Calculate the Root',
        description: 'Now, simplify the square root of 9 to get the final positive integer root.',
        highlightPath: 'rhs', // sqrt node
        nextEquation: 'x = 3',
        stepLabel: 'Simplify'
      },
      {
        title: 'Solved!',
        description: 'Perfect! You solved for x. Applying the same root to both sides undoes an exponent.',
        highlightPath: null,
        nextEquation: ''
      }
    ]
  },
  {
    id: 'identities',
    title: '3. Algebraic Identities',
    description: 'Discover how to apply conjugate binomial formulas and solve differences of squares.',
    initialEquation: '(x - 3) * (x + 3) = 0',
    steps: [
      {
        title: 'Conjugate Binomials',
        description: 'This expression has the identity form (a - b)(a + b). Let\'s expand it into a difference of squares: a^2 - b^2.',
        highlightPath: 'lhs', // multiplication node
        nextEquation: 'x ^ 2 - 3 ^ 2 = 0',
        stepLabel: 'Expand Conjugate Binomials'
      },
      {
        title: 'Simplify Exponent',
        description: 'Let\'s calculate the value of 3^2, which is 9.',
        highlightPath: 'lhs/1', // 3^2 node
        nextEquation: 'x ^ 2 - 9 = 0',
        stepLabel: 'Simplify'
      },
      {
        title: 'Transpose -9',
        description: 'Now we are back to a familiar shape. Click on the highlighted 9, then click the glowing target to move it to the right side.',
        highlightPath: 'lhs/1',
        nextEquation: 'x ^ 2 = 9',
        stepLabel: 'Transpose'
      },
      {
        title: 'Square Root Both Sides',
        description: 'Undo the exponent by taking the square root of both sides. Click the circled = sign and choose the square root operation.',
        highlightPath: null,
        nextEquation: 'sqrt(x ^ 2) = sqrt(9)',
        stepLabel: 'Global Sqrt',
        globalOp: { type: 'sqrt' }
      },
      {
        title: 'Cancel the Root',
        description: 'sqrt(x^2) simplifies to just x. Click the handle to simplify the left side.',
        highlightPath: 'lhs', // sqrt(x^2) node
        nextEquation: 'x = sqrt(9)',
        stepLabel: 'Simplify'
      },
      {
        title: 'Find final x',
        description: 'Simplify sqrt(9) to get the positive root.',
        highlightPath: 'rhs',
        nextEquation: 'x = 3',
        stepLabel: 'Simplify'
      },
      {
        title: 'Master Class Complete!',
        description: 'Fantastic! You expanded the binomial product, calculated the powers, and isolated x successfully.',
        highlightPath: null,
        nextEquation: ''
      }
    ]
  },
  {
    id: 'global',
    title: '4. Global Operations',
    description: 'Learn how to apply operations to both sides of the equation simultaneously.',
    initialEquation: 'x / 3 = 4',
    steps: [
      {
        title: 'Undo Division Globally',
        description: 'Since x is divided by 3, we can cancel it out by multiplying both sides of the equation by 3. We call this a Global Operation.',
        highlightPath: null, // no term highlighted
        nextEquation: 'x / 3 * 3 = 4 * 3',
        stepLabel: 'Global ⋅ 3',
        globalOp: { type: 'mul', term: '3' }
      },
      {
        title: 'Cancel the Division',
        description: 'On the left side, dividing by 3 and multiplying by 3 cancel each other out. Let\'s simplify the left-hand side.',
        highlightPath: 'lhs', // (x / 3) * 3
        nextEquation: 'x = 4 * 3',
        stepLabel: 'Simplify'
      },
      {
        title: 'Calculate Solution',
        description: 'Now, simplify the multiplication 4 * 3 on the right side to get the final value.',
        highlightPath: 'rhs', // 4 * 3
        nextEquation: 'x = 12',
        stepLabel: 'Simplify'
      },
      {
        title: 'Completed!',
        description: 'Outstanding! Applying operations globally to both sides is a very powerful way to solve complex algebraic equations.',
        highlightPath: null,
        nextEquation: ''
      }
    ]
  },
  {
    id: 'substitution',
    title: '5. Substitution',
    description: 'Use a result from another workspace: replace a variable with what it is known to equal, then solve.',
    initialEquation: 'y + 4 = 10',
    facts: ['y = 2 * x'],
    steps: [
      {
        title: 'Two Equations, One Goal',
        description: 'This equation contains y — but in another workspace we already discovered that y = 2 * x (see the Known equations strip above). Substitution lets us connect the two equations so we can solve for x.',
        highlightPath: null,
        nextEquation: 'y + 4 = 10',
        stepLabel: 'Start'
      },
      {
        title: 'Substitute the Known Value',
        description: 'The y carries a teal substitution handle: it can be replaced by what it equals. Click the teal handle on y to swap it for 2 * x.',
        highlightPath: 'lhs/0', // the y
        nextEquation: '2 * x + 4 = 10',
        stepLabel: 'Substitute'
      },
      {
        title: 'Isolate the Variable',
        description: 'Now the equation only involves x — solve it like Chapter 1. Click on the highlighted 4 to select it.',
        highlightPath: 'lhs/1',
        nextEquation: '2 * x + 4 = 10',
        stepLabel: 'Select'
      },
      {
        title: 'Transpose the Constant',
        description: 'Click the glowing target on the right to move the 4 across the equals sign (its sign flips to -4).',
        highlightPath: null,
        nextEquation: '2 * x = 10 - 4',
        stepLabel: 'Transpose',
        selectPath: 'lhs/1'
      },
      {
        title: 'Simplify Constants',
        description: 'Simplify the subtraction 10 - 4 on the right side.',
        highlightPath: 'rhs',
        nextEquation: '2 * x = 6',
        stepLabel: 'Simplify'
      },
      {
        title: 'Divide by Coefficient',
        description: 'To get x alone, move the multiplier 2 to the other side. Click on the highlighted 2 to select it.',
        highlightPath: 'lhs/0',
        nextEquation: '2 * x = 6',
        stepLabel: 'Select'
      },
      {
        title: 'Transpose the Multiplier',
        description: 'Click the glowing division target on the right to transpose the 2.',
        highlightPath: null,
        nextEquation: 'x = 6 / 2',
        stepLabel: 'Transpose',
        selectPath: 'lhs/0'
      },
      {
        title: 'Calculate Solution',
        description: 'Simplify the division 6 / 2 to find x.',
        highlightPath: 'rhs',
        nextEquation: 'x = 3',
        stepLabel: 'Simplify'
      },
      {
        title: 'Completed!',
        description: 'Brilliant! You combined two equations by substitution — the key technique for solving systems of equations and working with formulas.',
        highlightPath: null,
        nextEquation: ''
      }
    ]
  }
];

