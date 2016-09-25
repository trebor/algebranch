import _ from 'lodash';
import $ from 'jquery';
import Tree from './tree.js';
const d3 = require('d3');
const math = require('mathjs');
let started = false;

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

const tree = new Tree('#tree')
  .on('nodeMouseenter', nodeEnter)
  .on('nodeMousemove', nodeMove)
  .on('nodeMouseout', nodeOut)
  .on('nodeClick', nodeClick);

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
    tree.data(ex);
    display(ex);
  } catch (error) {
    $errorAlert
      .text(error.toString())
      .css('display','block');
  }
}

function start() {
  started = true;
  $eqInput.val('(2*x)/3==(sqrt(3^2 + 4^2) / (2 * y + 5))/z');
  $eqInput.change();
}

function nodeEnter(node) {
  const $subEqNode = $('#sub-eq');
  $subEqNode.text('$$' + node.data.toTex() + '$$');

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

function showExpression(expression) {
  console.log("expression", expression, expression.toTex(), expression.toString());
  expression.traverse(function (node, path, parent) {
    switch (node.type) {
    case 'OperatorNode': console.log(node.type, node.op);    break;
    case 'ConstantNode': console.log(node.type, node.value); break;
    case 'FunctionNode': console.log(node.type, node.name);  break;
    case 'SymbolNode':   console.log(node.type, node.name);  break;
    default:             console.log(node.type);
    }
  });
}

function display(expression) {
  const $eqNode = $('#eq');
  $eqNode.text('$$' + expression.toTex() + '$$');

  MathJax.Hub.Typeset($eqNode.get(0), function() {
    var domNode = $(treatNodes($eqNode));
  });
}

const MATH_JAX_NOTE_SELECTOR='[id*="MJXc-Node"]';
const FILTER_NODES = ['mjx-mrow', 'mjx-texatom'];

function treatNodes($eqNode) {
  const nodes = $eqNode.find(MATH_JAX_NOTE_SELECTOR)
    .css('cursor', 'pointer')
    .mouseover(function() {
      const node = $(this);
      node.css('background-color', 'rgba(0, 0, 255, 0.10)');
      collect(node);
    })
    .mouseleave(function() {
      clearCollection();
    })
    .mouseout(function() {
      clearCollection();
      $(this).css('background-color', '');
    })
    .filter(function(d) {
      const node = $(this);
      return FILTER_NODES.reduce((bool, name) => bool && !node.hasClass(name), true);
    })
    .each(function(d) {
      const node = $(this);
      /* console.log(node.attr('id'), node.attr('class'), node.text());*/
    });

  return nodes[0];
}

let nodes = [];

let showNodes = _.debounce(function(nodes) {
  // console.log("nodes[0].text()", nodes[0].text());
  /* nodes.forEach(node => {
   *   console.log("node.text()", node.text(), node.attr('id'));
   * });*/
}, 100);

function collect(node) {
  nodes.push(node);
  showNodes(nodes);
}

function clearCollection() {
  nodes = [];
}

// var ap = new AbstractPattern();

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


// setTimeout(() => {
//   console.log("MathJax", MathJax);
//   // var el = MathJax.ElementJax;
//   // // el.Text('x = (-b +- sqrt(b^2-4ac))/(2a)');
//   // console.log("el", el);

//   var math = MathJax.Hub.getAllJax("eq")[0];
//   console.log("math", math);
//   // MathJax.Hub.Queue(['Text', math, 'a=b/c']);
// }, 1000);
