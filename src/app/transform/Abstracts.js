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

// patters which operate across an equals method

/* class AcrossEquals extends AbstractPattern {
 *   test(node, path, parent) {
 *     return node.type == 'AssignmentNode' ? [] : null;
 *   }
 * }
 * */

export {AbstractTransform, AbstractAction};


