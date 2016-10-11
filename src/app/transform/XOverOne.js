import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

const ONE = new math.expression.node.ConstantNode(1);

class XOverOneAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('x/1 -> x', node, path, parent);
    this.result = result;
  }
}

class XOverOne extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.divide]});
  }

  testNode(node, path, parent) {
    return equivalent(ONE, node.args[1])
      ? new XOverOneAction(node, path, parent, node.args[0])
      : [];
  }
}

export default XOverOne;
