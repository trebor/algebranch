import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

const ONE = new math.expression.node.ConstantNode(1);

class OneTimesXAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('x*1 -> x', node, path, parent);
    this.result = result;
  }
}

class OneTimesX extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.multiply]});
  }

  testNode(node, path, parent) {
    return equivalent(ONE, node.args[0])
      ? new OneTimesXAction(node, path, parent, node.args[1])
      : equivalent(ONE, node.args[1])
        ? new OneTimesXAction(node, path, parent, node.args[0])
        : [];
  }
}

export default OneTimesX;
