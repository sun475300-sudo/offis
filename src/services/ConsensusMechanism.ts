export type ConsensusAlgorithm = 'majority' | 'unanimous' | 'weighted' | 'bidding' | 'ranked';
export type ConsensusState = 'proposing' | 'voting' | 'counting' | 'reached' | 'failed' | 'cancelled';

export interface ConsensusProposal {
  id: string;
  title: string;
  description: string;
  proposerId: string;
  options: ConsensusOption[];
  minVotes?: number;
  deadline: number;
}

export interface ConsensusOption {
  id: string;
  label: string;
  description?: string;
  votes: string[];
  weight?: number;
}

export interface ConsensusDecision {
  id: string;
  proposal: ConsensusProposal;
  state: ConsensusState;
  winningOptionId?: string;
  votes: Record<string, string>;
  createdAt: number;
  completedAt?: number;
}

export interface ConsensusResult {
  success: boolean;
  decision?: ConsensusDecision;
  winner?: ConsensusOption;
  reason?: string;
}

export class ConsensusMechanism {
  private static instance: ConsensusMechanism;
  private decisions: Map<string, ConsensusDecision> = new Map();
  private listeners: Map<string, Set<(decision: ConsensusDecision) => void>> = new Map();
  private defaultAlgorithm: ConsensusAlgorithm = 'majority';
  private defaultMinVotes = 1;

  private constructor() {}

  static getInstance(): ConsensusMechanism {
    if (!ConsensusMechanism.instance) {
      ConsensusMechanism.instance = new ConsensusMechanism();
    }
    return ConsensusMechanism.instance;
  }

  setDefaultAlgorithm(algorithm: ConsensusAlgorithm): void {
    this.defaultAlgorithm = algorithm;
  }

  createProposal(
    title: string,
    description: string,
    proposerId: string,
    options: string[],
    minVotes?: number,
    timeoutMs = 60000
  ): ConsensusDecision {
    const proposal: ConsensusProposal = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title,
      description,
      proposerId,
      options: options.map((label, i) => ({
        id: `opt-${i}`,
        label,
        votes: []
      })),
      minVotes: minVotes || this.defaultMinVotes,
      deadline: Date.now() + timeoutMs
    };

