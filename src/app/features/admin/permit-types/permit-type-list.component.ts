import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { DefinitionPublication, PermitType } from '../../../shared/models/api.models';
import { forkJoin } from 'rxjs';
import { LocaleService } from '../../../core/i18n/locale.service';
import { adminErrorMessage } from '../admin-error';

@Component({
  selector: 'app-permit-type-list',
  imports: [FormsModule, RouterLink],
  templateUrl: './permit-type-list.component.html',
})
export class PermitTypeListComponent {
  readonly locale = inject(LocaleService);
  readonly publications = signal<DefinitionPublication[]>([]);
  activeVersion(code: string): number | null { return this.publications().find(p => p.permitTypeCode === code)?.activeDefinitionRev ?? null; }
  private readonly api = inject(PermitsApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly types = signal<PermitType[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  query = '';
  filtered(): PermitType[] {
    const q = this.query.trim().toLowerCase();
    return this.types().filter((type) => !q || [type.code, type.nameEn, type.nameAr, type.category, type.workflowCode].some((value) => value?.toLowerCase().includes(q)));
  }
  constructor() {
    forkJoin({ types: this.api.adminPermitTypes(), publications: this.api.definitionPublications() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ types, publications }) => { this.types.set(types); this.publications.set(publications); this.loading.set(false); },
      error: (error) => { this.error.set(adminErrorMessage(error)); this.loading.set(false); },
    });
  }
}
