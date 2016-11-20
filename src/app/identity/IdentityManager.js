import _ from 'lodash';
import math from 'mathjs';
import General from './General';
import IDENTITIES from './identities';
import { parseExpression } from '../util/mathjs-helper';

class IdentityManager {
  constructor() {
    this.testIdentities(IDENTITIES);
    this.compileIdentities(IDENTITIES);
  }

  testIdentities(identities) {
    identities.forEach(([input, output, commutative, tests]) => {
      tests.forEach(test => this.testIdentity(
        new General(input, output), test));
    });
  }

  testIdentity(identity, [inputStr, outputStr]) {
    let actions = [];
    const input = math.parse(inputStr);
    input.traverse((node, path, parent) => {
      actions = actions.concat(identity.test(node, path, parent));
    });

    const result = actions[0] ? actions[0].apply(input) : 'no action';
    if (outputStr != result.toString()) {
      const message = `Identity: ${identity.title()}\n`
        + `  Tested:   ${inputStr}\n`
        + `  Expected: ${outputStr}\n`
        + `  Found:    ${result.toString()}`;
      alert(message);
    }
  }

  compileIdentities(identities) {
    this.ALL_TRANSFORMS = _(identities)
      .map(([input, output, swapable]) => (swapable ? [false, true] : [false])
        .map(swap => new General(input, output, swap)))
      .flatten()
      .valueOf();
  }

  establishNodeActions(node, path, parent) {
    const actionMap = _
      .flatten(this.ALL_TRANSFORMS.map(pattern => pattern.test(node, path, parent)))
      .reduce((map, action) => {
        map[action.result.toString()] = action;
        return map;
      }, {});

    return Object.keys(actionMap).map(key => actionMap[key]);
  }
}

export default IdentityManager;
