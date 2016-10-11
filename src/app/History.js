import {EXPRESSION_TO_MATHJAX_INLINE} from './util.js';
import $ from 'jquery';
const d3 = require('d3');

class History {
  constructor(selector, initialHistory) {
    this.$element = $(selector);
    this.history = initialHistory || [];
    this.dispatcher = d3.dispatch(['click']);
  }

  push(expression) {
    this.history.push(expression);
    this.update();
  }

  pop(until) {
    let result = null;
    if (until) {
      while (this.peek() != until && history.length > 0) {
        result = this.history.pop();
      }
      result = until;
    }
    else {
      result = this.history.pop();
    }

    console.log("result", result.toString());

    this.update();
    return result;
  }

  peek() {
    return this.history[this.history.length - 1];
  }

  update() {
    const $element = this.$element;

    const update = d3.select($element.get(0)).selectAll('.frame')
      .data(this.history.slice(0, this.history.length - 1));

    update.enter()
      .append('div')
      .classed('frame', true)
      .classed('expression-box', true)
      .style('visibility', 'hidden')
      .text(EXPRESSION_TO_MATHJAX_INLINE)
      .each(function() {
        MathJax.Hub.Typeset(this, () => {
          d3.select(this).style('visibility', 'visible');
          $element.animate({
            scrollTop: $element.prop("scrollHeight")
          }, 1000);
        });
      })
      .on('click', expression =>
        this.dispatcher.call('click', this, expression))
      .append('span')
      .classed('index', true)
      .text((d, i) => i + 1);

    update.exit()
      .remove();
  }

  on(event, handler) {
    this.dispatcher.on(event, handler);
    return this;
  }
}

export default History;
