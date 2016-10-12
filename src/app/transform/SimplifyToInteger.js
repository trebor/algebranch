import {AbstractTransform, AbstractAction, NODE} from './common';
const math = require('mathjs');

class SimplifyToIntegerAction extends AbstractAction {
  constructor(node, path, parent, value) {
    super(node.toString() + ' -> ' + value, node, path, parent);
    this.result = NODE.constant.create(value);
  }
}

class SimplifyToInteger extends AbstractTransform {
  constructor() {
    super({exclude: [NODE.constant.id, NODE.symbol.id]});
  }

  testNode(node, path, parent) {
    try {
      const value = node.eval();
      if (!isNaN(value) && value % 1 === 0) {
        return [new SimplifyToIntegerAction(node, path, parent, value)];
      }
    }
    catch (error) {}
    return [];
  }
}

export default SimplifyToInteger;
