import {AbstractTransform, AbstractAction, NODE_ID, equivalent} from './common';
const math = require('mathjs');

class MultiplyDivideAction extends AbstractAction {
  constructor(name, node, path, parent, value) {
    super(name, node, path, parent);
    this.value = value;
    this.result = new math.expression.node.ConstantNode(this.value);
  }

  apply(expression) {
    super.apply(expression);
    return expression.transform(node => {
      if (node == this.parent) {
        return this.parent.map(child => child == this.node
          ? this.result
          : child);
      }
      return node;
    });
  }
}

class MultiplyDivide extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.multiply]});
  }

  test(node, path, parent) {
    if (!this.isPermittedType(node, path, parent)) return [];
    let actions = [];

    console.log("----", node.toString());

    const xxx = node.map((child) => {
      console.log("child", child.toString());
      return child;
    });

    console.log("xxx", xxx);

    return actions;
  }
}

export default MultiplyDivide;
