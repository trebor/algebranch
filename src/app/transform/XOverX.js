import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

class XOverXAction extends AbstractAction {
  constructor(node, path, parent, value) {
    super('x/x -> 1', node, path, parent);
    this.result = new math.expression.node.ConstantNode(1);
  }
}

class XOverX extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.divide]});
  }

  testNode(node, path, parent) {
    return equivalent(node.args[0], node.args[1])
      ? new XOverXAction(node, path, parent)
      : [];
  }
}

export default XOverX;
