import {AbstractTransform, AbstractAction, NODE} from './common';
const math = require('mathjs');

class CommutativeAcrossEqualsAction extends AbstractAction {
  constructor(eqNode, path, eqParent, opNode, operandNode, resultFactory) {
    super('', eqNode, path, eqParent);

    this.result = eqNode.map((cNode) => {
      if (cNode == opNode) {
        let newNode = null;
        cNode.forEach((gcNode) => {
          if (gcNode != operandNode) {
            newNode = gcNode;
          }
        });
        return newNode;
      }
      else {
        return resultFactory([cNode, operandNode]);
      }
    });
  }
}

class CommutativeAcrossEquals extends AbstractTransform {
  constructor(target, result) {
    super({include: [NODE.equal.id]});
    this.target = target;
    this.result = result;
  }

  testNode(node, path, parent) {
    let actions = [];
    node.forEach((cNode) => {
      if (this.target.is(cNode)) {
        cNode.forEach((gcNode, path, child, i) => {
          if (path == 'args[1]') {
            actions.push(new CommutativeAcrossEqualsAction(
              node, path, parent, cNode, gcNode,
              (children) => this.result.create(children)));
          }
        });
      }
    });

    return actions;
  }
}

export default CommutativeAcrossEquals;
