export type ResourceType = 'cpu' | 'memory' | 'network' | 'storage' | 'gpu' | 'custom';
export type ResourceStatus = 'available' | 'in_use' | 'reserved' | 'blocked' | 'released';

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  capacity: number;
  used: number;
  status: ResourceStatus;
  ownerId?: string;
  metadata?: Record<string, unknown>;
}

export interface ResourceAllocation {
  id: string;
  resourceId: string;
  requesterId: string;
  amount: number;
  allocatedAt: number;
  releasedAt?: number;
}

export interface ResourceRequest {
  requesterId: string;
  resourceType: ResourceType;
  amount: number;
  timeout?: number;
  priority?: number;
}

export interface ResourcePoolStats {
  totalResources: number;
  availableResources: number;
  inUseResources: number;
  utilizationRate: number;
  byType: Record<ResourceType, number>;
}

export class ResourcePool {
  private static instance: ResourcePool;
  private resources: Map<string, Resource> = new Map();
  private allocations: Map<string, ResourceAllocation> = new Map();
  private pendingRequests: ResourceRequest[] = [];

  private constructor() {}

  static getInstance(): ResourcePool {
    if (!ResourcePool.instance) {
      ResourcePool.instance = new ResourcePool();
    }
    return ResourcePool.instance;
  }

  addResource(resource: Omit<Resource, 'id' | 'used' | 'status'>): Resource {
    const id = `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newResource: Resource = {
      ...resource,
      id,
      used: 0,
      status: 'available'
    };
    this.resources.set(id, newResource);
    return newResource;
  }

  removeResource(resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource || resource.status === 'in_use') {
      return false;
    }
    return this.resources.delete(resourceId);
  }

  allocate(request: ResourceRequest): ResourceAllocation | null {
    const available = this.findAvailableResources(request.resourceType, request.amount);
    if (!available.length) {
      this.pendingRequests.push(request);
      return null;
    }

    const resource = available[0];
    const allocation: ResourceAllocation = {
      id: `alloc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      resourceId: resource.id,
      requesterId: request.requesterId,
      amount: request.amount,
      allocatedAt: Date.now()
    };

    resource.used += request.amount;
    resource.status = 'in_use';
    resource.ownerId = request.requesterId;

    this.allocations.set(allocation.id, allocation);
    return allocation;
  }

  release(allocationId: string): boolean {
    const allocation = this.allocations.get(allocationId);
    if (!allocation) return false;

    const resource = this.resources.get(allocation.resourceId);
    if (resource) {
      resource.used = Math.max(0, resource.used - allocation.amount);
      if (resource.used === 0) {
        resource.status = 'available';
        resource.ownerId = undefined;
      }
    }

    allocation.releasedAt = Date.now();
    this.processPendingRequests();
    return true;
  }

  private findAvailableResources(type: ResourceType, amount: number): Resource[] {
    return Array.from(this.resources.values())
      .filter(r => r.type === type && r.status === 'available' && r.capacity - r.used >= amount)
      .sort((a, b) => (b.capacity - b.used) - (a.capacity - a.used));
  }

  private processPendingRequests(): void {
    if (this.pendingRequests.length === 0) return;

    const stillPending: ResourceRequest[] = [];
    for (const request of this.pendingRequests) {
      const allocation = this.allocate(request);
      if (!allocation) {
        stillPending.push(request);
      }
    }
    this.pendingRequests = stillPending;
  }

  getResource(resourceId: string): Resource | undefined {
    return this.resources.get(resourceId);
  }

  getResourcesByType(type: ResourceType): Resource[] {
    return Array.from(this.resources.values()).filter(r => r.type === type);
  }

  getAllocationsByRequester(requesterId: string): ResourceAllocation[] {
    return Array.from(this.allocations.values()).filter(a => a.requesterId === requesterId && !a.releasedAt);
  }

  reserve(resourceId: string, requesterId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource || resource.status !== 'available') return false;

    resource.status = 'reserved';
    resource.ownerId = requesterId;
    return true;
  }

  unreserve(resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource || resource.status !== 'reserved') return false;

    resource.status = 'available';
    resource.ownerId = undefined;
    return true;
  }

  getStats(): ResourcePoolStats {
    const stats: ResourcePoolStats = {
      totalResources: this.resources.size,
      availableResources: 0,
      inUseResources: 0,
      utilizationRate: 0,
      byType: {} as Record<ResourceType, number>
    };

    let totalCapacity = 0;
    let totalUsed = 0;

    for (const resource of this.resources.values()) {
      stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1;
      if (resource.status === 'available') stats.availableResources++;
      if (resource.status === 'in_use') stats.inUseResources++;

      totalCapacity += resource.capacity;
      totalUsed += resource.used;
    }

    stats.utilizationRate = totalCapacity > 0 ? totalUsed / totalCapacity : 0;
    return stats;
  }

  getPendingRequests(): ResourceRequest[] {
    return [...this.pendingRequests];
  }

  clear(): void {
    this.resources.clear();
    this.allocations.clear();
    this.pendingRequests = [];
  }
}

export const resourcePool = ResourcePool.getInstance();