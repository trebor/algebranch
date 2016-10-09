const math = require('mathjs');

const NODE_TYPE = {
  operator: 'OperatorNode',
  function: 'FunctionNode',
  symbol:   'SymbolNode',
};

const NODE_ID = {
  equal:    [NODE_TYPE.operator, 'equal'   ].join(':'),
  multiply: [NODE_TYPE.operator, 'multiply'].join(':'),
};

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

  set result(result) {
    this._result = result;
  }

  apply(expression) {
    this.applied = true;
  }
}

class AbstractTransform {

  constructor(types) {
    Object.assign(this, types);
  }

  test(node, path, parent) {
    throw new TypeError('test() is abstract, please implement.');
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

export {AbstractTransform, AbstractAction, NODE_TYPE, NODE_ID};


