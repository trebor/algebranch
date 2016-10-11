import {AbstractTransform, AbstractAction, NODE_ID} from './common';
const math = require('mathjs');

class CommutativeAction extends AbstractAction {
  constructor(node, path, parent) {
    super('x <op> y -> y <op> x: op is commutative', node, path, parent);
    this.result = node.clone();
    this.result.args.reverse();
  }
}

class Commutative extends AbstractTransform {
  constructor(targetId) {
    super({include: [targetId]});
  }

  testNode(node, path, parent) {
    return [new CommutativeAction(node, path, parent)];
  }
}

export default Commutative;
