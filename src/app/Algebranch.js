import $ from 'jquery';
import Tree from './component/Tree';
import History from './component/History';
import url from './util/url.js';
import IdentityManager from './identity/IdentityManager';
import { parseExpression } from './util/mathjs-helper';
const math = require('mathjs');

const TEST_EXPRESSIONS = [

  // 'x * y',

  //  'sin(3 + 2 * y) ^ 2 + cos(3 + 2 * y) ^ 2',
  //  'cos(3 + 2 * y) ^ 2 + sin(3 + 2 * y) ^ 2',

  'a == b / c + d',

  '2 * x + x * 3 == (sqrt(pi^2) * y) / (4 + log(e)) * z',

  'x * 5 / x == y * (3 * x + 7) / (3 * x + 7)',

  'x==(1+2)*sqrt(16)/log(e)*(3+2*7)',


  'y == (2 * x) - (3 * y)',

  '(3 * 1) / 1 * x ^ 2 + (z - z) == (2 + y) / (2 + y)',

  'x / (3 + 2 * 7) * 4 / sqrt(16) == (1 + 2)',
  '(2*x)+3==sqrt(pi^2 + log(e)) * (2 * 7 + 5)',
  '(2 + (2 * 4))/5',
];

class Algebranch {
  constructor() {
    this.identityManager = new IdentityManager();
    this.$eqInput = $('#eq-input');
    this.$eqDisplay = $('#eq-display')
      .on('click', d => this.updateExpression($eqInput.val()));
    this.$errorAlert = $('#error-alert');
    this.$popup = $('#popup');
    this.$body = $('body');

    this.expression = null;

    this.history = new History('#history')
      .on('select', ex => {
        this.history.skipTo(ex);
        this.display(this.expression = this.history.peek(), true);
      })
      .on('back', () => {
        this.history.pop();
        this.display(this.expression = this.history.peek(), true);
      })
      .on('forward', () => {
        this.history.forward();
        this.display(this.expression = this.history.peek(), true);
      });

    this.$eqInput.on('change', d => {
      this.updateExpression(d.target.value
        .replace(/=\s*=/g, '=')
        .replace('=', '=='));
    });

    this.nodeId = (d, i) => {
      return d.data.custom;
    };

    [
      'actionEnter',
      'actionOut',
      'actionClick',
    ].forEach(method => this[method] = this[method].bind(this));

    this.tree = new Tree('#tree', {nodeId: this.nodeId})
      .on('nodeClick', this.nodeClick)
      .on('actionMouseenter', this.actionEnter)
      .on('actionClick', this.actionClick)
      .on('actionMouseout', this.actionOut);

    this.$eqInput.val(url.queryString('eq')
      ? decodeURIComponent(url.queryString('eq'))
      : TEST_EXPRESSIONS[0]);
    this.$eqInput.change();
  }

  updateExpression(expressionText) {
    if (this.stripWhite(expressionText).length == 0) {
      return;
    }

    try {
      this.$errorAlert.css('display','none');
      this.expression = parseExpression(expressionText);

      this.history.clear();
      this.history.push(this.expression);
      this.display(this.expression);
    } catch (error) {
      this.$errorAlert
        .text(error.toString())
        .css('display','block');
    }
  }

  prep(expression) {
    expression.traverse((node, path, parent) => {
      node.custom = node.custom || this.genUuid();
      node.actions = this.identityManager.establishNodeActions(node, path, parent);
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
  }

  display(expression, bypassPrep) {

    if (!bypassPrep) {
      this.prep(expression);
    }

    url.updateSearchParam('eq',
      encodeURIComponent(this.stripWhite(expression.toString())));
    this.$eqInput.val(expression.toString());
    this.tree.data(expression);
  }

  stripWhite(string) {
    return string.replace(/ /g,'');
  }

  nodeEnter() {}
  nodeMove() {}
  nodeOut() {}
  nodeClick() {}

  actionEnter(action) {
    this.tree.previewAction(action, true);
  }

  actionOut(action) {
    this.tree.previewAction(action, false);
  }

  actionClick(action) {
    action.applied = true;
    this.tree.choosePreview(action);
    this.expression = action.apply(this.expression);
    this.history.push(this.expression);
    this.display(this.expression);
  }

  genUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }
}

export default Algebranch;
