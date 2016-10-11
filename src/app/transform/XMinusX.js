import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

const ZERO = new math.expression.node.ConstantNode(0);

class XMinusXAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('x-x -> 0', node, path, parent);
    this.result = result;
  }
}

class XMinusX extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.subtract]});
  }

  testNode(node, path, parent) {
    return equivalent(node.args[0], node.args[1])
      ? new XMinusXAction(node, path, parent, ZERO)
      : [];
  }
}

export default XMinusX;
