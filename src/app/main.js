import _ from 'lodash';
import $ from 'jquery';
import Tree from './tree.js';
const d3 = require('d3');
const math = require('mathjs');
let started = false;
import {EXPRESSION_TO_MATHJAX} from './util.js';
import Patterns from './patterns.js';

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

const tree = new Tree('#tree', {nodeId})
  .on('nodeMouseenter', nodeEnter)
  .on('actionMouseenter', actionEnter)
  .on('actionClick', actionClick);


function start() {
  started = true;
  $eqInput.val('x==(1+2)*sqrt(16)/4*(3y+2*7)');
  /* $eqInput.val('(2*x)/3==(sqrt(pi^2 + log(4)) / (2 * 7 + 5))/z');*/
  /* $eqInput.val('(2 + (2 * 4))/5');*/
  $eqInput.change();
}

const nodeId = (d, i) => {
  return d.data.comment;
};

function actionEnter(action) {
  console.log("action.getName()", action.name);
}

function actionClick(action) {
  expression = action.apply(expression);
  display(expression);
}

$eqDisplay.on('click', d => updateExpression($eqInput.val()));

function updateExpression(expressionText) {
  try {
    $errorAlert.css('display','none');
    expression = math.parse(expressionText);
  } catch (error) {
    $errorAlert
      .text(error.toString())
      .css('display','block');
  }

  display(expression);
}

function display(expression) {
  const $eqNode = $('#eq');

  // add content to expression for rendering

  expression.traverse((node, path, parent) => {
    node.comment = (parent ? parent.comment + ':' : '') + (path || 'root') + node.toString();
    node.actions = _.flatten(
      Patterns.map(pattern => pattern.test(node, path, parent))
    );
    node.shouldRender = () => {
      let render = node.actions.length > 0;
      if (!render) {
        node.forEach(child => {
          if (child.shouldRender())
            render = true;
        });
      }
      return render;
    };
  });

  $eqInput.val(expression.toString());

  $eqNode.text(EXPRESSION_TO_MATHJAX(expression));
  MathJax.Hub.Typeset($eqNode.get(0));
  tree.data(expression);
}

function nodeEnter() {}
function nodeMove() {}
function nodeOut() {}
function nodeClick() {}

function genUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}
