import _ from 'lodash';
import math from 'mathjs';
import {NODE_ID, NODE} from './common';

import Commutative from './Commutative';
import CommutativeAcrossEquals from './CommutativeAcrossEquals';
import DoubleNegative from './DoubleNegative';
import MultiplyDivide from './MultiplyDivide';
import NoncommutativeAcrossEquals from './NoncommutativeAcrossEquals';
import OneTimesX from './OneTimesX';
import SimplifyToInteger from './SimplifyToInteger';
import SquareBothSides from './SquareBothSides';
import SqrtOfSquare from './SqrtOfSquare';
import XMinusX from './XMinusX';
import XOverOne from './XOverOne';
import XOverX from './XOverX';

const ALL_TRANSFORMS = [
  new CommutativeAcrossEquals(NODE_ID.multiply, createDivideNode),
  new CommutativeAcrossEquals(NODE_ID.add, createSubtractNode),
  new NoncommutativeAcrossEquals(NODE_ID.divide, createMultiplyNode),
  new NoncommutativeAcrossEquals(NODE_ID.subtract, createAddNode),
  new SimplifyToInteger(),
  new DoubleNegative(),
  new OneTimesX(),
  new OneTimesX(),
  new SquareBothSides(),
  new SqrtOfSquare(),
  new XMinusX(),
  new XOverOne(),
  new XOverX(),
  new Commutative(NODE.add),
  new Commutative(NODE.multiply),
  new Commutative(NODE.equal),
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

function createMultiplyNode(children) {
  return new math.expression.node.OperatorNode('*', 'multiply', children);
}

function createDivideNode(children) {
  return new math.expression.node.OperatorNode('/', 'divide', children);
}

function createAddNode(children) {
  return new math.expression.node.OperatorNode('+', 'add', children);
}

function createSubtractNode(children) {
  return new math.expression.node.OperatorNode('-', 'subtract', children);
}
