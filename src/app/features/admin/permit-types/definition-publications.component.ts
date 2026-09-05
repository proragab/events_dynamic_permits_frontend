import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, forkJoin } from 'rxjs';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { LocaleService } from '../../../core/i18n/locale.service';
import { DefinitionPublication, PermitType } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

@Component({
  selector: 'app-definition-publications',
  imports: [FormsModule, RouterLink, DatePipe],
  styles: [`
    .filters { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.4rem; }
    .filters label { display: grid; gap: .4rem; min-width: 200px; color: var(--muted); }
    .filters select { padding: .7rem; border: 1px solid var(--border); border-radius: 10px; background: white; }
    .version { font-size: 1.05rem; font-weight: 800; } .admin-table small { display: block; }
  `],
  templateUrl: './definition-publications.component.html',
})
export class DefinitionPublicationsComponent {
  readonly locale = inject(LocaleService);
  private readonly api = inject(PermitsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly versions = signal(false);
  readonly publications = signal<DefinitionPublication[]>([]);
  readonly types = signal<PermitType[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  typeFilter = '';
  stateFilter = 'SCHEMA_PENDING';
  constructor() {
    combineLatest([this.route.data, this.route.queryParamMap]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([data, params]) => {
      this.versions.set(data['view'] === 'versions'); this.typeFilter = params.get('type') ?? ''; this.stateFilter = this.versions() ? '' : 'SCHEMA_PENDING';
    });
    this.load();
  }
  filtered(): DefinitionPublication[] { return this.publications().filter(p => (!this.typeFilter || p.permitTypeCode === this.typeFilter) && (!this.stateFilter || p.publicationState === this.stateFilter)); }
  status(p: DefinitionPublication): string {
    if (p.publicationState === 'REJECTED') return this.locale.text('Rejected', 'مرفوض');
    if (p.publicationState === 'SCHEMA_PENDING') return this.locale.text('Pending review', 'بانتظار المراجعة');
    return p.definitionRev === p.activeDefinitionRev ? this.locale.text('Published · Current', 'منشور · الحالي') : this.locale.text('Published · Previous', 'منشور · سابق');
  }
  load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({ versions: this.api.definitionPublications(), types: this.api.adminPermitTypes() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.publications.set(result.versions); this.types.set(result.types); this.loading.set(false); },
      error: error => { this.error.set(adminErrorMessage(error)); this.loading.set(false); },
    });
  }
}
