const d3 = require('d3');
const d3Kit = require('d3kit');

export const DEFAULT_OPTIONS = {
  margin: { top: 30, right: 30, bottom: 30, left: 30 },
  offset: [0, 0],
  initialWidth: 600,
  initialHeight: 370,
  circleRadius: 20,
  transition: d3.transition().duration(2000).ease(d3.easeLinear)
};

const EVENTS = [];

export default d3Kit.factory.createChart(DEFAULT_OPTIONS, EVENTS, (skeleton) => {
  const options = skeleton.options();
  const layerOrganizer = skeleton.getLayerOrganizer();
  const dispatch = skeleton.getDispatcher();
  const tree = d3.tree();

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
      .transition(options.transition)
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
      .classed('node', true);

    enter.append('circle')
      .attr('r', options.circleRadius);

    enter.append('text')
      .attr('dy', '0.35em')
      .style('text-anchor', 'middle')

    update
      .merge(enter)
      .classed('node--internal', d => d.children)
      .classed('node--leaf', d => !d.children)
      .transition(options.transition)
      .attr('transform', d => 'translate(' + [d.x, d.y] + ')')
      .select('text')
      .text(establishNodeName);

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
