import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

const TWO = new math.expression.node.ConstantNode(2);

class SqrtOfSquareAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('sqer(x^2) -> x', node, path, parent);
    this.result = result;
  }
}

class SqrtOfSquare extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.sqrt]});
  }

  testNode(node, path, parent) {
    return node.args[0].getIdentifier() == NODE_ID.pow
      && equivalent(node.args[0].args[1], TWO)
      ? new SqrtOfSquareAction(node, path, parent, node.args[0].args[0])
      : [];
  }
}

export default SqrtOfSquare;
