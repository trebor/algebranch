import {AbstractTransform, AbstractAction, NODE, equivalent} from './common';
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
    super({include: [NODE.unaryMinus.id]});
  }

  testNode(node, path, parent) {
    const [a] = node.args;
    return NODE.unaryMinus.is(a)
      ? [new DoubleNegativeAction(node, path, parent, a.args[0])]
      : [];
  }
}

export default DoubleNegative;
