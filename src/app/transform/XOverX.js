import {AbstractTransform, AbstractAction, NODE, equivalent} from './common';
const math = require('mathjs');

class XOverXAction extends AbstractAction {
  constructor(node, path, parent, value) {
    super('x/x -> 1', node, path, parent);
    this.result = NODE.constant.create(1);
  }
}

class XOverX extends AbstractTransform {
  constructor() {
    super({include: [NODE.divide.id]});
  }

  testNode(node, path, parent) {
    const [a, b] = node.args;
    return equivalent(a, b) ? new XOverXAction(node, path, parent) : [];
  }
}

export default XOverX;
