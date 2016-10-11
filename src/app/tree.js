const math = require('mathjs');
import $ from 'jquery';
const d3 = require('d3');
const d3Kit = require('d3kit');
import {EXPRESSION_TO_MATHJAX_INLINE, ComputeInlineExpressionSize} from './util.js';

export const DEFAULT_OPTIONS = {
  margin: { top: 50, right: 30, bottom: 80, left: 30 },
  offset: [0, 0],
  initialWidth: 600,
  initialHeight: 370,
  circleRadius: 6,
  nodePadding: {x: 14, y: 8},
  nodeId: (d, i) => i,
  transitionDuration: 1000,
  previewSpace: 32,
  fontSize: 20,
};

const EVENTS = [
  'nodeMouseenter', 'nodeMousemove', 'nodeMouseout', 'nodeClick',
  'actionMouseenter', 'actionMousemove', 'actionMouseout', 'actionClick'
];

export default d3Kit.factory.createChart(DEFAULT_OPTIONS, EVENTS, (skeleton) => {
  const options = skeleton.options();
  const layerOrganizer = skeleton.getLayerOrganizer();
  const dispatch = skeleton.getDispatcher();
  const tree = d3.tree()
    .nodeSize([20, 20])
    .separation((a, b) => {
      const aLen = a.data.toString().length;
      const bLen = b.data.toString().length;
      return Math.log(aLen + bLen);
    });

  const visualize = _.debounce(visualizeDebounced, 100);

  skeleton
    .autoResize('both')
    .on('options', visualize)
    .on('data', visualize)
    .on('resize', resize);

  skeleton.resizeToFitContainer('both');

  const rootG = d3.select('#tree > svg > g');
  layerOrganizer.create(['links', 'nodes']);
  const linkLayer = rootG.select('.links-layer');
  const nodeLayer = rootG.select('.nodes-layer');

  function resize() {
    tree.size([skeleton.getInnerWidth(), skeleton.getInnerHeight()]);
    visualize();
  }

  function visualizeDebounced() {
    if (!(skeleton.hasData() && skeleton.hasNonZeroArea())) return;

    const root = d3.hierarchy(skeleton.data(), (node) => {
      return (node.args || [])
        .map(establishDatum)
        .filter(child => child.shouldRender());
    });

    tree(root);

    updateLinks(root);
    updateNodes(root);
  }

  function updateLinks(root) {
    const update = linkLayer.selectAll('.link')
      .data(root.descendants().slice(1), options.nodeId);

    const enter = update
      .enter()
      .append('path')
      .attr('class', 'link');

    update
      .merge(enter)
      .transition()
      .duration(options.transitionDuration)
      .attr('d', function(d) {
        return 'M' + d.x + ',' + d.y
          + 'C' + d.x + ',' +  (d.y + d.parent.y) / 2
          + ' ' + d.parent.x + ',' + (d.y + d.parent.y) / 2
          + ' ' + d.parent.x + ',' + d.parent.y;
      });

    update.exit()
      .remove();
  }

  function updateNodes(root) {

    const update = nodeLayer
      .selectAll('g.node')
      .data(root.descendants(), options.nodeId);

    const enter = update
      .enter()
      .append('g')
      .classed('node', true)
      .attr('transform', d => 'translate(' + [d.x, d.y] + ')')
      .on('mouseenter', d => dispatch.call('nodeMouseenter', this, d))
      .on('mousemove', d => dispatch.call('nodeMousemove', this, d))
      .on('mouseout', d => dispatch.call('nodeMouseout', this, d))
      .on('click', d => dispatch.call('nodeClick', this, d));

    updateActions(enter, update);

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
      .style('font-size', options.fontSize + 'px')
      .merge(update.select('.node-expression'))
      .each(updateExpression);

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
      .style('font-size', options.fontSize + 'px')
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
      .transition()
      .duration(options.transitionDuration)
      .attr('transform', d => 'translate(' + [d.x, d.y] + ')');

    const exit = update
      .exit()
      .transition()
      .duration(options.transitionDuration)
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


  function updateActions(enter, update) {
    const actionGroup = enter.append('g')
      .classed('action-group', true);

    const actionUpdate = update.select('.action-group').merge(actionGroup)
      .selectAll('.action')
      .data(d => d.data.actions);

    const actionEnter = actionUpdate
      .enter()
      .append('circle')
      .classed('action', true)
      .attr('r', options.circleRadius)
      .style('fill', 'red')
      .on('mouseenter', d => dispatch.call('actionMouseenter', this, d))
      .on('mousemove', d => dispatch.call('actionMousemove', this, d))
      .on('mouseout', d => dispatch.call('actionMouseout', this, d))
      .on('click', d => dispatch.call('actionClick', this, d));

    actionUpdate
      .exit()
      .remove();

    actionUpdate.merge(actionEnter)
      .transition()
      .duration(options.transitionDuration)
      .attr('cx', (d, i, actions) => {
        return i * options.circleRadius * 3
          - ((actions.length - 1) * options.circleRadius * 3) / 2;
      });
  }

  function updateExpression(node) {
    const $div = $(this);
    const $body = $div.parent();
    const $fo = $body.parent();

    $div.css('visibility', 'hidden');

    $div.text(EXPRESSION_TO_MATHJAX_INLINE(establishDatum(node.data)));
    MathJax.Hub.Typeset(this, (d) => {
      const mjxSize = ComputeInlineExpressionSize($div);
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
          + [0, -dy + options.circleRadius * 2.5]
          + ')');

      $div.css('visibility', 'visible');
    });
  }

  function previewAction(action) {
    nodeLayer.selectAll('.node')
      .filter(d => d.data === action.node)
      .each(function(d) {showPreview.call(this, action);});
  }

  function hidePreview(action) {
    nodeLayer.selectAll('.node')
      .filter(d => d.data === action.node)
      .each(function() {
        const node = d3.select(this);

        node.select('.action-preview')
          .style('visibility', 'hidden');

        node.select('.arrow')
          .style('visibility', 'hidden')

        node.select('.node-expression-g')
          .transition()
          .attr('transform', 'translate(0, 0)');
      });
  }

  function choosePreview(action) {
    nodeLayer.selectAll('.node')
      .filter(d => d.data === action.node)
      .each(function() {
        const node = d3.select(this);

        node.select('.node-expression')
          .style('visibility', 'hidden');
        node.select('.arrow')
          .style('visibility', 'hidden');

        node.select('.action-preview-g')
          .transition()
          .attr('transform', 'translate(0, 0)');
      });
  }

  function showPreview(action) {
    const $node = $(this);
    const $body = $node.find('.action-preview-body');
    const $expressionG = $node.find('.node-expression-g');
    const $expressionDiv = $node.find('.node-expression');
    const $previewFo = $node.find('.action-preview-fo');
    const $previewG = $node.find('.action-preview-g');
    const $div = $node.find('.action-preview');
    const $arrow = $node.find('.arrow');

    $div.css('visibility', 'hidden');
    $div.text(EXPRESSION_TO_MATHJAX_INLINE(action.result));
    MathJax.Hub.Typeset($div.get(0), (d) => {
      const mjxSize = ComputeInlineExpressionSize($div);
      $body
        .width(mjxSize.width)
        .height(mjxSize.height);

      const dx = -$div.outerWidth() / 2;
      const dy = -$div.outerHeight() / 2;

      $previewFo.attr('transform', 'translate(' + [dx, dy] + ')');

      const exWidth = $expressionDiv.outerWidth();
      const prWidth = $div.outerWidth();
      const width = exWidth + prWidth + options.previewSpace;

      const expTrans = [(width - exWidth) / -2, 0];
      const prevTrans = [(width - prWidth) / 2, 0];

      $previewG
        .attr('transform', 'translate(' + prevTrans + ')');

      d3.select($expressionG.get(0))
        .transition()
        .attr('transform', 'translate(' + expTrans + ')')
        .on('end', () => {
          $div.css('visibility', 'visible');
          $arrow
            .attr('transform', 'translate(' + [dx, 0] + ')')
            .css('visibility', 'visible');
        });
    });

    nodeLayer.selectAll('.node')
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

  function establishNodeName(node) {
    const datum = establishDatum(node.data);
    return datum.op || datum.value || datum.name;
  }

  function establishNodeChildren(node) {
    const children = establishDatum(node).args;
    return children ? children.filter(d => d.shouldRender()) : null;
  }

  function establishDatum(node) {
    let result = node;
    while (result.content) {result = result.content;}
    return result;
  }

  return skeleton.mixin({
    visualize,
    previewAction,
    hidePreview,
    choosePreview,
  });
});
