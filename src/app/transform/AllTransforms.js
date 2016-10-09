const math = require('mathjs');
import {NODE_ID} from './Abstracts';
import CommutativeAcrossEquals from './CommutativeAcrossEquals';
import SimplifyToInteger from './SimplifyToInteger';

export default [
  new CommutativeAcrossEquals(NODE_ID.multiply, createDivideNode),
  new CommutativeAcrossEquals(NODE_ID.add, createSubtractNode),
  new SimplifyToInteger(),
];

function createDivideNode(children) {
  return new math.expression.node.OperatorNode('/', 'divide', children);
}

function createSubtractNode(children) {
  return new math.expression.node.OperatorNode('-', 'subtract', children);
}
