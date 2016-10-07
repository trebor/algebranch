const math = require('mathjs');

class AbstractAction {
  constructor(name, node, path, parent) {
    this.name = name;
    this.node = node;
    this.path = path;
    this.parent = parent;
  }

  apply(expression) {
    throw new TypeError('apply() is abstract, please implement');
  }
}

class AbstractPattern {
  test(node, path, parent) {
    throw new TypeError('test() is abstract, please implement');
  }
}

// patters which operate across an equals method

class AcrossEquals extends AbstractPattern {
  test(node, path, parent) {
    return node.type == 'AssignmentNode' ? [] : null;
  }
}

class SimplifyToNumberAction extends AbstractAction {
  constructor(name, node, path, parent, value) {
    super(name, node, path, parent);
    this.value = value;
  }

  apply(expression) {
    return expression.transform(node => {
      if (node == this.parent) {
        return this.parent.map(child => child == this.node
          ? new math.expression.node.ConstantNode(this.value)
          : child);
      }
      return node;
    });
  }
}

class SimplifyToNumber extends AbstractPattern {
  test(node, path, parent) {
    let actions = [];

    if (['ConstantNode', 'SymbolNode'].indexOf(node.getIdentifier()) == -1) {
      try {
        const value = node.eval();
        if (!isNaN(value) && value % 1 === 0) {
          actions.push(new SimplifyToNumberAction(
            node.toString() + ' to ' + value, node, path, parent, value
          ));
        }
      }
      catch (error) {}
    }

    return actions;
  }
}

export default [
  new SimplifyToNumber(),
];

