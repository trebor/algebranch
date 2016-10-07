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

class AbstractTransform {
  test(node, path, parent) {
    throw new TypeError('test() is abstract, please implement');
  }
}

export {AbstractTransform, AbstractAction};

