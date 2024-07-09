import type {StatsModule, StatsCompilation, StatsChunkGroup} from 'webpack';
import {addEdge, getEntryKey, getModuleKey} from './util';

export type EntryNode = {
  type: 'entry';
  name: string;
  chunkGroup: StatsChunkGroup;
};
export type ModuleNode = {type: 'module'; stats: StatsModule};
export type Node = EntryNode | ModuleNode;

export type ModuleGraph = {
  nodes: Map<string, Node>;
  moduleChildren: Map<string, Set<string>>;
  moduleParents: Map<string, Set<string>>;
};

export function buildModuleGraph(statsData: StatsCompilation): ModuleGraph {
  if (!statsData.modules) {
    throw new Error('No modules found');
  }
  if (!statsData.entrypoints) {
    throw new Error('No entrypoints found');
  }

  const nodes = new Map<string, Node>();

  for (const mod of statsData.modules) {
    if (nodes.has(getModuleKey(mod))) {
      continue;
    }
    nodes.set(getModuleKey(mod), {type: 'module', stats: mod});
  }

  for (const [name, chunkGroup] of Object.entries(statsData.entrypoints)) {
    nodes.set(getEntryKey({name}), {type: 'entry', name, chunkGroup});
  }

  const moduleParents = new Map<string, Set<string>>();
  const moduleChildren = new Map<string, Set<string>>();

  function addParents(m: ModuleNode, visited: Set<string>) {
    if (!m.stats.reasons) throw new Error('Module has no reasons');
    const mKey = getModuleKey(m.stats);

    for (const parent of m.stats.reasons) {
      let parentKey;
      if (parent.type === 'entry') {
        parentKey = getEntryKey({name: parent.loc});
      } else {
        if (parent.moduleIdentifier) {
          parentKey = getModuleKey({identifier: parent.moduleIdentifier});
        }
      }

      if (!parentKey) {
        continue;
      }

      if (visited.has(parentKey)) {
        continue;
      }
      visited.add(parentKey);

      const parentModule = nodes.get(parentKey);
      if (parentModule) {
        addEdge(moduleParents, mKey, parentKey);
        addEdge(moduleChildren, parentKey, mKey);
        if (parentModule.type === 'module') {
          addParents(parentModule, visited);
        }
      }
    }
  }

  for (const [nodeKey, node] of nodes) {
    if (node.type !== 'module') {
      continue;
    }
    addParents(node, new Set());
  }

  return {nodes, moduleChildren, moduleParents};
}
