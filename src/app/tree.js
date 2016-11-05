const math = require('mathjs');

import $ from 'jquery';
import { queue } from 'd3-queue';
import { select } from 'd3-selection';
import { transition } from 'd3-transition';
import { tree, hierarchy } from 'd3-hierarchy';
import { applyExpression } from './util.js';
import { SvgChart, helper } from 'd3kit';

const { deepExtend } = helper;

export const DEFAULT_OPTIONS = {
  margin: { top: 50, right: 30, bottom: 80, left: 30 },
  initialWidth: 600,
  initialHeight: 370,
  circleRadius: 6,
  nodePadding: {x: 14, y: 8},
  nodeId: (d, i) => i,
  expressionTransDur: 2000,
  previewTransDur: 100,
  previewSpace: 32,
  fontSize: 20,
};

class Tree extends SvgChart {

  constructor(selector, options) {
    super(selector, options);

    this.renderQueue = queue(1);
    this.tree = tree()
      .nodeSize([20, 20])
      .separation((a, b) => {
        const aLen = a.data.toString().length;
        const bLen = b.data.toString().length;
        return Math.log(aLen + bLen);
      });

    this.layers.create(['links', 'nodes']);

    ['resize', 'showPreview', 'hidePreview', 'updateExpression', 'visualize']
      .map(methodName => this[methodName] = this[methodName].bind(this));

    this.on('resize.default', _.debounce(this.resize, 100));
    this.on('data.default', _.debounce(this.visualize, 100));
    this.on('options.default', _.debounce(this.visualize, 100));

    this.fit({
  	  width: '100%',
  	  height: '100%',
    }, true);
  }

  static getCustomEventNames() {
    return [
      'nodeMouseenter', 'nodeMousemove', 'nodeMouseout', 'nodeClick',
      'actionMouseenter', 'actionMousemove', 'actionMouseout', 'actionClick'
    ];
  }

  static getDefaultOptions() {
    return deepExtend(super.getDefaultOptions(), DEFAULT_OPTIONS);
  }

  resize() {
    this.tree.size([this.getInnerWidth(), this.getInnerHeight()]);
    this.visualize();
  }

  visualize() {
    if (!(this.hasData() && this.hasNonZeroArea())) return;

    const root = hierarchy(this.data(), (node) => {
      return (node.args || [])
        .map(this.establishDatum)
        .filter(child => child.shouldRender());
    });

    this.tree(root);
    this.updateLinks(root);
    this.updateNodes(root);
  }

  updateLinks(root) {

    const linkTrans = transition()
      .duration(this.options().expressionTransDur);

    const update = this.layers.get('links')
      .selectAll('.link')
      .data(root.descendants().slice(1), this.options().nodeId);

    const enter = update
      .enter()
      .append('path')
      .classed('link', true);

    update
      .merge(enter)
      .transition(linkTrans)
      .attr('d', function(d) {
        return 'M' + d.x + ',' + d.y
          + 'C' + d.x + ',' +  (d.y + d.parent.y) / 2
          + ' ' + d.parent.x + ',' + (d.y + d.parent.y) / 2
          + ' ' + d.parent.x + ',' + d.parent.y;
      });

    update.exit()
      .remove();
  }

  updateNodes(root) {

    const { updateExpression } = this;

    const nodeUpdateTrans = transition()
      .duration(this.options().expressionTransDur);

    const nodeExitTrans = transition()
      .duration(this.options().expressionTransDur);

    const update = this.layers.get('nodes')
      .selectAll('g.node')
      .data(root.descendants(), this.options().nodeId);

    const enter = update
      .enter()
      .append('g')
      .classed('node', true)
      .attr('transform', d => 'translate(' + [d.x, d.y] + ')')
      .on('mouseenter', d => this.dispatcher.call('nodeMouseenter', this, d))
      .on('mousemove', d => this.dispatcher.call('nodeMousemove', this, d))
      .on('mouseout', d => this.dispatcher.call('nodeMouseout', this, d))
      .on('click', d => this.dispatcher.call('nodeClick', this, d));

    this.updateActions(enter, update);

    const expressionEnter = enter
      .append('g')
      .classed('node-expression-g', true);

    expressionEnter
      .append('foreignObject')
      .classed('node-expression-fo', true)
      .append('xhtml:body')
      .style('opacity', 1)
      .classed('node-expression-body', true)
      .append('div')
      .classed('node-expression', true)
      .classed('expression-box', true)
      .style('position', 'fixed')
      .style('font-size', this.options().fontSize + 'px')
      .merge(update.select('.node-expression'))
      .each(function(d) {updateExpression(d, this);});

    expressionEnter.merge(update)
      .select('.node-expression-g')
      .attr('transform', 'translate(0.01, 0.02)');

    const previewEnter = enter
      .append('g')
      .classed('action-preview-g', true);

    previewEnter
      .append('foreignObject')
      .classed('action-preview-fo', true)
      .append('xhtml:body')
      .classed('action-preview-body', true)
      .append('div')
      .classed('action-preview', true)
      .classed('expression-box', true)
      .style('position', 'fixed')
      .style('font-size', this.options().fontSize + 'px')
      .merge(update.select('.action-preview'))
      .style('visibility', 'hidden');

    previewEnter
      .append('text')
      .classed('arrow', true)
      .attr('text-anchor', 'end')
      .attr('dx', -2)
      .attr('dy', '.2em')
      .style('visibility', 'hidden')
      .text('⇔');

    update
      .merge(enter)
      .transition(nodeUpdateTrans)
      .attr('transform', d => 'translate(' + [d.x, d.y] + ')')
      .style('opacity', 1)
      .selectAll('body')
      .style('opacity', 1);

    const exit = update
      .exit()
      .transition(nodeExitTrans)
      .attr('transform', (d) => {
        const {x, y} = root.descendants()
          .filter(node => d.parent
            ? node.data.custom == d.parent.data.custom
            : false
          )[0] || d;
        return 'translate(' + [x, y] + ')';
      })
      .style('opacity', 0)
      .remove();

    exit
      .selectAll('body')
      .style('opacity', 0);
  }

