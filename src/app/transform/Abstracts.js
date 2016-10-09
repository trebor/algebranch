const math = require('mathjs');

const NODE_TYPE = {
  operator: 'OperatorNode',
  function: 'FunctionNode',
  symbol:   'SymbolNode',
};

const NODE_ID = [
  {name: 'equal',    parts: [NODE_TYPE.operator, 'equal'   ]},
  {name: 'multiply', parts: [NODE_TYPE.operator, 'multiply']},
  {name: 'add',      parts: [NODE_TYPE.operator, 'add'     ]},
  {name: 'subtract', parts: [NODE_TYPE.operator, 'subtract']},
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


