import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

const ONE = new math.expression.node.ConstantNode(1);

class DoubleNegativeAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('--x -> x', node, path, parent);
    this.result = result;
  }
}

class DoubleNegative extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.unaryMinus]});
  }

  testNode(node, path, parent) {
    return node.args[0].getIdentifier() == NODE_ID.unaryMinus
      ? [new DoubleNegativeAction(node, path, parent, node.args[0].args[0])]
      : [];
  }
}

export default DoubleNegative;
