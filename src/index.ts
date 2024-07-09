import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import {StatsCompilation} from 'webpack';
import {formatModuleName, isStatsData} from './util';
import {ModuleNode, buildModuleGraph} from './buildModuleGraph';
import {filterModuleGraph} from './filterModuleGraph';
import random from 'graphology-layout/random';

function makeGraph(statsData: StatsCompilation) {
  const nodeSize = 32;
  const rawGraph = buildModuleGraph(statsData);
  const graph = filterModuleGraph({
    graph: rawGraph,
    direction: 'children',
  });
  console.log(`Creating graph with ${graph.nodes.size} nodes...`);

  const maxSize = Math.max(
    ...[...graph.nodes.values()]
      .filter((n) => n.type === 'module')
      .map((n) => (n as ModuleNode).stats.size ?? 1),
  );

  const sGraph = new Graph();

  for (const [nodeKey, node] of graph.nodes) {
    if (node.type === 'entry') {
      sGraph.addNode(nodeKey, {
        x: 0,
        y: 0,
        label: `Entrypoint: ${node.name}`,
        color: '#f00',
        size: nodeSize * 0.5,
      });
    } else if (node.type === 'module') {
      sGraph.addNode(nodeKey, {
        x: 0,
        y: 0,
        label: formatModuleName(node.stats),
        size: (Math.sqrt(node.stats.size ?? 1) / Math.sqrt(maxSize)) * nodeSize,
      });
    } else {
      throw new Error(`Unexpected node type`);
    }
  }

  for (const [aKey, edges] of graph.moduleChildren.entries()) {
    for (const bKey of edges.values()) {
      sGraph.addDirectedEdge(aKey, bKey);
    }
  }

  random.assign(sGraph);

  const sensibleSettings = forceAtlas2.inferSettings(sGraph);
  const fa2Layout = new FA2Layout(sGraph, {
    settings: sensibleSettings,
  });
  fa2Layout.start();

  const renderer = new Sigma(
    sGraph,
    document.getElementById('container') as HTMLDivElement,
    {defaultEdgeType: 'arrow'},
  );
}

function init() {
  const fileinput = document.getElementById('fileinput') as HTMLInputElement;

  fileinput.addEventListener('change', async () => {
    const file = fileinput.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (isStatsData(json)) {
        makeGraph(json);
      } else {
        alert('Invalid stats data');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to load file. See console for details.');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
