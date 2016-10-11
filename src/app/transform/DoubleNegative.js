import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

const ONE = new math.expression.node.ConstantNode(1);

class DoubleNegativeAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('--x -> x', node, path, parent);
    this.result = result;
  }

  apply(expression) {
    super.apply(expression);
    return expression.transform(node => {
      return node == this.node ? this.result : node;
    });
  }
}

class DoubleNegative extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.unaryMinus]});
  }

  test(node, path, parent) {
    if (!this.isPermittedType(node, path, parent)) return [];
    let actions = [];

    if (node.args[0].getIdentifier() == NODE_ID.unaryMinus) {
      actions.push(new DoubleNegativeAction(node, path, parent, node.args[0].args[0]));
    }

    return actions;
  }
}

export default DoubleNegative;
