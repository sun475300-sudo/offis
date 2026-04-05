export interface Capability {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  keywords: string[];
  inputTypes: string[];
  outputTypes: string[];
  agentIds: string[];
  confidence: number;
  lastUpdated: number;
}

export type CapabilityCategory = 
  | 'code_analysis'
  | 'code_generation'
  | 'testing'
  | 'debugging'
  | 'documentation'
  | 'refactoring'
  | 'security'
  | 'performance'
  | 'communication'
  | 'planning'
  | 'research';

export interface CapabilityMatch {
  capability: Capability;
  agentId: string;
  agentName: string;
  confidence: number;
}

export interface CapabilityQuery {
  keywords?: string[];
  category?: CapabilityCategory;
  requiredInputs?: string[];
  minConfidence?: number;
}

export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private capabilities: Map<string, Capability> = new Map();
  private agentCapabilities: Map<string, Set<string>> = new Map();

  private constructor() {}

  static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  registerCapability(capability: Omit<Capability, 'id' | 'lastUpdated' | 'agentIds'>): Capability {
    const id = `cap-${capability.name.toLowerCase().replace(/\s+/g, '-')}`;
    const cap: Capability = {
      ...capability,
      id,
      agentIds: [],
      lastUpdated: Date.now()
    };
    this.capabilities.set(id, cap);
    return cap;
  }

  linkCapabilityToAgent(capabilityId: string, agentId: string): boolean {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) return false;

    if (!capability.agentIds.includes(agentId)) {
      capability.agentIds.push(agentId);
    }

    if (!this.agentCapabilities.has(agentId)) {
      this.agentCapabilities.set(agentId, new Set());
    }
    this.agentCapabilities.get(agentId)!.add(capabilityId);

    return true;
  }

  unlinkCapabilityFromAgent(capabilityId: string, agentId: string): boolean {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) return false;

    capability.agentIds = capability.agentIds.filter(id => id !== agentId);
    this.agentCapabilities.get(agentId)?.delete(capabilityId);

    return true;
  }

  findMatchingAgents(query: CapabilityQuery): CapabilityMatch[] {
    const matches: CapabilityMatch[] = [];

    for (const capability of this.capabilities.values()) {
      if (query.category && capability.category !== query.category) continue;
      if (query.minConfidence && capability.confidence < query.minConfidence) continue;

      let keywordMatch = true;
      if (query.keywords && query.keywords.length > 0) {
        keywordMatch = query.keywords.some(kw => 
          capability.keywords.some(capKw => 
            capKw.toLowerCase().includes(kw.toLowerCase())
          )
        );
      }

      let inputMatch = true;
      if (query.requiredInputs && query.requiredInputs.length > 0) {
        inputMatch = query.requiredInputs.every(input => 
          capability.inputTypes.includes(input)
        );
      }

      if (keywordMatch && inputMatch && capability.agentIds.length > 0) {
        for (const agentId of capability.agentIds) {
          matches.push({
            capability,
            agentId,
            agentName: agentId,
            confidence: capability.confidence
          });
        }
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  getCapabilitiesByCategory(category: CapabilityCategory): Capability[] {
    return Array.from(this.capabilities.values()).filter(c => c.category === category);
  }

  getCapabilitiesByAgent(agentId: string): Capability[] {
    const capIds = this.agentCapabilities.get(agentId);
    if (!capIds) return [];
    return Array.from(capIds).map(id => this.capabilities.get(id)).filter(Boolean) as Capability[];
  }

  getAllCapabilities(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  removeCapability(capabilityId: string): boolean {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) return false;

    for (const agentId of capability.agentIds) {
      this.agentCapabilities.get(agentId)?.delete(capabilityId);
    }

    return this.capabilities.delete(capabilityId);
  }

  getCategories(): CapabilityCategory[] {
    const categories = new Set<CapabilityCategory>();
    for (const capability of this.capabilities.values()) {
      categories.add(capability.category);
    }
    return Array.from(categories);
  }
}

export const capabilityRegistry = CapabilityRegistry.getInstance();