import {AbstractTransform, AbstractAction, NODE, equivalent} from './common';
const math = require('mathjs');
const {OperatorNode, FunctionNode, SymbolNode, ParenthesisNode, ConstantNode} = math.expression.node;

class GeneralAction extends AbstractAction {
  constructor(node, path, parent, result) {
    super("general", node, path, parent);
    this.result = result;
  }
}

class General extends AbstractTransform {
  constructor(targetStr, resultStr, swap = false) {
    super();
    this.targetStr = targetStr;
    this.resultStr = resultStr;
    this.swap = swap;
  }

  testNode(node, path, parent) {
    const symbolMap = {};
    if (this.match(this.getTarget(), node, symbolMap)) {
      return [new GeneralAction(node, path, parent,
        this.apply(this.getResult(), symbolMap))];
    }

    return [];
  }

  getTarget() {
    return this.parseExpression(this.targetStr, this.swap);
  }

  getResult() {
    return this.parseExpression(this.resultStr, this.swap);
  }

  parseExpression(string, swap) {
    const expr = math.parse(string);
    if (swap) {
      const tmp = expr.args[0];
      expr.args[0] = expr.args[1];
      expr.args[1] = tmp;
    }
    return expr;
  }

  match(target, candidate, symbolMap) {
    return this[`match${target.type}`](target, candidate, symbolMap);
  }

  matchOperatorNode(target, candidate, symbolMap) {
    // console.log("matchOperatorNode",
    //   target.toString(), candidate.toString());

    if (target.getIdentifier() != candidate.getIdentifier())
      return false;

    if (target.args.length != candidate.args.length)
      return false;

    return !target.args.some((d, i) => {
      return !this.match(target.args[i], candidate.args[i], symbolMap);
    });
  }

  matchFunctionNode(target, candidate, symbolMap) {
    console.log("matchFunctionNode",
      target.toString(), candidate.toString());
    return false;
  }

  matchConstantNode(target, candidate, symbolMap) {
    return equivalent(target, candidate);
  }

  matchSymbolNode(target, candidate, symbolMap) {
    // console.log("matchSymbolNode",
    //   target.toString(), candidate.toString());

    const { name } = target;
    const value = symbolMap[name];

    if (!value) {
      symbolMap[name] = candidate;
      return true;
    }

    return equivalent(value, candidate);
  }

  apply(result, symbolMap) {
    return this[`apply${result.type}`](result, symbolMap);
  }

  applyOperatorNode(result, symbolMap) {
    result.args.forEach((arg, i) => {
      result.args[i] = this.apply(arg, symbolMap);
    });

    return result;
  }

  applyFunctionNode(result, symbolMap) {
    console.log("applyFunctionNode", result.toString());
    return result;
  }

  applyConstantNode(result, symbolMap) {
    return result;
  }

  applySymbolNode(result, symbolMap) {
    return symbolMap[result.name];
  }
}

export default General;
