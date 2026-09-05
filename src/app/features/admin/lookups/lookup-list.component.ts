import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { Lookup } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

@Component({ selector: 'app-lookup-list', imports: [FormsModule, RouterLink], templateUrl: './lookup-list.component.html' })
export class LookupListComponent {
  private readonly api = inject(PermitsApiService); private readonly destroyRef = inject(DestroyRef);
  readonly lookups = signal<Lookup[]>([]); readonly loading = signal(true); readonly error = signal(''); query = '';
  filtered(): Lookup[] { const q = this.query.trim().toLowerCase(); return this.lookups().filter((item) => !q || [item.code, item.nameEn, item.nameAr].some((value) => value.toLowerCase().includes(q))); }
  constructor() { this.api.adminLookups().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (items) => { this.lookups.set(items); this.loading.set(false); }, error: (error) => { this.error.set(adminErrorMessage(error)); this.loading.set(false); } }); }
}
