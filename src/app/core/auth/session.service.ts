import { Injectable, computed, signal } from '@angular/core';

export interface SessionActor {
  actorId: string;
  roles: string[];
}

export type AppRole = 'ORGANIZER' | 'REVIEWER' | 'APPROVER' | 'INSPECTOR' | 'PLATFORM_ADMIN';

const ROLE_ACTORS: Record<AppRole, string> = {
  ORGANIZER: '7001',
  REVIEWER: '8001',
  APPROVER: '8002',
  INSPECTOR: '8003',
  PLATFORM_ADMIN: '9001',
};

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly storageKey = 'enjz.developmentActor';
  private readonly state = signal<SessionActor>(this.restore());
  readonly actor = this.state.asReadonly();
  readonly isAdmin = computed(() => this.state().roles.includes('PLATFORM_ADMIN'));

  setRole(value: string): void {
    const role = this.normalizeRole(value);
    const next = { actorId: ROLE_ACTORS[role], roles: [role] };
    this.state.set(next);
    localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  hasRole(role: string): boolean {
    return this.state().roles.includes(role);
  }
  hasAnyRole(...roles: string[]): boolean {
    return roles.some((role) => this.hasRole(role));
  }
  hasWorkflowRole(): boolean {
    return this.state().roles.some(
      (role) => !['ORGANIZER', 'PLATFORM_ADMIN', 'INTEGRATION_WORKER'].includes(role),
    );
  }

  private restore(): SessionActor {
    try {
      const value = JSON.parse(
        localStorage.getItem(this.storageKey) ?? 'null',
      ) as SessionActor | null;
      if (Array.isArray(value?.roles) && value.roles.length) {
        const role = this.normalizeRole(value.roles[0]);
        return { actorId: ROLE_ACTORS[role], roles: [role] };
      }
    } catch {
      /* use the safe development default */
    }
    return { actorId: ROLE_ACTORS.ORGANIZER, roles: ['ORGANIZER'] };
  }

  private normalizeRole(value: string): AppRole {
    const role = value.trim().toUpperCase() === 'ADMIN' ? 'PLATFORM_ADMIN' : value.trim().toUpperCase();
    return role in ROLE_ACTORS ? role as AppRole : 'ORGANIZER';
  }
}
