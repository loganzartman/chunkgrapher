import {StatsModule, StatsCompilation} from 'webpack';
import {addEdge, getModuleKey} from './util';

export type ModuleGraph = {
  modules: Map<string, StatsModule>;
  moduleChildren: Map<string, Set<string>>;
  moduleParents: Map<string, Set<string>>;
};

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

  function addParents(m: StatsModule, visited: Set<string>) {
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
      if (!parentModule) {
        throw new Error('Parent module not found');
      }
      addEdge(moduleParents, mKey, parentKey);
      addEdge(moduleChildren, parentKey, mKey);
      addParents(parentModule, visited);
    }
  }

  for (const mod of statsData.modules) {
    addParents(mod, new Set());
  }

  return {modules, moduleChildren, moduleParents};
}
