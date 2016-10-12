import {AbstractTransform, AbstractAction, NODE_ID, NODE} from './common';
const math = require('mathjs');

class SquareBothSidesAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super('sqrt(x) == y -> x == y ^ 2', node, path, parent);
    this.result = result;
  }
}
class SquareBothSides extends AbstractTransform {
  constructor() {
    super({include: [NODE.equal.id]});
  }

  testNode(node, path, parent) {
    const [a, b] = node.args;
    let result = null;

    if (NODE.sqrt.is(a)) {
      result = NODE.equal.create([
        a.args[0],
        NODE.pow.create([b, NODE.constant.create(2)])
      ]);
    } else if (NODE.sqrt.is(b)) {
      result = NODE.equal.create([
        NODE.pow.create([a, NODE.constant.create(2)]),
        b.args[0]
      ]);
    }

    return result
      ? [new SquareBothSidesAction(node, path, parent, result)]
      : [];
  }

  squareBothSides(sqrt, other) {
  }
}

export default SquareBothSides;
