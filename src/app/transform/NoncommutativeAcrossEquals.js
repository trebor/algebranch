import {AbstractTransform, AbstractAction, NODE_ID} from './common';
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
  constructor(targetId, resultFactory) {
    super({include: [NODE_ID.equal]});
    this.targetId = targetId;
    this.resultFactory = resultFactory;
  }

  testNode(node, path, parent) {
    let actions = [];
    node.forEach((cNode) => {
      if (cNode.getIdentifier() == this.targetId) {
        cNode.forEach((gcNode, path, child, i) => {
          if (path == 'args[1]') {
            actions.push(new CommutativeAcrossEqualsAction(
              node, path, parent, cNode, gcNode, this.resultFactory));
          }
        });
      }
    });

    return actions;
  }
}

export default CommutativeAcrossEquals;
