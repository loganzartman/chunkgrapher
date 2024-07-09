import type {StatsCompilation} from 'webpack';
import graphviz from 'graphviz';
import {
  ModuleFilterOptions,
  OutputOptions,
  createModuleFilter,
  getModuleKey,
} from './util';
import {buildModuleGraph} from './buildModuleGraph';
import {computeSubgraphMetrics} from './computeSubgraphMetrics';
import {filterModuleGraph} from './filterModuleGraph';

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

  for (const [nodeKey, node] of graph.nodes) {
    if (node.type !== 'module') {
      continue;
    }

    const labelRows = [
      node.stats.name,
      `Own Size: ${subgraphMetrics.ownSize.get(nodeKey)?.toLocaleString()}`,
      `Subgraph Size: ${subgraphMetrics.subgraphSize.get(nodeKey)?.toLocaleString()}`,
    ];

    g.addNode(nodeKey, {
      shape: 'box',
      label: labelRows.join('\n'),
      fillcolor: moduleFilter(node) ? 'yellow' : undefined,
      style: 'filled',
    });
  }

  for (const [aKey, edges] of graph.moduleChildren.entries()) {
    for (const bKey of edges.values()) {
      const moduleA = graph.nodes.get(aKey);
      const moduleB = graph.nodes.get(bKey);
      if (!moduleA) {
        console.warn(`Module not found: ${aKey}`);
        continue;
      }
      if (!moduleB) {
        console.warn(`Module not found: ${bKey}`);
        continue;
      }
      if (moduleA.type !== 'module' || moduleB.type !== 'module') {
        continue;
      }
      g.addEdge(getModuleKey(moduleA.stats), getModuleKey(moduleB.stats));
    }
  }

  path ??= `./graph.${format}`;
  console.log('Writing graph to', path);
  g.output(format, path);
}
