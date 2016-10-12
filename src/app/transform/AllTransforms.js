import _ from 'lodash';
import {NODE} from './common';

import Commutative from './Commutative';
import CommutativeAcrossEquals from './CommutativeAcrossEquals';
import DoubleNegative from './DoubleNegative';
import MultiplyDivide from './MultiplyDivide';
import NoncommutativeAcrossEquals from './NoncommutativeAcrossEquals';
import OneTimesX from './OneTimesX';
import SimplifyToInteger from './SimplifyToInteger';
import SquareBothSides from './SquareBothSides';
import SqrtOfSquare from './SqrtOfSquare';
import XMinusX from './XMinusX';
import XOverOne from './XOverOne';
import XOverX from './XOverX';

const ALL_TRANSFORMS = [
  new CommutativeAcrossEquals(NODE.multiply, NODE.divide),
  new CommutativeAcrossEquals(NODE.add, NODE.subtract),
  new NoncommutativeAcrossEquals(NODE.divide, NODE.multiply),
  new NoncommutativeAcrossEquals(NODE.subtract, NODE.add),
  new SimplifyToInteger(),
  new DoubleNegative(),
  new OneTimesX(),
  new SquareBothSides(),
  new SqrtOfSquare(),
  new XMinusX(),
  new XOverOne(),
  new XOverX(),
  new Commutative(NODE.add),
  new Commutative(NODE.multiply),
  new Commutative(NODE.equal),
];

export default function establishNodeActions(node, path, parent) {
  const actionMap = _
    .flatten(ALL_TRANSFORMS.map(pattern => pattern.test(node, path, parent)))
    .reduce((map, action) => {
      map[action.result.toString()] = action;
      return map;
    }, {});

  return Object.keys(actionMap).map(key => actionMap[key]);
}
