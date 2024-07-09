import {
  ModuleFilterOptions,
  createModuleFilter,
  addEdge,
  getModuleKey,
} from './util';
import {ModuleGraph, Node} from './buildModuleGraph';

export function filterModuleGraph({
  graph,
  direction,
  filter,
}: {
  graph: ModuleGraph;
  direction: 'parents' | 'children';
  filter?: ModuleFilterOptions;
}): ModuleGraph {
  if (!filter) {
    return graph;
  }

  const moduleFilter = createModuleFilter(filter);

  const filteredNodes = new Map<string, Node>();
  const filteredModuleChildren = new Map<string, Set<string>>();
  const filteredModuleParents = new Map<string, Set<string>>();

  function addParents(moduleKey: string, visited: Set<string>) {
    if (visited.has(moduleKey)) {
      return;
    }
    visited.add(moduleKey);
    filteredNodes.set(moduleKey, graph.nodes.get(moduleKey)!);

    const parents = graph.moduleParents.get(moduleKey);
    if (parents) {
      for (const parentKey of parents) {
        addParents(parentKey, visited);
        addEdge(filteredModuleParents, moduleKey, parentKey);
        addEdge(filteredModuleChildren, parentKey, moduleKey);
      }
    }
  }

  function addChildren(moduleKey: string, visited: Set<string>) {
    if (visited.has(moduleKey)) {
      return;
    }
    visited.add(moduleKey);
    filteredNodes.set(moduleKey, graph.nodes.get(moduleKey)!);

    const children = graph.moduleChildren.get(moduleKey);
    if (children) {
      for (const childKey of children) {
        addChildren(childKey, visited);
        addEdge(filteredModuleChildren, moduleKey, childKey);
        addEdge(filteredModuleParents, childKey, moduleKey);
      }
    }
  }

  for (const node of graph.nodes.values()) {
    if (node.type !== 'module') {
      continue;
    }
    if (!moduleFilter(node.stats)) {
      continue;
    }

    const moduleKey = getModuleKey(node.stats);

    if (direction === 'parents') {
      addParents(moduleKey, new Set());
    } else {
      addChildren(moduleKey, new Set());
    }
  }

  return {
    nodes: filteredNodes,
    moduleChildren: filteredModuleChildren,
    moduleParents: filteredModuleParents,
  };
}
