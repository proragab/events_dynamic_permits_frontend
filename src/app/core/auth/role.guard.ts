import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

function allow(predicate: (session: SessionService) => boolean): CanActivateFn {
  return () => {
    const session = inject(SessionService);
    return predicate(session) || inject(Router).createUrlTree(['/']);
  };
}

export const adminGuard = allow((session) => session.hasRole('PLATFORM_ADMIN'));
export const lifecycleGuard = allow((session) => session.hasAnyRole('ORGANIZER', 'PLATFORM_ADMIN'));
export const workflowGuard = allow((session) => session.hasWorkflowRole());
export const organizerGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.hasRole('ORGANIZER') || inject(Router).createUrlTree(['/events']);
};
