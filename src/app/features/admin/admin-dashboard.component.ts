import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PermitsApiService } from '../../core/api/permits-api.service';
import { adminErrorMessage } from './admin-error';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent {
  private readonly api = inject(PermitsApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permitCount = signal(0);
  readonly lookupCount = signal(0);
  readonly workflowCount = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    forkJoin({ types: this.api.adminPermitTypes(), lookups: this.api.adminLookups(), workflows: this.api.workflows() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ types, lookups, workflows }) => {
          this.permitCount.set(types.length);
          this.lookupCount.set(lookups.length);
          this.workflowCount.set(workflows.length);
          this.loading.set(false);
        },
        error: (error) => { this.error.set(adminErrorMessage(error)); this.loading.set(false); },
      });
  }
}
