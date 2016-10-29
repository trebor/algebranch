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
    this.customFunctions = {
      '_isInt': this.isInt,
      '_toInt': this.toInt,
    }
  }

  isInt(candidate) {
    if (!NODE.constant.is(candidate)) {
      try {
        const value = candidate.eval();
        if (value % 1 === 0)
          return true;
      } catch(e) {}
    }

    return false;
  }

  toInt(candidate) {
    try {
      return NODE.constant.create(candidate.eval());
    } catch(e) {}
    return null;
  }

  title() {
    return `${this.targetStr}  ->  ${this.resultStr}`;
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

  matchParenthesisNode(target, candidate, symbolMap) {
    const targetContent = target.content;
    const candidateContent = NODE.parenthesis.is(candidate)
      ? candidate.content
      : candidate;

    return !targetContent.args.some((d, i) => {
      return !this.match(
        targetContent, candidateContent, symbolMap);
    });
  }

  matchOperatorNode(target, candidate, symbolMap) {
    if (target.getIdentifier() != candidate.getIdentifier())
      return false;

    if (target.args.length != candidate.args.length)
      return false;

    return !target.args.some((d, i) => {
      return !this.match(target.args[i], candidate.args[i], symbolMap);
    });
  }

  matchFunctionNode(target, candidate, symbolMap) {

    const fn = this.customFunctions[target.name];

    if (fn && fn(candidate)) {
      return this.match(target.args[0], candidate, symbolMap);
    }
    else if (target.name != candidate.name) {
      return false;
    }

    return !target.args.some((d, i) => {
      return !this.match(target.args[i], candidate.args[i], symbolMap);
    });
  }

  matchConstantNode(target, candidate, symbolMap) {
    return equivalent(target, candidate);
  }

  matchSymbolNode(target, candidate, symbolMap) {
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
    const fn = this.customFunctions[result.name];

    if (fn) {
      return fn(this.apply(result.args[0], symbolMap));
    }

    result.args.forEach((arg, i) => {
      result.args[i] = this.apply(arg, symbolMap);
    });
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
