import _ from 'lodash';
import math from 'mathjs';
import General from './General';

// import {NODE} from './common';
// import Commutative from './Commutative';
// import CommutativeAcrossEquals from './CommutativeAcrossEquals';
// import DoubleNegative from './DoubleNegative';
// import MultiplyDivide from './MultiplyDivide';
// import NoncommutativeAcrossEquals from './NoncommutativeAcrossEquals';
// import OneTimesX from './OneTimesX';
// import SimplifyToInteger from './SimplifyToInteger';
// import SquareBothSides from './SquareBothSides';
// import SqrtOfSquare from './SqrtOfSquare';
// import XMinusX from './XMinusX';
// import XOverOne from './XOverOne';
// import XOverX from './XOverX';

// transform data

const TRANSFORM_PACKS = [
  // [input, output, [
  //   [test-input-1, test-output-1],
  //   [test-input-2, test-output-2],
  //   ...]]]

  ['x ^ 2', 'x * x', false, [
    ['3 * 3', '3 ^ 2'],
    ['z * z', 'z ^ 2'],
    ['(2 + 3) * (2 + 3)', '(2 + 3) ^ 2']]],

  ['x / 1', 'x', false, [
    ['3 / 1', '3'],
    ['(2 + z) / 1', '(2 + z)']]],

  ['x * x', 'x ^ 2', false, [
    ['3 * 3', '3 ^ 2'],
    ['z * z', 'z ^ 2'],
    ['(2 + 3) * (2 + 3)', '(2 + 3) ^ 2']]],

  ['x == a * b', 'x / b == a', true, [
    ['12 == 3 * 4', '12 / 4 == 3'],
    ['z == 3 * 4', 'z / 4 == 3']]],

  ['x == a / b', 'x * b == a', true, [
    ['3 == 12 / 4', '3 * 4 == 12'],
    ['z == 3 / 4', 'z * 4 == 3']]],
];

const ALL_TRANSFORMS = TRANSFORM_PACKS.map(([input, output, commutative]) => {
  return new General(input, output);
});

const ALL_TRANSFORMS_xx = [
  // new CommutativeAcrossEquals(NODE.multiply, NODE.divide),
  // new CommutativeAcrossEquals(NODE.add, NODE.subtract),
  // new NoncommutativeAcrossEquals(NODE.divide, NODE.multiply),
  // new NoncommutativeAcrossEquals(NODE.subtract, NODE.add),
  // new SimplifyToInteger(),
  // new DoubleNegative(),
  // new OneTimesX(),
  // new SquareBothSides(),
  // new SqrtOfSquare(),
  // new XMinusX(),
  // new XOverOne(),
  // new XOverX(),
  // new Commutative(NODE.add),
  // new Commutative(NODE.multiply),
  // new Commutative(NODE.equal),
];

export default function establishNodeActions(node, path, parent) {
  const actionMap = _
    .flatten(ALL_TRANSFORMS.map(pattern => pattern.test(node, path, parent)))
    .reduce((map, action) => {
      map[action.result.toString()] = action;
      return map;
    }, {});

  return Object.keys(actionMap).map(key => actionMap[key]);
}

TRANSFORM_PACKS.forEach(([input, output, commutative, tests]) => {
  console.info(`${input} -> ${output}`);
  tests.forEach(testExpression);
});

function testExpression([inputStr, outputStr]) {
  let actions = [];
  const input = math.parse(inputStr);
  input.traverse((node, path, parent) => {
    actions = actions.concat(establishNodeActions(node, path, parent));
  });

  const result = actions[0] ? actions[0].apply(input) : 'no action';
  if (outputStr != result.toString()) {
    console.error(
      `  ${inputStr} expected ${outputStr} got ${result.toString()}`
    );
  }
  else {
    console.info(`  ${inputStr} -> ${outputStr}`);
  }
};
