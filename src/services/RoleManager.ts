export type RoleType = 'admin' | 'developer' | 'reviewer' | 'tester' | 'observer' | 'custom';

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'execute')[];
}

export interface Role {
  id: string;
  name: string;
  type: RoleType;
  permissions: Permission[];
  inheritsFrom?: string;
  priority: number;
}

export interface AgentRole {
  agentId: string;
  roleId: string;
  assignedAt: number;
  assignedBy?: string;
}

export interface AccessControlResult {
  allowed: boolean;
  reason?: string;
}

export class RoleManager {
  private static instance: RoleManager;
  private roles: Map<string, Role> = new Map();
  private agentRoles: Map<string, AgentRole> = new Map();
  private roleHierarchy: Map<string, string[]> = new Map();

  private constructor() {
    this.registerDefaultRoles();
  }

  static getInstance(): RoleManager {
    if (!RoleManager.instance) {
      RoleManager.instance = new RoleManager();
    }
    return RoleManager.instance;
  }

  private registerDefaultRoles(): void {
    this.createRole('admin', 'Administrator', 'admin', [
      { resource: '*', actions: ['create', 'read', 'update', 'delete', 'execute'] }
    ], 100);

    this.createRole('developer', 'Developer', 'developer', [
      { resource: 'code', actions: ['create', 'read', 'update', 'execute'] },
      { resource: 'task', actions: ['create', 'read', 'update'] },
      { resource: 'test', actions: ['create', 'read', 'execute'] }
    ], 50);

    this.createRole('reviewer', 'Code Reviewer', 'reviewer', [
      { resource: 'code', actions: ['read'] },
      { resource: 'review', actions: ['create', 'read', 'update'] },
      { resource: 'comment', actions: ['create', 'read'] }
    ], 30);

    this.createRole('tester', 'QA Tester', 'tester', [
      { resource: 'test', actions: ['create', 'read', 'update', 'execute'] },
      { resource: 'bug', actions: ['create', 'read', 'update'] }
    ], 20);

    this.createRole('observer', 'Observer', 'observer', [
      { resource: '*', actions: ['read'] }
    ], 10);
  }

  createRole(id: string, name: string, type: RoleType, permissions: Permission[], priority = 0, inheritsFrom?: string): Role {
    const role: Role = { id, name, type, permissions, priority, inheritsFrom };
    this.roles.set(id, role);
    this.buildHierarchy();
    return role;
  }

  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  updateRole(roleId: string, updates: Partial<Role>): boolean {
    const role = this.roles.get(roleId);
    if (!role) return false;
    Object.assign(role, updates);
    this.buildHierarchy();
    return true;
  }

  deleteRole(roleId: string): boolean {
    if (this.roles.get(roleId)?.type === 'admin') return false;
    
    for (const [, agentRole] of this.agentRoles) {
      if (agentRole.roleId === roleId) {
        this.agentRoles.delete(agentRole.agentId);
      }
    }
    
    return this.roles.delete(roleId);
  }

  assignRole(agentId: string, roleId: string, assignedBy?: string): boolean {
    const role = this.roles.get(roleId);
    if (!role) return false;

    const agentRole: AgentRole = {
      agentId,
      roleId,
      assignedAt: Date.now(),
      assignedBy
    };
    this.agentRoles.set(agentId, agentRole);
    return true;
  }

  removeRole(agentId: string): boolean {
    return this.agentRoles.delete(agentId);
  }

  getAgentRole(agentId: string): Role | null {
    const agentRole = this.agentRoles.get(agentId);
    if (!agentRole) return null;
    return this.roles.get(agentRole.roleId) || null;
  }

  hasPermission(agentId: string, resource: string, action: string): AccessControlResult {
    const role = this.getAgentRole(agentId);
    if (!role) {
      return { allowed: false, reason: 'No role assigned' };
    }

    const effectivePermissions = this.getEffectivePermissions(role.id);

    for (const perm of effectivePermissions) {
      if (perm.resource === '*' || perm.resource === resource) {
        if (perm.actions.includes(action as Permission['actions'][number])) {
          return { allowed: true };
        }
      }
    }

    return { allowed: false, reason: 'Permission denied' };
  }

  private getEffectivePermissions(roleId: string, visited: Set<string> = new Set()): Permission[] {
    const role = this.roles.get(roleId);
    if (!role || visited.has(roleId)) return [];
    visited.add(roleId);

    const permissions = [...role.permissions];

    if (role.inheritsFrom) {
      const parentPermissions = this.getEffectivePermissions(role.inheritsFrom, visited);
      permissions.push(...parentPermissions);
    }

    return permissions;
  }

  private buildHierarchy(): void {
    this.roleHierarchy.clear();

    for (const role of this.roles.values()) {
      const ancestors: string[] = [];
      // Track visited ids so a self-referential or circular
      // inheritsFrom chain (A → B → A) doesn't lock us in an
      // infinite loop.
      const seen = new Set<string>([role.id]);
      let current: Role | undefined = role;

      while (current?.inheritsFrom && !seen.has(current.inheritsFrom)) {
        ancestors.push(current.inheritsFrom);
        seen.add(current.inheritsFrom);
        current = this.roles.get(current.inheritsFrom);
      }

      this.roleHierarchy.set(role.id, ancestors);
    }
  }

  canPerformAction(agentId: string, resource: string, action: string): boolean {
    return this.hasPermission(agentId, resource, action).allowed;
  }

  getAgentsByRole(roleId: string): string[] {
    return Array.from(this.agentRoles.entries())
      .filter(([, ar]) => ar.roleId === roleId)
      .map(([agentId]) => agentId);
  }

  getStats(): { totalRoles: number; totalAssignments: number; byRoleType: Record<RoleType, number> } {
    const stats = { totalRoles: this.roles.size, totalAssignments: this.agentRoles.size, byRoleType: {} as Record<RoleType, number> };
    
    for (const role of this.roles.values()) {
      stats.byRoleType[role.type] = (stats.byRoleType[role.type] || 0) + 1;
    }
    
    return stats;
  }

  exportRoles(): string {
    return JSON.stringify({
      roles: Array.from(this.roles.values()),
      agentRoles: Array.from(this.agentRoles.entries())
    }, null, 2);
  }
}

export const roleManager = RoleManager.getInstance();