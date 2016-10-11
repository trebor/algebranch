import math from 'mathjs';
import {NODE_ID} from './common';
import CommutativeAcrossEquals from './CommutativeAcrossEquals';
import NoncommutativeAcrossEquals from './NoncommutativeAcrossEquals';
import SimplifyToInteger from './SimplifyToInteger';
import MultiplyDivide from './MultiplyDivide';
import DoubleNegative from './DoubleNegative';
import OneTimesX from './OneTimesX';
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
  new XOverOne(),
  new XOverX(),
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
