import {AbstractTransform, AbstractAction, NODE, equivalent} from './common';
const math = require('mathjs');

const TWO = new math.expression.node.ConstantNode(2);

class SqrtOfSquareAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('sqrt(x^2) -> x', node, path, parent);
    this.result = result;
  }
}

class SqrtOfSquare extends AbstractTransform {
  constructor() {
    super({include: [NODE.sqrt.id]});
  }

  testNode(node, path, parent) {
    const [a, b] = node.args;
    return  NODE.pow.is(a)
      && equivalent(a.args[1], NODE.constant.create(2))
      ? new SqrtOfSquareAction(node, path, parent, a.args[0])
      : [];
  }
}

export default SqrtOfSquare;
