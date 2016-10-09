const math = require('mathjs');
import {NODE_ID} from './common';
import CommutativeAcrossEquals from './CommutativeAcrossEquals';
import NoncommutativeAcrossEquals from './NoncommutativeAcrossEquals';
import SimplifyToInteger from './SimplifyToInteger';

export default [
  new CommutativeAcrossEquals(NODE_ID.multiply, createDivideNode),
  new CommutativeAcrossEquals(NODE_ID.add, createSubtractNode),
  /* new NoncommutativeAcrossEquals(NODE_ID.divide, createDivideNode),
   * new NoncommutativeAcrossEquals(NODE_ID.subtract, createSubtractNode),*/
  new SimplifyToInteger(),
];

function createMultiplyNode(children) {
  return new math.expression.node.OperatorNode('*', 'multiply', children);
}

function createDivideNode(children) {
  return new math.expression.node.OperatorNode('/', 'divide', children);
}

function createSubtractNode(children) {
  return new math.expression.node.OperatorNode('-', 'subtract', children);
}

function createSubtractNode(children) {
  return new math.expression.node.OperatorNode('-', 'subtract', children);
}
