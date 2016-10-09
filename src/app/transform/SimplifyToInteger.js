import {AbstractTransform, AbstractAction} from './Abstracts';
const math = require('mathjs');

class SimplifyToIntegerAction extends AbstractAction {
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

class SimplifyToInteger extends AbstractTransform {
  constructor() {
    super({exclude: ['ConstantNode', 'SymbolNode']});
  }

  test(node, path, parent) {
    if (!this.isPermittedType(node, path, parent)) return [];
    let actions = [];
    try {
      const value = node.eval();
      if (!isNaN(value) && value % 1 === 0) {
        actions.push(new SimplifyToIntegerAction(
          node.toString() + ' to ' + value, node, path, parent, value
        ));
      }
    }
    catch (error) {}
    return actions;
  }
}

export default SimplifyToInteger;
