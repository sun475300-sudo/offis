export type NegotiationStatus = 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'cancelled';
export type NegotiationType = 'task_delegation' | 'resource_sharing' | 'collaboration' | 'conflict_resolution';

export interface NegotiationOffer {
  id: string;
  negotiationId: string;
  offererId: string;
  terms: NegotiationTerms;
  timestamp: number;
  expiresAt: number;
}

export interface NegotiationTerms {
  taskId?: string;
  description: string;
  requirements: string[];
  resourceRequirements?: Record<string, number>;
  deadline?: number;
  compensation?: number;
  priority?: string;
}

export interface Negotiation {
  id: string;
  type: NegotiationType;
  participants: string[];
  status: NegotiationStatus;
  currentOffer?: NegotiationOffer;
  offers: NegotiationOffer[];
  createdAt: number;
  updatedAt: number;
  resolution?: string;
}

export interface NegotiationResult {
  success: boolean;
  negotiation?: Negotiation;
  acceptedTerms?: NegotiationTerms;
  reason?: string;
}

export interface NegotiationRules {
  maxOffers: number;
  offerTimeout: number;
  autoAcceptThreshold?: number;
}

export class AgentNegotiation {
  private static instance: AgentNegotiation;
  private negotiations: Map<string, Negotiation> = new Map();
  private listeners: Map<string, Set<(negotiation: Negotiation) => void>> = new Map();
  private rules: NegotiationRules = {
    maxOffers: 5,
    offerTimeout: 60000
  };

  private constructor() {}

  static getInstance(): AgentNegotiation {
    if (!AgentNegotiation.instance) {
      AgentNegotiation.instance = new AgentNegotiation();
    }
    return AgentNegotiation.instance;
  }

  configure(rules: Partial<NegotiationRules>): void {
    this.rules = { ...this.rules, ...rules };
  }

  startNegotiation(
    type: NegotiationType,
    participants: string[],
    initialTerms: NegotiationTerms
  ): Negotiation {
    const id = `neg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const negotiation: Negotiation = {
      id,
      type,
      participants,
      status: 'pending',
      offers: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.negotiations.set(id, negotiation);

    const offer = this.createOffer(id, participants[0], initialTerms);
    negotiation.currentOffer = offer;
    negotiation.offers.push(offer);
    negotiation.status = 'negotiating';

    return negotiation;
  }

  private createOffer(negotiationId: string, offererId: string, terms: NegotiationTerms): NegotiationOffer {
    return {
      id: `offer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      negotiationId,
      offererId,
      terms,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.rules.offerTimeout
    };
  }

  makeOffer(negotiationId: string, offererId: string, terms: NegotiationTerms): NegotiationOffer | null {
    const negotiation = this.negotiations.get(negotiationId);
    if (!negotiation || !negotiation.participants.includes(offererId)) {
      return null;
    }

    if (negotiation.offers.length >= this.rules.maxOffers) {
      return null;
    }

    const offer = this.createOffer(negotiationId, offererId, terms);
    negotiation.currentOffer = offer;
    negotiation.offers.push(offer);
    negotiation.updatedAt = Date.now();

    this.notifyListeners(negotiationId, negotiation);

    return offer;
  }

  acceptOffer(negotiationId: string, responderId: string): NegotiationResult {
    const negotiation = this.negotiations.get(negotiationId);
    if (!negotiation || !negotiation.currentOffer) {
      return { success: false, reason: 'Negotiation not found or no offer' };
    }

    negotiation.status = 'accepted';
    negotiation.resolution = 'Terms accepted';
    negotiation.updatedAt = Date.now();

    this.notifyListeners(negotiationId, negotiation);

    return {
      success: true,
      negotiation,
      acceptedTerms: negotiation.currentOffer.terms
    };
  }

  rejectOffer(negotiationId: string, responderId: string, reason?: string): NegotiationResult {
    const negotiation = this.negotiations.get(negotiationId);
    if (!negotiation) {
      return { success: false, reason: 'Negotiation not found' };
    }

    negotiation.status = 'rejected';
    negotiation.resolution = reason || 'Offer rejected';
    negotiation.updatedAt = Date.now();

    this.notifyListeners(negotiationId, negotiation);

    return { success: false, negotiation, reason };
  }

  cancelNegotiation(negotiationId: string): boolean {
    const negotiation = this.negotiations.get(negotiationId);
    if (!negotiation) return false;

    negotiation.status = 'cancelled';
    negotiation.updatedAt = Date.now();
    this.notifyListeners(negotiationId, negotiation);

    return true;
  }

  getNegotiation(negotiationId: string): Negotiation | undefined {
    return this.negotiations.get(negotiationId);
  }

  getNegotiationsByParticipant(participantId: string): Negotiation[] {
    return Array.from(this.negotiations.values()).filter(n =>
      n.participants.includes(participantId)
    );
  }

  getNegotiationsByStatus(status: NegotiationStatus): Negotiation[] {
    return Array.from(this.negotiations.values()).filter(n => n.status === status);
  }

  subscribe(negotiationId: string, listener: (negotiation: Negotiation) => void): () => void {
    if (!this.listeners.has(negotiationId)) {
      this.listeners.set(negotiationId, new Set());
    }
    this.listeners.get(negotiationId)!.add(listener);
    return () => this.listeners.get(negotiationId)?.delete(listener);
  }

  private notifyListeners(negotiationId: string, negotiation: Negotiation): void {
    const listeners = this.listeners.get(negotiationId);
    if (listeners) {
      for (const listener of listeners) {
        listener(negotiation);
      }
    }
  }

  getStats(): { total: number; pending: number; negotiating: number; accepted: number; rejected: number } {
    const stats = { total: 0, pending: 0, negotiating: 0, accepted: 0, rejected: 0 };
    for (const negotiation of this.negotiations.values()) {
      stats.total++;
      switch (negotiation.status) {
        case 'pending': stats.pending++; break;
        case 'negotiating': stats.negotiating++; break;
        case 'accepted': stats.accepted++; break;
        case 'rejected': stats.rejected++; break;
      }
    }
    return stats;
  }

  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    for (const [id, negotiation] of this.negotiations) {
      if (negotiation.status !== 'negotiating' && negotiation.status !== 'pending') {
        if (now - negotiation.updatedAt > 3600000) {
          this.negotiations.delete(id);
          removed++;
        }
      }
    }
    return removed;
  }
}

export const agentNegotiation = AgentNegotiation.getInstance();