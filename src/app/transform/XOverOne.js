import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

const ONE = new math.expression.node.ConstantNode(1);

class XOverOneAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('x/1 -> x', node, path, parent);
    this.result = result;
  }

  apply(expression) {
    super.apply(expression);
    return expression.transform(node => {
      return node == this.node ? this.result : node;
    });
  }
}

class XOverOne extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.divide]});
  }

  test(node, path, parent) {
    if (!this.isPermittedType(node, path, parent)) return [];
    let actions = [];

    if (equivalent(ONE, node.args[1])) {
      actions.push(new XOverOneAction(node, path, parent, node.args[0]));
    }

    return actions;
  }
}

export default XOverOne;
