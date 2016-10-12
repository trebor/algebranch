import {AbstractTransform, AbstractAction, NODE, equivalent} from './common';
const math = require('mathjs');

const ONE = NODE.constant.create(1);

class XOverOneAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('x/1 -> x', node, path, parent);
    this.result = result;
  }
}

class XOverOne extends AbstractTransform {
  constructor() {
    super({include: [NODE.divide.id]});
  }

  testNode(node, path, parent) {
    const [a, b] = node.args;
    return equivalent(ONE, b)
      ? new XOverOneAction(node, path, parent, a)
      : [];
  }
}

export default XOverOne;
