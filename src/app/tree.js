import $ from 'jquery';
const d3 = require('d3');
const d3Kit = require('d3kit');
const EXPRESSION_TO_MATHJAX = d => '\\(' + d.toTex() + '\\)';

export const DEFAULT_OPTIONS = {
  margin: { top: 50, right: 30, bottom: 50, left: 30 },
  offset: [0, 0],
  initialWidth: 600,
  initialHeight: 370,
  circleRadius: 20,
  nodePadding: {x: 14, y: 8},
  transitionDuration: 1000,
  fontSize: 20,
};

const EVENTS = ['nodeMouseenter', 'nodeMousemove', 'nodeMouseout', 'nodeClick'];

export default d3Kit.factory.createChart(DEFAULT_OPTIONS, EVENTS, (skeleton) => {
  const options = skeleton.options();
  const layerOrganizer = skeleton.getLayerOrganizer();
  const dispatch = skeleton.getDispatcher();
  const tree = d3.tree();

  /* options.transition = d3.transition()
   *   .duration(options.transitionDuration)
   *   .ease(options.transitionEase);
   */
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

    const root = d3.hierarchy(skeleton.data(), establishNodeChildren);

    tree(root);

    updateLinks(root);
    updateNodes(root);
  }

  function updateLinks(root) {
    const update = linkLayer.selectAll('.link')
      .data(root.descendants().slice(1));

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
      .data(root.descendants());

    const enter = update
      .enter()
      .append('g')
      .classed('node', true)
      .attr('opacity', 1)
      .attr('transform', d => 'translate(' + [d.x, d.y] + ')')
      .on('mouseenter', d => dispatch.call('nodeMouseenter', this, d))
      .on('mousemove', d => dispatch.call('nodeMousemove', this, d))
      .on('mouseout', d => dispatch.call('nodeMouseout', this, d))
      .on('click', d => dispatch.call('nodeClick', this, d));

    /* enter.append('circle')
     *   .attr('r', options.circleRadius);
     */
    enter.merge(update)
      .each(function(d) {$(this).find('foreignObject').remove();})
      .append("foreignObject")
      .append("xhtml:body")
      .append('div')
      .style('position', 'fixed')
      .style('font-size', options.fontSize + 'px')
      .classed('node-expression', true)
      .merge(update)
      .each(function(d) {
        const $node = $(this);
        $node.empty();
        $node.text(EXPRESSION_TO_MATHJAX(establishDatum(d.data)));
        MathJax.Hub.Typeset(this, (d) => {
          const $mjx = $(this).find('.mjx-chtml');
          $mjx.css('padding', [options.nodePadding.y + 'px', options.nodePadding.x + 'px'].join(' '));
          const dx = -($mjx.width() / 2 + options.nodePadding.x);
          const dy = -($mjx.height() / 2 + options.nodePadding.y);
          $node.parent()
            .width($mjx.width())
            .height($mjx.height())
            .parent()
            .attr('transform', 'translate(' + [dx, dy] + ')');
        });
      });

    update
      .merge(enter)
      .classed('node--internal', d => d.children)
      .classed('node--leaf', d => !d.children)
      .transition()
      .duration(options.transitionDuration)
      .attr('transform', d => 'translate(' + [d.x, d.y] + ')');


    update
      .exit()
      .remove();
  }

  function establishNodeName(node) {
    const datum = establishDatum(node.data);
    return datum.op || datum.value || datum.name;
  }

  function establishNodeChildren(node) {
    return establishDatum(node).args;
  }

  function establishDatum(node) {
    return node.content || node;
  }

  return skeleton.mixin({ visualize });
});
