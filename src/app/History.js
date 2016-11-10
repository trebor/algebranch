import $ from 'jquery';
import { select } from 'd3-selection';
import { dispatch } from 'd3-dispatch';
import { applyExpression } from './util/mathjax-helper';

const KEY = {
  LEFT_ARROW:  37,
  RIGHT_ARROW: 39,
  UP_ARROW:    38,
  DOWN_ARROW:  40,
};

class History {
  constructor(selector, initialHistory, initialFuture) {
    this.$element = $(selector);
    this.$frames = this.$element.find('#frames');
    this.history = initialHistory || [];
    this.future = initialFuture || [];
    this.dispatcher = dispatch('select', 'back', 'forward');
    this.$backButton = this.$element.find('#back');
    this.$forwardButton = this.$element.find('#forward');

    this.$backButton.click(() => {
      this.dispatcher.call('back', this);
    })

    this.$forwardButton.click(() => {
      this.dispatcher.call('forward', this);
    });

    $(document).keydown((e) => {

      if (e.target == $('#eq-input').get(0)) {
        return;
      }

      if (e.which == KEY.LEFT_ARROW){
        if (!this.$backButton.prop('disabled')) {
          this.$backButton.click();
        }
      }
      if (e.which == KEY.RIGHT_ARROW){
        if (!this.$forwardButton.prop('disabled')) {
          this.$forwardButton.click();
        }
      }
    });
  }

  push(expression) {
    this.history.push(expression);
    this.future = [];
    this.update();
  }

  forward() {
    if (this.future.length > 0) {
      this.history.push(this.future.shift());
      this.update();
    }
  }

  skipTo(target) {
    if (this.history.indexOf(target) != -1) {
      return this.skipBackward(target);
    }
    else if (this.future.indexOf(target) != -1) {
      return this.skipForward(target);
    }
  }

  skipForward(target) {
    while (this.peek() != target && this.future.length > 0) {
      this.history.push(this.future.shift());
    }
    this.update();
    return target;
  }

  skipBackward(target) {
    while (this.peek() != target && this.history.length > 0) {
      this.future.unshift(this.history.pop());
    }
    this.update();
    return target;
  }

  pop() {
    const result = this.history.pop();
    this.future.unshift(result);
    this.update();
    return result;
  }

  peek() {
    return this.history[this.history.length - 1];
  }

  update() {
    const $frames = this.$frames;

    this.$backButton.prop('disabled', this.history.length <= 1);
    this.$forwardButton.prop('disabled', this.future.length == 0);

    const update = select($frames.get(0)).selectAll('.frame')
      .data(this.history.concat(this.future));

    const enter = update.enter()
      .append('div')
      .classed('frame', true)
      .classed('expression-box', true)
      .style('visibility', 'hidden')
      .each(function(d) {
        applyExpression($(this), d, true, () => {
          select(this).style('visibility', 'visible');
          $frames.animate({
            scrollTop: $frames.prop("scrollHeight")
          }, 1000);
        });
      })
      .on('click', d => this.dispatcher.call('select', this, d));

    enter
      .append('span')
      .classed('index', true)
      .text((d, i) => i + 1);

    enter
      .merge(update)
      .classed('current', d => d == this.history[this.history.length - 1])
      .classed('faded', d => this.future.indexOf(d) > -1);

    update.exit()
      .remove();
  }

  on(event, handler) {
    this.dispatcher.on(event, handler);
    return this;
  }

  clear(initialHistory, initialFuture) {
    this.history = initialHistory || [];
    this.future = initialFuture || [];
    this.update();
  }
}

export default History;
