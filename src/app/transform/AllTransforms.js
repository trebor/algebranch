const math = require('mathjs');
import {NODE_ID} from './common';
import CommutativeAcrossEquals from './CommutativeAcrossEquals';
import NoncommutativeAcrossEquals from './NoncommutativeAcrossEquals';
import SimplifyToInteger from './SimplifyToInteger';

export default [
  new CommutativeAcrossEquals(NODE_ID.multiply, createDivideNode),
  new CommutativeAcrossEquals(NODE_ID.add, createSubtractNode),
  new NoncommutativeAcrossEquals(NODE_ID.divide, createMultiplyNode),
  new NoncommutativeAcrossEquals(NODE_ID.subtract, createAddNode),
  new SimplifyToInteger(),
];

console.log("NODE_ID.subtract", NODE_ID.subtract);

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
