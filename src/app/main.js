import _ from 'lodash';
import $ from 'jquery';
import Tree from './tree.js';
const d3 = require('d3');
const math = require('mathjs');
let started = false;
const EXPRESSION_TO_MATHJAX = d => '\\(' + d.toTex() + '\\)';


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
const $popup = $('#popup');

const tree = new Tree('#tree');
/* .on('nodeMouseenter', nodeEnter)
 * .on('nodeMousemove', nodeMove)
 * .on('nodeMouseout', nodeOut)
 * .on('nodeClick', nodeClick);
 */
$eqInput
  .on('change', d => {
    updateExpression(d.target.value);
  });

$eqDisplay
  .on('click', d => {
    updateExpression($eqInput.val());
  });

function updateExpression(expressionText) {
  try {
    $errorAlert.css('display','none');
    var ex = math.parse(expressionText);
    display(ex);
    tree.data(ex);
  } catch (error) {
    $errorAlert
      .text(error.toString())
      .css('display','block');
  }
}

function display(expression) {
  const $eqNode = $('#eq');
  $eqNode.text(EXPRESSION_TO_MATHJAX(expression));

  MathJax.Hub.Typeset($eqNode.get(0));
}

function start() {
  started = true;
  $eqInput.val('(2*x)/3==(sqrt(3^2 + 4^2) / (2 * y + 5))/z');
  $eqInput.change();
}

function nodeEnter(node) {
  const $subEqNode = $('#sub-eq');
  $subEqNode.text(EXPRESSION_TO_MATHJAX(node.data));

  MathJax.Hub.Typeset($subEqNode.get(0), () => {
    $popup.css('visibility', 'visible');
  });
}

function nodeMove(node) {
  const options = tree.options();
  $popup
    .css('left', d3.event.clientX - $popup.width() / 2
      + options.margin.left / 2)
    .css('top', d3.event.clientY - $popup.height()
      - options.circleRadius + options.margin.top);
}

function nodeOut(node) {
  $popup.css('visibility', 'hidden');
}

function nodeClick(node) {
  console.log("node.data.toTex()", node.data.toTex());
  console.log("node", node);
}

class AbstractPattern {
  constructor() {
  }

  findActions(node) {
    throw new TypeError('test() is abstract, please implement');
  }
}

// patters which operate across an equals method

class AcrossEquals extends AbstractPattern {
  findActions(node) {
    return node.type == 'AssignmentNode' ? [] : null;
  }
}
