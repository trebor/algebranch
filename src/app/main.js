import $ from 'jquery';
import { NODE, parseExpression } from './transform/common';
import Tree from './tree';
import History from './History';
import url from 'urljs';


const math = require('mathjs');
let started = false;
import {EXPRESSION_TO_MATHJAX, EXPRESSION_TO_MATHJAX_INLINE, ComputeExpressionSize} from './util.js';
import establishNodeActions from './transform/AllTransforms.js';

const TEST_EXPRESSIONS = [

  '2 * x + x * 3 == (sqrt(pi^2) * y) / (4 + log(e)) * z',

  'x * y',

  'x * 5 / x == y * (3 * x + 7) / (3 * x + 7)',

  'x==(1+2)*sqrt(16)/log(e)*(3+2*7)',

  'a == b / c + d',

  'y == (2 * x) - (3 * y)',

  '(3 * 1) / 1 * x ^ 2 + (z - z) == (2 + y) / (2 + y)',

  'x / (3 + 2 * 7) * 4 / sqrt(16) == (1 + 2)',
  '(2*x)+3==sqrt(pi^2 + log(e)) * (2 * 7 + 5)',
  '(2 + (2 * 4))/5',
];

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

const history = new History('#history')
  .on('select', ex => {
    history.pop(ex);
    display(expression = ex);
  })
  .on('back', () => {
    history.pop();
    display(expression = history.peek());
  })
  .on('forward', () => {
    history.forward();
    display(expression = history.peek());
  });

$eqInput.on('change', d => {
  updateExpression(d.target.value);
});

const nodeId = (d, i) => {
  return d.data.custom;
};

const tree = new Tree('#tree', {nodeId})
  .on('nodeClick', nodeClick)
  .on('actionMouseenter', actionEnter)
  .on('actionClick', actionClick)
  .on('actionMouseout', actionOut);

function start() {
  started = true;
  $eqInput.val(url.queryString('eq')
    ? decodeURIComponent(url.queryString('eq'))
    : TEST_EXPRESSIONS[0]);
  $eqInput.change();
}

function actionEnter(action) {
  if (!action.applied) {
    tree.previewAction(action);
  }
}

function actionOut(action) {
  if (!action.applied) {
    tree.hidePreview(action);
  }
}

function actionClick(action) {
  tree.choosePreview(action);
  expression = action.apply(expression);
  history.push(expression);
  display(expression);
}

$eqDisplay.on('click', d => updateExpression($eqInput.val()));

function updateExpression(expressionText) {
  if (stripWhite(expressionText).length == 0) {
    return;
  }

  try {
    $errorAlert.css('display','none');
    expression = parseExpression(expressionText);

    history.clear();
    history.push(expression);
    display(expression);
  } catch (error) {
    $errorAlert
      .text(error.toString())
      .css('display','block');
  }
}

function display(expression) {
  const $eqNode = $('#eq');

  // add content to expression for rendering

  expression.traverse((node, path, parent) => {
    node.custom = node.custom || genUuid();
    node.actions = establishNodeActions(node, path, parent);
    node.shouldRender = () => {
      return true;
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

  url.updateSearchParam('eq',
    encodeURIComponent(stripWhite(expression.toString())));
  $eqInput.val(expression.toString());

  $eqNode.text(EXPRESSION_TO_MATHJAX(expression));
  MathJax.Hub.Typeset($eqNode.get(0));
  tree.data(expression);
}

function stripWhite(string) {
  return string.replace(/ /g,'');
}

function nodeEnter() {}
function nodeMove() {}
function nodeOut() {}
function nodeClick(node) {
  // console.log(node.data.custom, node.data.toString(), node.data.getIdentifier());
}

function showPopup(expressionText) {
  const expression = math.parse(expressionText);
  const mouseX = null; // d3.event.clientX;
  const mouseY = null; // d3.event.clientY;
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
