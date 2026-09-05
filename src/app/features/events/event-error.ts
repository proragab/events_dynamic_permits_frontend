import { HttpErrorResponse } from '@angular/common/http';
import { ApiProblem } from '../../shared/models/api.models';

export function eventErrorMessage(error: unknown): string {
  const response = error as HttpErrorResponse;
  const problem = response.error as ApiProblem | undefined;
  return problem?.detail || response.message || 'The request could not be completed.';
}
