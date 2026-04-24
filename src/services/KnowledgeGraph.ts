export interface KnowledgeNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  weight: number;
  properties?: Record<string, unknown>;
}

export interface KnowledgePath {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  totalWeight: number;
}

export interface GraphQuery {
  nodeType?: string;
  relation?: string;
  depth?: number;
  limit?: number;
}

export class KnowledgeGraph {
  private static instance: KnowledgeGraph;
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();

  private constructor() {}

  static getInstance(): KnowledgeGraph {
    if (!KnowledgeGraph.instance) {
      KnowledgeGraph.instance = new KnowledgeGraph();
    }
    return KnowledgeGraph.instance;
  }

  addNode(label: string, type: string, properties?: Record<string, unknown>): KnowledgeNode {
    const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const node: KnowledgeNode = {
      id,
      label,
      type,
      properties: properties || {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.nodes.set(id, node);
    return node;
  }

  addEdge(sourceId: string, targetId: string, relation: string, weight = 1, properties?: Record<string, unknown>): KnowledgeEdge | null {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      return null;
    }

    const id = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const edge: KnowledgeEdge = {
      id,
      sourceId,
      targetId,
      relation,
      weight,
      properties
    };
    this.edges.set(id, edge);

    if (!this.adjacencyList.has(sourceId)) {
      this.adjacencyList.set(sourceId, new Set());
    }
    this.adjacencyList.get(sourceId)!.add(targetId);

    return edge;
  }

  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: string): KnowledgeEdge | undefined {
    return this.edges.get(id);
  }

  getNeighbors(nodeId: string, relation?: string): KnowledgeNode[] {
    const neighborIds = this.adjacencyList.get(nodeId);
    if (!neighborIds) return [];

    const neighbors: KnowledgeNode[] = [];
    for (const edge of this.edges.values()) {
      if (edge.sourceId === nodeId && neighborIds.has(edge.targetId)) {
        if (!relation || edge.relation === relation) {
          const neighbor = this.nodes.get(edge.targetId);
          if (neighbor) neighbors.push(neighbor);
        }
      }
    }
    return neighbors;
  }

  findPath(startId: string, endId: string, maxDepth = 3): KnowledgePath | null {
    const visited = new Set<string>();
    const queue: { nodeId: string; path: KnowledgeNode[]; edges: KnowledgeEdge[]; weight: number }[] = [
      { nodeId: startId, path: [], edges: [], weight: 0 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentNode = this.nodes.get(current.nodeId);
      if (current.nodeId === endId && currentNode) {
        return {
          nodes: [...current.path, currentNode],
          edges: current.edges,
          totalWeight: current.weight,
        };
      }

      if (current.path.length >= maxDepth) continue;
      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      const neighbors = this.getNeighbors(current.nodeId);
      for (const neighbor of neighbors) {
        const edge = this.findEdge(current.nodeId, neighbor.id);
        if (edge && !visited.has(neighbor.id)) {
          queue.push({
            nodeId: neighbor.id,
            path: [...current.path, this.nodes.get(current.nodeId)!],
            edges: [...current.edges, edge],
            weight: current.weight + edge.weight
          });
        }
      }
    }

    return null;
  }

  private findEdge(sourceId: string, targetId: string): KnowledgeEdge | undefined {
    for (const edge of this.edges.values()) {
      if (edge.sourceId === sourceId && edge.targetId === targetId) {
        return edge;
      }
    }
    return undefined;
  }

  search(query: GraphQuery): KnowledgeNode[] {
    let results = Array.from(this.nodes.values());

    if (query.nodeType) {
      results = results.filter(n => n.type === query.nodeType);
    }

    results.sort((a, b) => b.updatedAt - a.updatedAt);

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  findByRelation(relation: string, limit = 20): KnowledgeEdge[] {
    const results = Array.from(this.edges.values())
      .filter(e => e.relation === relation);
    return results.slice(0, limit);
  }

  updateNode(id: string, updates: Partial<KnowledgeNode>): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;
    Object.assign(node, updates, { updatedAt: Date.now() });
    return true;
  }

  deleteNode(id: string): boolean {
    if (!this.nodes.has(id)) return false;

    for (const [edgeId, edge] of this.edges) {
      if (edge.sourceId === id || edge.targetId === id) {
        this.edges.delete(edgeId);
      }
    }

    this.adjacencyList.delete(id);
    return this.nodes.delete(id);
  }

  deleteEdge(id: string): boolean {
    const edge = this.edges.get(id);
    if (!edge) return false;

    this.adjacencyList.get(edge.sourceId)?.delete(edge.targetId);
    return this.edges.delete(id);
  }

  getStats(): { nodes: number; edges: number; nodeTypes: Record<string, number>; relations: Record<string, number> } {
    const stats = { nodes: this.nodes.size, edges: this.edges.size, nodeTypes: {} as Record<string, number>, relations: {} as Record<string, number> };

    for (const node of this.nodes.values()) {
      stats.nodeTypes[node.type] = (stats.nodeTypes[node.type] || 0) + 1;
    }
    for (const edge of this.edges.values()) {
      stats.relations[edge.relation] = (stats.relations[edge.relation] || 0) + 1;
    }

    return stats;
  }

  export(): string {
    return JSON.stringify({
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values())
    }, null, 2);
  }

  import(json: string): boolean {
    try {
      const data = JSON.parse(json);
      this.nodes.clear();
      this.edges.clear();
      this.adjacencyList.clear();

      if (data.nodes) {
        for (const node of data.nodes) {
          this.nodes.set(node.id, node);
        }
      }
      if (data.edges) {
        for (const edge of data.edges) {
          this.edges.set(edge.id, edge);
          if (!this.adjacencyList.has(edge.sourceId)) {
            this.adjacencyList.set(edge.sourceId, new Set());
          }
          this.adjacencyList.get(edge.sourceId)!.add(edge.targetId);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
  }
}

export const knowledgeGraph = KnowledgeGraph.getInstance();