const math = require('mathjs');

const NODE_TYPE = {
  operator: 'OperatorNode',
  function: 'FunctionNode',
  symbol:   'SymbolNode',
};

const NODE_ID = [
  {name: 'equal',      parts: [NODE_TYPE.operator, 'equal'   ]},
  {name: 'multiply',   parts: [NODE_TYPE.operator, 'multiply']},
  {name: 'divide',     parts: [NODE_TYPE.operator, 'divide'  ]},
  {name: 'add',        parts: [NODE_TYPE.operator, 'add'     ]},
  {name: 'subtract',   parts: [NODE_TYPE.operator, 'subtract']},
  {name: 'unaryMinus', parts: [NODE_TYPE.operator, 'unaryMinus']},
].reduce((map, id) => {map[id.name] = id.parts.join(':'); return map;}, {});

class AbstractAction {
  constructor(name, node, path, parent) {
    this.name = name;
    this.node = node;
    this.path = path;
    this.parent = parent;
    this.applied = false;
  }

  get result() {
    return this._result;
  }

  get target() {
    return this.node;
  }

  set result(result) {
    this._result = result;
  }

  apply(expression) {
    this.applied = true;
    return expression.transform(node => {
      return node == this.node ? this.result : node;
    });
  }
}

class AbstractTransform {

  constructor(types) {
    Object.assign(this, types);
  }

  test(node, path, parent) {
    return this.isPermittedType(node, path, parent)
      ? this.testNode(node, path, parent)
      : [];
  }

  testNode(node, path, parent) {
    throw new TypeError('testNode() is abstract, please implement.');
  }

  isExcluded(node, path, parent) {
    if (this.exclude) {
      if (this.exclude.indexOf(node.getIdentifier()) != -1) {
        return true;
      }
    }
  }

  isIncluded(node, path, parent) {
    if (this.include) {
      if (this.include.indexOf(node.getIdentifier()) != -1) {
        return true;
      }
      return false;
    }
    return true;
  }

  isPermittedType(node, path, parent) {
    if (this.isExcluded(node, path, parent)) {
      return false;
    }
    return this.isIncluded(node, path, parent);
  }
}

function equivalent(nodeA, nodeB) {
  return nodeA.toString() == nodeB.toString();
}

export {AbstractTransform, AbstractAction, NODE_TYPE, NODE_ID, equivalent};
