const math = require('mathjs');

const {OperatorNode, FunctionNode, SymbolNode, ParenthesisNode, ConstantNode} = math.expression.node;

const NODE_TYPE = {
  operator:    'OperatorNode',
  function:    'FunctionNode',
  symbol:      'SymbolNode',
  parenthesis: 'ParenthesisNode',
};

const NODE_TYPE2 = {
  operator:    OperatorNode,
  function:    FunctionNode,
  symbol:      SymbolNode,
  parenthesis: ParenthesisNode,
};

const NODE_ID = [
  {name: 'equal',       parts: [NODE_TYPE.operator, 'equal'     ]},
  {name: 'multiply',    parts: [NODE_TYPE.operator, 'multiply'  ]},
  {name: 'divide',      parts: [NODE_TYPE.operator, 'divide'    ]},
  {name: 'add',         parts: [NODE_TYPE.operator, 'add'       ]},
  {name: 'subtract',    parts: [NODE_TYPE.operator, 'subtract'  ]},
  {name: 'unaryMinus',  parts: [NODE_TYPE.operator, 'unaryMinus']},
  {name: 'pow',         parts: [NODE_TYPE.operator, 'pow'       ]},
  {name: 'sqrt',        parts: [NODE_TYPE.function, 'sqrt'      ]},
  {name: 'parenthesis', parts: [NODE_TYPE.parenthesis           ]},
].reduce((map, id) => {map[id.name] = id.parts.join(':'); return map;}, {});

class Node {
  constructor({key, type, subType, op}) {
    Object.assign(this, {key, type, subType, op});
    this.id = subType ? [type.prototype.type, subType].join(':') : type.prototype.type;
  }

  is(node) {
    return node.getIdentifier() == this.id;
  }

  create(children) {
    switch (this.type) {
      case OperatorNode:
        return new OperatorNode(this.op, this.subType, children);
      case FunctionNode:
        return new FunctionNode(new SymbolNode(this.subType), children);
      case ConstantNode:
        return new ConstantNode(children);
      default:
        return null;
    }
  }
}

export const NODE = [
  {key: 'equal',       type: OperatorNode,    subType: 'equal'     , op: '=='  },
  {key: 'multiply',    type: OperatorNode,    subType: 'multiply'  , op: '*'   },
  {key: 'divide',      type: OperatorNode,    subType: 'divide'    , op: '/'   },
  {key: 'add',         type: OperatorNode,    subType: 'add'       , op: '+'   },
  {key: 'subtract',    type: OperatorNode,    subType: 'subtract'  , op: '-'   },
  {key: 'unaryMinus',  type: OperatorNode,    subType: 'unaryMinus', op: '-'   },
  {key: 'pow',         type: OperatorNode,    subType: 'pow'       , op: '^'   },
  {key: 'sqrt',        type: FunctionNode,    subType: 'sqrt'      , op: null  },
  {key: 'parenthesis', type: ParenthesisNode, subType: null        , op: null  },
  {key: 'constant',    type: ConstantNode,    subType: null        , op: null  },
].reduce((map, d) => {map[d.key] = new Node(d); return map;}, {});

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
