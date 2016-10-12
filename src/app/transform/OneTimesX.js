import {AbstractTransform, AbstractAction, NODE, equivalent} from './common';

const ONE = NODE.constant.create(1);

class OneTimesXAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('x*1 -> x', node, path, parent);
    this.result = result;
  }
}

class OneTimesX extends AbstractTransform {
  constructor() {
    super({include: [NODE.multiply.id]});
  }

  testNode(node, path, parent) {
    const [a, b] = node.args;
    return equivalent(ONE, a)
      ? [new OneTimesXAction(node, path, parent, b)]
      : equivalent(ONE, b)
        ? [new OneTimesXAction(node, path, parent, a)]
        : [];
  }
}

export default OneTimesX;
