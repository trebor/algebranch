import {AbstractTransform, AbstractAction, NODE_ID} from './Abstracts';
const math = require('mathjs');

class DivideAcrossEqualsAction extends AbstractAction {
  constructor(eqNode, path, eqParent, multNode, operandNode) {
    super('', eqNode, path, eqParent);

    this.result = eqNode.map((cNode) => {
      if (cNode == multNode) {
        let newNode = null;
        cNode.forEach((gcNode) => {
          if (gcNode != operandNode) {
            newNode = gcNode;
          }
        });
        return newNode;
      }
      else {
        return new math.expression.node.OperatorNode(
          '/', 'divide', [cNode, operandNode]);
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

class DivideAcrossEquals extends AbstractTransform {
  constructor() {
    super({include: [NODE_ID.equal]});
  }

  test(node, path, parent) {
    if (!this.isPermittedType(node, path, parent)) return [];
    let actions = [];
    node.forEach((cNode) => {
      if (cNode.getIdentifier() == NODE_ID.multiply) {
        cNode.forEach((gcNode) => {
          actions.push(
            new DivideAcrossEqualsAction(node, path, parent, cNode, gcNode)
          );
        });
      }
    });

    return actions;
  }
}

export default DivideAcrossEquals;
