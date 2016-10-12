import {AbstractTransform, AbstractAction, NODE, equivalent} from './common';
const math = require('mathjs');

class CommutativeAction extends AbstractAction {
  constructor(node, path, parent) {
    super('x <op> y -> y <op> x: op is commutative', node, path, parent);
    this.result = node.clone();
    this.result.args.reverse();
  }
}

class Commutative extends AbstractTransform {
  constructor(target) {
    super({include: [target.id]});
  }

  testNode(node, path, parent) {
    const [a, b] = node.args;
    return equivalent(a, b)
      ? []
      : [new CommutativeAction(node, path, parent)];
  }
}

export default Commutative;
