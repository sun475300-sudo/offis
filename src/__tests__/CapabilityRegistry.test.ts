import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CapabilityRegistry', () => {
  let CapabilityRegistry: typeof import('../services/CapabilityRegistry').CapabilityRegistry;
  let registry: import('../services/CapabilityRegistry').CapabilityRegistry;

  beforeEach(async () => {
    vi.resetModules();
    ({ CapabilityRegistry } = await import('../services/CapabilityRegistry'));
    registry = CapabilityRegistry.getInstance();
  });

  // regression for fix(services): CapabilityRegistry honors minConfidence: 0
  it('minConfidence: 0 does not silently disable the filter', () => {
    const c1 = registry.registerCapability({
      name: 'parse',
      category: 'code_analysis',
      description: '',
      keywords: ['parse'],
      inputTypes: [],
      outputTypes: [],
      confidence: 0.5,
    });
    const c2 = registry.registerCapability({
      name: 'render',
      category: 'code_analysis',
      description: '',
      keywords: ['render'],
      inputTypes: [],
      outputTypes: [],
      confidence: 0.0,
    });
    registry.linkCapabilityToAgent(c1.id, 'agent-1');
    registry.linkCapabilityToAgent(c2.id, 'agent-2');

    // minConfidence: 0 should match both (because 0 >= 0 and 0.5 >= 0).
    const allMatches = registry.findMatchingAgents({ minConfidence: 0 });
    const allIds = allMatches.map(m => m.agentId).sort();
    expect(allIds).toEqual(['agent-1', 'agent-2']);

    // minConfidence: 0.1 should drop the 0.0-confidence capability.
    const filtered = registry.findMatchingAgents({ minConfidence: 0.1 });
    expect(filtered.map(m => m.agentId)).toEqual(['agent-1']);
  });

  it('unlinkCapabilityFromAgent removes the link both ways', () => {
    const c = registry.registerCapability({
      name: 'unique-cap',
      category: 'testing',
      description: '',
      keywords: [],
      inputTypes: [],
      outputTypes: [],
      confidence: 1,
    });
    registry.linkCapabilityToAgent(c.id, 'a1');
    expect(registry.getCapabilitiesByAgent('a1').length).toBe(1);
    registry.unlinkCapabilityFromAgent(c.id, 'a1');
    expect(registry.getCapabilitiesByAgent('a1').length).toBe(0);
  });
});
