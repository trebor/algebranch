import _ from 'lodash';
import $ from 'jquery';
import Tree from './tree.js';
const d3 = require('d3');
const math = require('mathjs');
let started = false;
import {EXPRESSION_TO_MATHJAX, ComputeExpressionSize} from './util.js';
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
const $popup = $('#popup');
const $body = $('body');

let expression = null;

$eqInput.on('change', d => {
  updateExpression(d.target.value);
});

const tree = new Tree('#tree', {nodeId})
  .on('nodeMouseenter', nodeEnter)
  .on('actionMouseenter', actionEnter)
  .on('actionClick', actionClick)
  .on('actionMouseout', actionOut);

function start() {
  started = true;
  $eqInput.val('x==(1+2)*sqrt(16)/4*(3+2*7)');
  /* $eqInput.val('(2*x)/3==(sqrt(pi^2 + log(4)) / (2 * 7 + 5))/z');*/
  /* $eqInput.val('(2 + (2 * 4))/5');*/
  $eqInput.change();
}

const nodeId = (d, i) => {
  return d.data.comment;
};

function actionEnter(action) {
  showPopup(action.name);
}

function actionClick(action) {
  hidePopup();
  expression = action.apply(expression);
  display(expression);
}

function actionOut(action) {
  hidePopup();
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

function showPopup(expressionText) {
  const expression = math.parse(expressionText);
  const mouseX = d3.event.clientX;
  const mouseY = d3.event.clientY;
  const isLeft = mouseX < $body.width() / 2;
  const isUp = mouseY < $body.height() / 2;

  $popup.width(200);
  $popup.height(200);

  $popup.text(EXPRESSION_TO_MATHJAX(expression));
  MathJax.Hub.Typeset($popup.get(0), () => {
    const mjxSize = ComputeExpressionSize($popup);

    $popup.width(mjxSize.width);
    $popup.height(mjxSize.height);

    const offset = 30;

    const width = $popup.outerWidth();
    const height = $popup.outerHeight();

    const x = mouseX + (isLeft ? offset : -(width + offset));
    const y = mouseY + (isUp ? offset : -(height + offset));

    $popup.css('left', x + 'px');
    $popup.css('top', y + 'px');
    $popup.css('visibility', 'visible');
  });
}

function hidePopup() {
  $popup.css('visibility', 'hidden');
}

function genUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}
