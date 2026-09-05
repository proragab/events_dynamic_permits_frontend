import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from './session.service';

export const actorInterceptor: HttpInterceptorFn = (request, next) => {
  const actor = inject(SessionService).actor();
  return next(request.clone({ setHeaders: { 'X-Actor': actor.actorId, 'X-Roles': actor.roles.join(',') } }));
};
