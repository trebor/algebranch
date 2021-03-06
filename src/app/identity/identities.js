// a list of all math identites

const IDENTITIES = [
  // [input, output, [
  //   [test-input-1, test-output-1],
  //   [test-input-2, test-output-2],
  //   ...
  // ]],

  ['x ^ 2', 'x * x', false, [
    ['3 ^ 2', '3 * 3'],
    ['z ^ 2', 'z * z'],
    ['(2 + 3) ^ 2', '(2 + 3) * (2 + 3)'],
  ]],

  ['x * x', 'x ^ 2', false, [
    ['3 * 3', '3 ^ 2'],
    ['z * z', 'z ^ 2'],
    ['(2 + 3) * (2 + 3)', '(2 + 3) ^ 2'],
  ]],

  // new OneTimesX(),

  ['x * 1', 'x', true, [
    ['3 * 1', '3'],
    ['(2 + z) * 1', '(2 + z)'],
  ]],

  // new XOverOne(),

  ['x / 1', 'x', false, [
    ['3 / 1', '3'],
    ['(2 + z) / 1', '(2 + z)'],
  ]],

  // zeros

  ['x + 0', 'x', true, [
    ['3 + 0', '3'],
    ['(2 + z) + 0', '(2 + z)'],
  ]],

  ['x - 0', 'x', false, [
    ['3 - 0', '3'],
    ['(2 + z) - 0', '(2 + z)'],
  ]],

  ['0 - x', '-x', false, [
    ['0 - 3', '-3'],
    ['0 - (2 + z)', '-(2 + z)'],
  ]],

  // x * y / x -> y

  ['x * y / x', 'y', false, [
    ['3 * 4 / 3', '4'],
    ['(2 * x) * z / (2 * x)', 'z'],
  ]],

  ['y * x / x', 'y', false, [
    ['4 * 3 / 3', '4'],
    ['z * (2 * x) / (2 * x)', 'z'],
  ]],

  // new XOverX(),

  ['x / x', '1', false, [
    ['3 / 3', '1'],
    ['(2 + z) / (2 + z)', '1'],
  ]],

  // new XMinusX(),

  ['x - x', '0', false, [
    ['3 - 3', '0'],
    ['(2 + z) - (2 + z)', '0'],
  ]],

  // new DoubleNegative(),

  ['--x', 'x', false, [
    ['--3', '3'],
    ['--(2 + z)', '(2 + z)'],
  ]],

  ['x- -y', 'x + y', false, [
    ['4- -3', '4 + 3'],
    ['x - -(2 + z)', 'x + (2 + z)'],
  ]],

  ['-x + y', 'y - x', false, [
    ['-4 + 3', '3 - 4'],
    ['-x + (2 + z)', '(2 + z) - x'],
  ]],



  // transfer minus across equals

  ['a == -b', '-a == b', true, [
    ['3 == -(-3)', '-3 == (-3)'],
  ]],

  // transfer minus around

  ['-(a / b)', '-a / b', false, [
    ['-(3 / 5)', '-3 / 5'],
  ]],

  ['-(a / b)', 'a / -b', false, [
    ['-(3 / 5)', '3 / -5'],
  ]],

  ['-a / b', '-(a / b)', false, [
    ['-3 / 5', '-(3 / 5)'],
  ]],

  // new CommutativeAcrossEquals(NODE.multiply, NODE.divide),

  ['x == a * b', 'x / b == a', true, [
    ['12 == 3 * 4', '12 / 4 == 3'],
    ['z == 3 * 4', 'z / 4 == 3'],
  ]],

  ['x == a * b', 'x / a == b', true, [
    ['12 == 3 * 4', '12 / 3 == 4'],
    ['z == (2 * x + 7) * 4', 'z / (2 * x + 7) == 4'],
  ]],

  // new CommutativeAcrossEquals(NODE.add, NODE.subtract),

  ['x == a + b', 'x - b == a', true, [
    ['7 == 3 + 4', '7 - 4 == 3'],
    ['z == 3 + 4', 'z - 4 == 3'],
  ]],

  ['x == a + b', 'x - a == b', true, [
    ['7 == 3 + 4', '7 - 3 == 4'],
    ['z == (2 * x + 9) + 4', 'z - (2 * x + 9) == 4'],
  ]],

  ['x == a - b', 'x + b == a', true, [
    ['-1 == 3 - 4', '-1 + 4 == 3'],
    ['z == 3 - 4', 'z + 4 == 3'],
  ]],

  ['x == a - b', 'x + a == b', true, [
    ['-1 == 3 - 4', '-1 + 3 == 4'],
    ['z == (2 * x + 9) - 4', 'z + (2 * x + 9) == 4'],
  ]],

  // new NoncommutativeAcrossEquals(NODE.divide, NODE.multiply),

  ['x == a / b', 'x * b == a', true, [
    ['3 == 12 / 4', '3 * 4 == 12'],
    ['z == 3 / 4', 'z * 4 == 3'],
  ]],

  ['x == a / b', 'a / x  == b', true, [
    ['3 == 12 / 4', '12 / 3 == 4'],
    ['z == (2 * x + 1) / 4', '(2 * x + 1) / z == 4']
  ]],

  // new NoncommutativeAcrossEquals(NODE.subtract, NODE.add),

  ['x == a - b', 'x + b == a', true, [
    ['8 == 12 - 4', '8 + 4 == 12'],
    ['z == (2 * x) - 4', 'z + 4 == (2 * x)'],
  ]],

  ['x == a - b', 'x - a == -b', true, [
    ['8 == 12 - 4', '8 - 12 == -4'],
    ['z == (2 * x) - 4', 'z - (2 * x) == -4']
  ]],

  // new SquareBothSides(),

  ['sqrt(x) == y', 'x == y ^ 2', true, [
    ['sqrt(25) == 5', '25 == 5 ^ 2'],
    ['sqrt(2 + x) == y * 3', '2 + x == (y * 3) ^ 2']
  ]],

  // new SqrtOfSquare(),

  ['sqrt(x^2)', 'x', false, [
    ['sqrt(3 ^ 2)', '3'],
    ['sqrt((1 + 4)^2)', '(1 + 4)'],
  ]],

  // new Commutative(NODE.add),

  ['x + y ', 'y + x', false, [
    ['3 + 4', '4 + 3'],
    ['(1 + 4) + 2 * x', '2 * x + (1 + 4)'],
  ]],

  // new Commutative(NODE.multiply),

  ['x * y ', 'y * x', false, [
    ['3 * 4', '4 * 3'],
    ['(1 * 4) * 2 + x', '2 * (1 * 4) + x'],
  ]],

  // new Commutative(NODE.equal),

  ['x == y ', 'y == x', false, [
    ['3 == 4', '4 == 3'],
    ['(1 * 4) == 2 + x', '2 + x == (1 * 4)'],
  ]],

  // new SimplifyToInteger(),

  ['_isInt(x)', '_toInt(x)', false, [
    ['3 * 4', '12'],
    ['log(e)', '1'],
    ['1 + 2', '3'],
  ]],

  // distribute

  ['a * (b + c)', 'a * b + a * c', true, [
    ['x * (3 + 2)', 'x * 3 + x * 2'],
    ['(2 + x) * (3 + y)', '(2 + x) * 3 + (2 + x) * y'],
  ]],

  ['a * (b - c)', 'a * b - a * c', true, [
    ['x * (3 - 2)', 'x * 3 - x * 2'],
    ['(2 + x) * (3 - y)', '(2 + x) * 3 - (2 + x) * y'],
  ]],

  // distribute -1

  ['-(a + b)', '-a - b', true, [
    ['-(3 + 2)', '-3 - 2'],
    ['-(3 + (2 * y))', '-3 - (2 * y)'],
  ]],

  ['-(a - b)', '-a + b', true, [
    ['-(3 - 2)', '-3 + 2'],
    ['-(3 - (2 * y))', '-3 + (2 * y)'],
  ]],

  ['-(a * b)', '-a * b', true, [
    ['-(3 * 2)', '-3 * 2'],
    ['-(3 * (2 * y))', '-3 * (2 * y)'],
  ]],

  // factor

  ['x * a + x * b', 'x * (a + b)', false, [
    ['x * z + x * 12', 'x * (z + 12)'],
    ['3 * 12 + 3 * (2 * y)', '3 * (12 + (2 * y))'],
  ]],

  ['a * x + b * x', 'x * (a + b)', false, [
    ['z * x + 12 * x', 'x * (z + 12)'],
    ['12 * 3 + (2 * y) * 3', '3 * (12 + (2 * y))'],
  ]],

  ['x * a + b * x', 'x * (a + b)', true, [
    ['x * z + 12 * x', 'x * (z + 12)'],
    ['3 * 12 + (2 * y) * 3', '3 * (12 + (2 * y))'],
  ]],


  ['x * a - x * b', 'x * (a - b)', false, [
    ['x * z - x * 12', 'x * (z - 12)'],
    ['3 * 12 - 3 * (2 * y)', '3 * (12 - (2 * y))'],
  ]],

  ['a * x + b * x', 'x * (a + b)', false, [
    ['z * x + 12 * x', 'x * (z + 12)'],
    ['12 * 3 + (2 * y) * 3', '3 * (12 + (2 * y))'],
  ]],

  ['x * a + b * x', 'x * (a + b)', true, [
    ['x * z + 12 * x', 'x * (z + 12)'],
    ['3 * 12 + (2 * y) * 3', '3 * (12 + (2 * y))'],
  ]],

  // move up into top of divide

  ['(x / y) * z', '(x * z) / y', false, [
    ['2 / 5 * 3', '2 * 3 / 5'],
    ['(3 / (2 * y)) * 3', '3 * 3 / (2 * y)'],
  ]],

  ['z * (x / y)', '(z * x) / y', false, [
    ['3 * (2 / 5)', '3 * 2 / 5'],
    ['3 * (3 / (2 * y))', '3 * 3 / (2 * y)'],
  ]],

  // some trig

  ['cos(x) ^ 2 + sin(x) ^ 2', '1', true, [
    ['cos(pi) ^ 2 + sin(pi) ^ 2', '1'],
    ['cos(3 + 2 * y) ^ 2 + sin(3 + 2 * y) ^ 2', '1'],
  ]],

  // get to zero

  ['x == y', 'x - y == 0', false, [
    ['4 == 4', '4 - 4 == 0'],
  ]],
];

export default IDENTITIES;
