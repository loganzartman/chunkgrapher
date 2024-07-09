import type {StatsCompilation, StatsModule} from 'webpack';
import graphviz from 'graphviz';
import {
  ModuleFilterOptions,
  OutputOptions,
  addEdge,
  createModuleFilter,
  getModuleKey,
} from './util';
import {ModuleGraph, buildModuleGraph} from './buildModuleGraph';
import {computeSubgraphMetrics} from './computeSubgraphMetrics';

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
    filteredModules.set(moduleKey, graph.modules.get(moduleKey)!);

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
    filteredModules.set(moduleKey, graph.modules.get(moduleKey)!);

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
  console.debug('Building module graph...');
  const rawGraph = buildModuleGraph(statsData);
  console.debug('Filtering module graph...');
  const graph = filterModuleGraph({
    graph: rawGraph,
    direction: 'parents',
    filter,
  });
  console.debug('Computing subgraph metrics...');
  const subgraphMetrics = computeSubgraphMetrics(graph);

  console.debug('Rendering graph...');
  const g = graphviz.digraph('G');
  g.set('layout', 'dot');
  g.set('ranksep', '2.0');
  // set the layout for a large directed graph

  const moduleFilter = createModuleFilter(filter);

  for (const [modKey, mod] of graph.modules) {
    const labelRows = [
      mod.name,
      `Own Size: ${subgraphMetrics.ownSize.get(modKey)?.toLocaleString()}`,
      `Subgraph Size: ${subgraphMetrics.subgraphSize.get(modKey)?.toLocaleString()}`,
    ];

    g.addNode(modKey, {
      shape: 'box',
      label: labelRows.join('\n'),
      fillcolor: moduleFilter(mod) ? 'yellow' : undefined,
      style: 'filled',
    });
  }

  for (const [aKey, edges] of graph.moduleChildren.entries()) {
    for (const bKey of edges.values()) {
      const moduleA = graph.modules.get(aKey);
      const moduleB = graph.modules.get(bKey);
      if (!moduleA) {
        console.warn(`Module not found: ${aKey}`);
        continue;
      }
      if (!moduleB) {
        console.warn(`Module not found: ${bKey}`);
        continue;
      }
      g.addEdge(getModuleKey(moduleA), getModuleKey(moduleB));
    }
  }

  path ??= `./graph.${format}`;
  console.log('Writing graph to', path);
  g.output(format, path);
}
