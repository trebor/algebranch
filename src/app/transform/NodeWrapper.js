class NodeWrapper {
  constructor(node) {
    this.node = node;
    this.isNode = true;
  }

  map() {
    return this.node.map.apply(this.node, arguments);
  }

  clone() {
    console.log("clone", this.node.uid);
    const node = this.node.clone();
    node.uid = this.node.uid;
    return this.node;
  }
}
