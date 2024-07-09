import {ModuleGraph} from './buildModuleGraph';

export type SubgraphMetrics = {
  subgraphSize: Map<string, number>;
  ownSize: Map<string, number>;
};

export function computeSubgraphMetrics(graph: ModuleGraph): SubgraphMetrics {
  const subgraphSize = new Map<string, number>();
  const ownSize = new Map<string, number>();

  function getSubgraphNodes(nodeKey: string, visited: Set<string>) {
    const children = graph.moduleChildren.get(nodeKey);
    if (!children) {
      return [];
    }

    const nodes = new Set<string>();
    for (const childKey of children) {
      if (childKey === nodeKey) {
        continue;
      }
      if (visited.has(childKey)) {
        continue;
      }
      visited.add(childKey);

      const childSubgraphNodes = getSubgraphNodes(childKey, visited);
      for (const node of childSubgraphNodes) {
        nodes.add(node);
      }
    }
    return nodes;
  }

  for (const [nodeKey, node] of graph.modules) {
    let size = node.size ?? 0;
    ownSize.set(nodeKey, size);

    for (const subnodeKey of getSubgraphNodes(nodeKey, new Set())) {
      const subnode = graph.modules.get(subnodeKey);
      if (subnode === undefined) {
        throw new Error('Node not found');
      }
      size += subnode.size ?? 0;
    }
    subgraphSize.set(nodeKey, size);
  }

  return {subgraphSize, ownSize};
}
