import {AbstractTransform, AbstractAction, NODE, equivalent} from './common';
const math = require('mathjs');

class XMinusXAction extends AbstractAction {
  constructor(node, path, parent) {
    super('x-x -> 0', node, path, parent);
    this.result = NODE.constant.create(0);
  }
}

class XMinusX extends AbstractTransform {
  constructor() {
    super({include: [NODE.subtract.id]});
  }

  testNode(node, path, parent) {
    const [a, b] = node.args;
    return equivalent(a, b) ? new XMinusXAction(node, path, parent) : [];
  }
}

export default XMinusX;