    const decision: ConsensusDecision = {
      id: `dec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      proposal,
      state: 'proposing',
      votes: {},
      createdAt: Date.now()
    };

    this.decisions.set(decision.id, decision);
    return decision;
  }

  startVoting(decisionId: string): boolean {
    const decision = this.decisions.get(decisionId);
    if (!decision || decision.state !== 'proposing') return false;

    decision.state = 'voting';
    this.notifyListeners(decisionId, decision);
    return true;
  }

  vote(decisionId: string, voterId: string, optionId: string): ConsensusResult {
    const decision = this.decisions.get(decisionId);
    if (!decision || decision.state !== 'voting') {
      return { success: false, reason: 'Decision not found or voting not active' };
    }

    if (Date.now() > decision.proposal.deadline) {
      decision.state = 'failed';
      return { success: false, reason: 'Voting deadline passed' };
    }

    const option = decision.proposal.options.find(o => o.id === optionId);
    if (!option) {
      return { success: false, reason: 'Invalid option' };
    }

    if (!decision.votes[voterId]) {
      decision.votes[voterId] = optionId;
      option.votes.push(voterId);
    } else {
      const oldOptionId = decision.votes[voterId];
      const oldOption = decision.proposal.options.find(o => o.id === oldOptionId);
      if (oldOption) {
        oldOption.votes = oldOption.votes.filter(v => v !== voterId);
      }
      decision.votes[voterId] = optionId;
      option.votes.push(voterId);
    }

    const totalVotes = Object.keys(decision.votes).length;
    const minVotes = decision.proposal.minVotes ?? 1;
    if (totalVotes >= minVotes || option.votes.length >= minVotes) {
      return this.resolve(decisionId);
    }

    this.notifyListeners(decisionId, decision);
    return { success: true, decision };
  }

  resolve(decisionId: string): ConsensusResult {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      return { success: false, reason: 'Decision not found' };
    }

    decision.state = 'counting';
    const winner = this.calculateWinner(decision);

    if (winner) {
      decision.state = 'reached';
      decision.winningOptionId = winner.id;
      decision.completedAt = Date.now();
      return { success: true, decision, winner };
    } else {
      decision.state = 'failed';
      return { success: false, decision, reason: 'No consensus reached' };
    }
  }

  private calculateWinner(decision: ConsensusDecision): ConsensusOption | null {
    const options = decision.proposal.options;

    switch (this.defaultAlgorithm) {
      case 'majority': {
        const totalVotes = Object.keys(decision.votes).length;
        const winner = options.reduce((best, opt) =>
          opt.votes.length > best.votes.length ? opt : best
        , options[0]);
        return winner.votes.length > totalVotes / 2 ? winner : null;
      }

      case 'unanimous': {
        // Unanimous consensus = every voter picked the same option. The
        // old implementation checked "every option has at least one vote"
        // (the opposite of unanimous) and then compared votes[0] across
        // options, which is meaningless.
        const totalVoters = Object.keys(decision.votes).length;
        if (totalVoters === 0) return null;
        const allAgreed = options.find(o => o.votes.length === totalVoters);
        return allAgreed ?? null;
      }

      case 'weighted': {
        const winner = options.reduce((best, opt) => {
          const weight = opt.votes.length * (opt.weight || 1);
          const bestWeight = (best.votes.length) * (best.weight || 1);
          return weight > bestWeight ? opt : best;
        }, options[0]);
        return winner;
      }

      case 'bidding': {
        return options.reduce((best, opt) =>
          opt.votes.length > best.votes.length ? opt : best
        , options[0]);
      }

      case 'ranked': {
        const scores = new Map<string, number>();
        for (const option of options) {
          scores.set(option.id, option.votes.length);
        }
        const sorted = options.sort((a, b) =>
          (scores.get(b.id) || 0) - (scores.get(a.id) || 0)
        );
        return sorted[0];
      }

      default:
        return options[0];
    }
  }

  cancel(decisionId: string): boolean {
    const decision = this.decisions.get(decisionId);
    if (!decision || decision.state === 'reached' || decision.state === 'failed') {
      return false;
    }
    decision.state = 'cancelled';
    this.notifyListeners(decisionId, decision);
    return true;
  }

  getDecision(decisionId: string): ConsensusDecision | undefined {
    return this.decisions.get(decisionId);
  }

  getDecisionsByState(state: ConsensusState): ConsensusDecision[] {
    return Array.from(this.decisions.values()).filter(d => d.state === state);
  }

  subscribe(decisionId: string, listener: (decision: ConsensusDecision) => void): () => void {
    if (!this.listeners.has(decisionId)) {
      this.listeners.set(decisionId, new Set());
    }
    this.listeners.get(decisionId)!.add(listener);
    return () => this.listeners.get(decisionId)?.delete(listener);
  }

  private notifyListeners(decisionId: string, decision: ConsensusDecision): void {
    const listeners = this.listeners.get(decisionId);
    if (listeners) {
      for (const listener of listeners) {
        listener(decision);
      }
    }
  }

  getStats(): { total: number; active: number; completed: number; failed: number } {
    let total = 0, active = 0, completed = 0, failed = 0;
    for (const d of this.decisions.values()) {
      total++;
      if (d.state === 'proposing' || d.state === 'voting' || d.state === 'counting') active++;
      else if (d.state === 'reached') completed++;
      else if (d.state === 'failed' || d.state === 'cancelled') failed++;
    }
    return { total, active, completed, failed };
  }

  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    for (const [id, d] of this.decisions) {
      if (d.state === 'reached' || d.state === 'failed' || d.state === 'cancelled') {
        if (now - d.createdAt > 86400000) {
          this.decisions.delete(id);
          removed++;
        }
      }
    }
    return removed;
  }
}

export const consensusMechanism = ConsensusMechanism.getInstance();