import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

class XOverXAction extends AbstractAction {
  constructor(node, path, parent, value) {
    super('x/x -> 1', node, path, parent);
    this.result = new math.expression.node.ConstantNode(1);
  }

  apply(expression) {
    super.apply(expression);
    return expression.transform(node => {
      if (this.node == node) {
      }

      return node == this.node ? this.result : node;
    });
  }
}

class XOverX extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.divide]});
  }

  test(node, path, parent) {
    if (!this.isPermittedType(node, path, parent)) return [];
    let actions = [];

    if (equivalent(node.args[0], node.args[1])) {
      actions.push(new XOverXAction(node, path, parent));
    }

    return actions;
  }
}

export default XOverX;
