import _ from 'lodash';
import math from 'mathjs';
import General from './General';
import { parseExpression } from './common';

// transform data

const TRANSFORM_PACKS = [
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
    ['12 == 3 + 4', '12 - 4 == 3'],
    ['z == 3 + 4', 'z - 4 == 3'],
  ]],

  ['x == a + b', 'x - a == b', true, [
    ['12 == 3 + 4', '12 - 3 == 4'],
    ['z == (2 * x + 9) + 4', 'z - (2 * x + 9) == 4'],
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

  // distribute -1

  ['-(a + b)', '-a -b', true, [
    ['-(3 + 2)', '-3 - 2'],
    ['-(3 + (2 * y))', '-3 - (2 * y)'],
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
];

const ALL_TRANSFORMS = _(TRANSFORM_PACKS)
  .map(([input, output, swapable]) => (swapable ? [false, true] : [false])
    .map(swap => new General(input, output, swap)))
  .flatten()
  .valueOf();

export default function establishNodeActions(node, path, parent) {
  const actionMap = _
    .flatten(ALL_TRANSFORMS.map(pattern => pattern.test(node, path, parent)))
    .reduce((map, action) => {
      map[action.result.toString()] = action;
      return map;
    }, {});

  return Object.keys(actionMap).map(key => actionMap[key]);
}

TRANSFORM_PACKS
//  .filter(([input, output, commutative, tests, only]) => only)
  .forEach(([input, output, commutative, tests]) => {
  //console.info(`[ ${input} ] -> [ ${output} ]`);
  tests.forEach(test => testExpression(new General(input, output), test));
});

function testExpression(pattern, [inputStr, outputStr]) {
  let actions = [];
  const input = math.parse(inputStr);
  input.traverse((node, path, parent) => {
    actions = actions.concat(pattern.test(node, path, parent));
  });

  const result = actions[0] ? actions[0].apply(input) : 'no action';
  if (outputStr != result.toString()) {
    const message = `Pattern: ${pattern.title()}\n`
      + `  Tested:     ${inputStr}\n`
      + `  Expected: ${outputStr}\n`
      + `  Found:      ${result.toString()}`;
    alert(message);
  }
  // else {
  //   console.info(`   ${inputStr} -> ${outputStr}`);
  // }
};
