import math from 'mathjs';
import {NODE_ID} from './common';

import Commutative from './Commutative';
import CommutativeAcrossEquals from './CommutativeAcrossEquals';
import DoubleNegative from './DoubleNegative';
import MultiplyDivide from './MultiplyDivide';
import NoncommutativeAcrossEquals from './NoncommutativeAcrossEquals';
import OneTimesX from './OneTimesX';
import SimplifyToInteger from './SimplifyToInteger';
import SqrtOfSquare from './SqrtOfSquare';
import XMinusX from './XMinusX';
import XOverOne from './XOverOne';
import XOverX from './XOverX';

export default [
  new CommutativeAcrossEquals(NODE_ID.multiply, createDivideNode),
  new CommutativeAcrossEquals(NODE_ID.add, createSubtractNode),
  new NoncommutativeAcrossEquals(NODE_ID.divide, createMultiplyNode),
  new NoncommutativeAcrossEquals(NODE_ID.subtract, createAddNode),
  new SimplifyToInteger(),
  new DoubleNegative(),
  new OneTimesX(),
  new OneTimesX(),
  new SqrtOfSquare(),
  new XMinusX(),
  new XOverOne(),
  new XOverX(),
  new Commutative(NODE_ID.add),
  new Commutative(NODE_ID.multiply),
  new Commutative(NODE_ID.equal),
];

/* new MultiplyDivide(),*/

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
