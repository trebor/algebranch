import {AbstractTransform, AbstractAction, NODE_ID} from './Abstracts';
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

  apply(expression) {
    super.apply(expression);
    return expression.transform(node => {
      return node == this.node ? this.result : node;
    });
  }
}

class CommutativeAcrossEquals extends AbstractTransform {
  constructor(targetId, resultFactory) {
    super({include: [NODE_ID.equal]});
    this.targetId = targetId;
    this.resultFactory = resultFactory;
  }

  test(node, path, parent) {
    if (!this.isPermittedType(node, path, parent)) return [];
    let actions = [];
    node.forEach((cNode) => {
      if (cNode.getIdentifier() == this.targetId) {
        cNode.forEach((gcNode) => {
          actions.push(new CommutativeAcrossEqualsAction(
            node, path, parent, cNode, gcNode, this.resultFactory));
        });
      }
    });

    return actions;
  }
}

export default CommutativeAcrossEquals;
