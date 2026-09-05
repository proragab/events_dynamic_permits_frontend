import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LocaleService } from './core/i18n/locale.service';
import { SessionService } from './core/auth/session.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly locale = inject(LocaleService);
  readonly session = inject(SessionService);
  private readonly router = inject(Router);

  useRole(role: string): void {
    this.session.setRole(role);
    const destination = role === 'PLATFORM_ADMIN' ? '/admin' : role === 'ORGANIZER' ? '/events' : '/tasks';
    this.router.navigateByUrl(destination);
  }
  isAdmin(): boolean {
    return this.session.hasRole('PLATFORM_ADMIN');
  }
  canManageLifecycle(): boolean {
    return this.session.hasAnyRole('ORGANIZER', 'PLATFORM_ADMIN');
  }
  canWorkTasks(): boolean {
    return this.session.hasWorkflowRole();
  }
  primaryRole(): string {
    return this.session.actor().roles[0] ?? '';
  }
}
