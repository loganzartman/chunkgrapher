import type {StatsCompilation, StatsChunk, StatsModule} from 'webpack';
import graphviz from 'graphviz';
import {
  ChunkFilterOptions,
  ModuleFilterOptions,
  OutputOptions,
  createChunkFilter,
  createModuleFilter,
  getChunkKey,
  getModuleKey,
} from './util';

export type ModuleGraph = {
  modules: Map<string, StatsModule>;
  moduleChildren: Map<string, Set<string>>;
  moduleParents: Map<string, Set<string>>;
};

function addEdge(edges: Map<string, Set<string>>, a: string, b: string) {
  const aEdges = edges.get(a) ?? new Set<string>();
  edges.set(b, aEdges);
  aEdges.add(b);
}

export function buildModuleGraph(statsData: StatsCompilation): ModuleGraph {
  if (!statsData.modules) {
    throw new Error('No modules found');
  }

  const modules = new Map<string, StatsModule>();
  for (const mod of statsData.modules) {
    modules.set(getModuleKey(mod), mod);
  }
  const moduleParents = new Map<string, Set<string>>();
  const moduleChildren = new Map<string, Set<string>>();

  function addParents(m: StatsModule, visited = new Set<string>()) {
    if (!m.reasons) throw new Error('Module has no reasons');
    const mKey = getModuleKey(m);

    for (const parent of m.reasons) {
      const parentKey = getModuleKey({
        id: parent.moduleId,
        identifier: parent.moduleIdentifier,
      });
      if (visited.has(parentKey)) {
        continue;
      }
      visited.add(parentKey);

      const parentModule = modules.get(parentKey);
      if (parentModule) {
        addEdge(moduleParents, parentKey, mKey);
        addEdge(moduleChildren, mKey, parentKey);
        addParents(parentModule, visited);
      }
    }
  }

  const parentsVisited = new Set<string>();
  for (const mod of statsData.modules) {
    addParents(mod, parentsVisited);
  }

  return {modules, moduleChildren, moduleParents};
}

function filterModuleGraph({
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

  const filteredModules = new Map<string, StatsModule>();
  const filteredModuleChildren = new Map<string, Set<string>>();
  const filteredModuleParents = new Map<string, Set<string>>();

  function addParents(moduleKey: string, visited: Set<string>) {
    if (visited.has(moduleKey)) {
      return;
    }
    visited.add(moduleKey);

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

    const children = graph.moduleChildren.get(moduleKey);
    if (children) {
      for (const childKey of children) {
        addChildren(childKey, visited);
        addEdge(filteredModuleChildren, moduleKey, childKey);
        addEdge(filteredModuleParents, childKey, moduleKey);
      }
    }
  }

  for (const mod of graph.modules.values()) {
    if (!moduleFilter(mod)) {
      continue;
    }

    const moduleKey = getModuleKey(mod);

    if (direction === 'parents') {
      addParents(moduleKey, new Set());
    } else {
      addChildren(moduleKey, new Set());
    }
  }

  return {
    modules: filteredModules,
    moduleChildren: filteredModuleChildren,
    moduleParents: filteredModuleParents,
  };
}

export function graphModules({
  statsData,
  filter,
  path,
  format = 'svg',
}: {
  statsData: StatsCompilation;
  filter?: ModuleFilterOptions;
} & OutputOptions) {
  const rawGraph = buildModuleGraph({statsData});
  const graph = filterModuleGraph({
    graph: rawGraph,
    direction: 'parents',
    filter,
  });

  const g = graphviz.digraph('G');
  g.set('layout', 'dot');
  g.set('ranksep', '2.0');

  const moduleFilter = createModuleFilter(filter);

  for (const mod of graph.modules.values()) {
    g.addNode(getModuleKey(mod), {
      shape: 'box',
      label: mod.name,
      fillcolor: moduleFilter(mod) ? 'yellow' : undefined,
      style: 'filled',
    });
  }

  for (const [a, edges] of graph.moduleChildren.entries()) {
    for (const b of edges.values()) {
      const moduleA = graph.modules.get(a);
      const moduleB = graph.modules.get(b);
      if (!moduleA) throw new Error(`Module not found: ${a}`);
      if (!moduleB) throw new Error(`Module not found: ${b}`);
      g.addEdge(getModuleKey(moduleA), getModuleKey(moduleB));
    }
  }

  path ??= `./graph.${format}`;
  console.log('Writing graph to', path);
  g.output(format, path);
}
