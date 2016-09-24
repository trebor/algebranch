const d3 = require('d3');
const d3Kit = require('d3kit');

export const DEFAULT_OPTIONS = {
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  offset: [0, 0],
  initialWidth: 600,
  initialHeight: 370,
};

const EVENTS = [];

export default d3Kit.factory.createChart(DEFAULT_OPTIONS, EVENTS, (skeleton) => {
  const options = skeleton.options();
  const dispatch = skeleton.getDispatcher();
  const layerOrganizer = skeleton.getLayerOrganizer();

  const visualize = _.debounce(visualizeDebounced, 100);

  skeleton
    .autoResize('both')
    .on('options', visualize)
    .on('data', visualize)
    .on('resize', resize);

  skeleton
    .resizeToFitContainer('both');

  // create the layers

  layerOrganizer.create([]);
    /* const partitionLayer = layerOrganizer.get('partitions');
     * const streamLayer = layerOrganizer.get('streams');
     * const sideLabelLayer = layerOrganizer.get('side-labels');*/

  const rootG = skeleton.getRootG();

  function resize() {
    visualize();
  }

  function visualizeDebounced() {
    if (!(skeleton.hasData() && skeleton.hasNonZeroArea())) return;

  }

  return skeleton.mixin({ visualize });
});