  updateActions(enter, update) {
    const actionGroup = enter.append('g')
      .classed('action-group', true);

    const actionUpdate = update.select('.action-group').merge(actionGroup)
      .selectAll('.action')
      .data(d => d.data.actions);

    const actionEnter = actionUpdate
      .enter()
      .append('circle')
      .classed('action', true)
      .attr('r', this.options().circleRadius)
      .style('fill', 'red')
      .on('mouseenter', d => this.dispatcher.call('actionMouseenter', this, d))
      .on('mousemove', d => this.dispatcher.call('actionMousemove', this, d))
      .on('mouseout', d => this.dispatcher.call('actionMouseout', this, d))
      .on('click', d => this.dispatcher.call('actionClick', this, d));

    actionUpdate
      .exit()
      .remove();

    actionUpdate.merge(actionEnter)
      .transition(this.expressionTrans)
      .attr('cx', (d, i, actions) => {
        return i * this.options().circleRadius * 3
          - ((actions.length - 1) * this.options().circleRadius * 3) / 2;
      });
  }

  updateExpression(node, element) {
    const $div = $(element);
    const $body = $div.parent();
    const $fo = $body.parent();

    $div.css('visibility', 'hidden');

    applyExpression($div, this.establishDatum(node.data), true, mjxSize => {
      $body
        .width(mjxSize.width)
        .height(mjxSize.height);

      const dx = -$div.outerWidth() / 2;
      const dy = -$div.outerHeight() / 2;

      $fo.attr('transform', 'translate(' + [dx, dy] + ')');

      // adjust action position

      $fo.parent().parent()
        .find('.action-group')
        .attr('transform', 'translate('
          + [0, -dy + this.options().circleRadius * 2.5]
          + ')');

      $div.css('visibility', 'visible');
    });
  }

  previewAction(action) {
    const { showPreview, renderQueue } = this;

    this.layers.get('nodes').selectAll('.node')
      .filter(d => d.data === action.node)
      .each(function() {
        renderQueue.defer(showPreview, action, this);
      });
  }

  unpreviewAction(action) {
    const { hidePreview, renderQueue } = this;

    this.layers.get('nodes').selectAll('.node')
      .filter(d => d.data === action.node)
      .each(function() {
        renderQueue.defer(hidePreview, action, this);
      });
  }

  hidePreview(action, element, done) {
    const hidePrevTrans = transition()
      .duration(this.options().previewTransDur)
      .on('interrupt', done)
      .on('end', done);

    this.layers.get('nodes').selectAll('.node')
      .filter(d => d.data === action.node)
      .each(function() {
        const node = select(this);

        node.select('.action-preview')
          .style('visibility', 'hidden');

        node.select('.arrow')
          .style('visibility', 'hidden')

        node.select('.node-expression-g')
          .transition(hidePrevTrans)
          .attr('transform', 'translate(0, 0)');
      });
  }

  showPreview(action, element, done) {
    const $node = $(element);
    const $body = $node.find('.action-preview-body');
    const $expressionG = $node.find('.node-expression-g');
    const $expressionDiv = $node.find('.node-expression');
    const $previewFo = $node.find('.action-preview-fo');
    const $previewG = $node.find('.action-preview-g');
    const $div = $node.find('.action-preview');
    const $arrow = $node.find('.arrow');

    $div.css('visibility', 'hidden');

    applyExpression($div, this.establishDatum(action.result), true, mjxSize => {
      $body
        .width(mjxSize.width)
        .height(mjxSize.height);

      const dx = -$div.outerWidth() / 2;
      const dy = -$div.outerHeight() / 2;

      $previewFo.attr('transform', 'translate(' + [dx, dy] + ')');

      const exWidth = $expressionDiv.outerWidth();
      const prWidth = $div.outerWidth();
      const width = exWidth + prWidth + this.options().previewSpace;

      const expTrans = [(width - exWidth) / -2, 0];
      const prevTrans = [(width - prWidth) / 2, 0];

      $previewG
        .attr('transform', 'translate(' + prevTrans + ')');

      const showPrevTrans = transition()
        .duration(this.options().previewTransDur)
        .on('interrupt', done)
        .on('end', () => {
          $div.css('visibility', 'visible');
          $arrow
            .attr('transform', 'translate(' + [dx, 0] + ')')
            .css('visibility', 'visible');

          done();
        });

      select($expressionG.get(0))
        .transition(showPrevTrans)
        .attr('transform', 'translate(' + expTrans + ')');
    });

    this.layers.get('nodes').selectAll('.node')
      .sort((a, b) => {
        if (a.data == action.target) {
          return 1;
        }
        if (b.data == action.target) {
          return -1;
        }
        return 0;
      });
  }

  choosePreview(action) {
    const choosePrevTrans = transition()
      .duration(this.options().previewTransDur);

    this.layers.get('nodes').selectAll('.node')
      .filter(d => d.data === action.node)
      .each(function() {
        const node = select(this);

        node.select('.node-expression')
          .style('visibility', 'hidden');
        node.select('.arrow')
          .style('visibility', 'hidden');

        node.select('.action-preview-g')
          .transition(choosePrevTrans)
          .attr('transform', 'translate(0, 0)');
      });
  }

  establishDatum(node) {
    let result = node;
    while (result.content) {result = result.content;}
    return result;
  }
}

export default Tree;
