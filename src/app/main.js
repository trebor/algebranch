import _ from 'lodash';
import $ from 'jquery';
import Tree from './tree.js';
const d3 = require('d3');
const math = require('mathjs');
let started = false;
import {EXPRESSION_TO_MATHJAX} from './util.js';

const interval = setInterval((x) => {
  if (window.MathJax) {
    clearInterval(interval);
    MathJax.Hub.signal.Interest(
      function (message) {
        if (!started && message[0] == 'End Process') {
          start();
        }
      }
    );
  }
}, 200);

const $eqInput = $('#eq-input');
const $eqDisplay = $('#eq-display');
const $errorAlert = $('#error-alert');
let expression = null;

$eqInput.on('change', d => {
  updateExpression(d.target.value);
});

function start() {
  started = true;
  /* $eqInput.val('x==1+2');*/
  $eqInput.val('(2*x)/3==(sqrt(pi^2 + log(4)) / (2 * y + 5))/z');
  /* $eqInput.val('(2 + (2 * 4))/5');*/
  $eqInput.change();
}

const nodeId = (d, i) => {
//  console.log("d.data.comment", d.data.comment);
  return d.data.comment;
  /* return i + 1;*/
};

const tree = new Tree('#tree', {nodeId})
  .on('nodeMouseenter', nodeEnter)
/* .on('nodeMousemove', nodeMove)
 * .on('nodeMouseout', nodeOut)*/
  .on('nodeClick', nodeClick)
  .on('actionMouseenter', actionEnter);

function actionEnter(action) {
  console.log("action", action);
}

$eqDisplay.on('click', d => updateExpression($eqInput.val()));

function updateExpression(expressionText) {
  try {
    $errorAlert.css('display','none');
    expression = math.parse(expressionText);

    display(expression);
  } catch (error) {
    $errorAlert
      .text(error.toString())
      .css('display','block');
  }
}

function display(expression) {
  const $eqNode = $('#eq');

  expression.traverse((node, path, parent) => {
    node.comment = (parent ? parent.comment + ':' : '') + (path || 'root');
    node.actions = d3.range(2 + Math.round(Math.random() * 2));
  });

  $eqInput.val(expression.toString());

  $eqNode.text(EXPRESSION_TO_MATHJAX(expression));
  MathJax.Hub.Typeset($eqNode.get(0));
  tree.data(expression);
}

function nodeEnter(node) {
  console.log(node.data.toString(), node.data);
}
function nodeMove(node) {}
function nodeOut(node) {}
function nodeClick(uiNode) {
  const node = uiNode.data;
  const parent = getParent(expression, node);
  if (parent) {
    const gParent = getParent(expression, parent);
    if (gParent) {
      expression = removeNode(gParent, parent, node);
      display(expression);
    }
  }
}

function removeNode(grandParent, parent, condemned) {
  const sibling = getSiblings(parent, condemned)[0];
  const newGp = grandParent.map(d => d == parent ? sibling : d);
  return expression.transform(d => d == grandParent ? newGp : d);
}

function getParent(expression, target) {
  let result = null;
  expression.traverse((candidate, path, parent) => {
    if (candidate == target) {
      result = parent;
    }
    return candidate;
  });
  return result;
}

function getSiblings(parent, target) {
  let result = [];
  parent.forEach((child, path, parent) => {
    if (child != target) {
      result.push(child);
    }
  });
  return result;
}

function genUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

class AbstractPattern {
  match(node) {
    throw new TypeError('test() is abstract, please implement');
  }
}

// patters which operate across an equals method

class AcrossEquals extends AbstractPattern {
  match(node) {
    return node.type == 'AssignmentNode' ? [] : null;
  }
}
