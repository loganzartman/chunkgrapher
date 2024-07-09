import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import {StatsCompilation} from 'webpack';
import {formatModuleName, isStatsData} from './util';
import {ModuleNode, buildModuleGraph} from './buildModuleGraph';
import {filterModuleGraph} from './filterModuleGraph';
import random from 'graphology-layout/random';
import {ChangeEvent, useCallback, useEffect, useState} from 'react';
import {SigmaContainer, useLoadGraph} from '@react-sigma/core';
import {
  LayoutForceAtlas2Control,
  useWorkerLayoutForceAtlas2,
} from '@react-sigma/layout-forceatlas2';

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
  return sGraph;
}

function Layout({graph}: {graph?: Graph}) {
  useEffect(() => {
    if (!graph) {
      return;
    }

    const layout = new FA2Layout(graph, {
      settings: forceAtlas2.inferSettings(graph),
    });

    layout.start();
    return () => layout.stop();
  }, [graph]);

  return null;
}

export function App() {
  const [graph, setGraph] = useState<Graph | undefined>();

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      file
        .text()
        .then((text) => {
          const json = JSON.parse(text);
          if (isStatsData(json)) {
            setGraph(makeGraph(json));
          } else {
            alert('Invalid stats data');
          }
        })
        .catch((e) => {
          console.error(e);
          alert('Failed to load file. See console for details.');
        });
    },
    [],
  );

  return (
    <main className="w-full h-full">
      <SigmaContainer
        graph={graph}
        className="w-full h-full"
        settings={{allowInvalidContainer: true}}
      >
        <Layout graph={graph} />
      </SigmaContainer>
      <div className="absolute left-0 top-0 bottom-0 w-30 bg-gray-100/70 backdrop-blur-md p-4">
        <input type="file" onChange={handleFileChange} />
      </div>
    </main>
  );
}
