import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermitsApiService } from '../../core/api/permits-api.service';
import { SessionService } from '../../core/auth/session.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { EventSummary } from '../../shared/models/api.models';
import { eventErrorMessage } from './event-error';

@Component({
  selector: 'app-event-list',
  imports: [FormsModule, RouterLink],
  templateUrl: './event-list.component.html',
  styleUrl: './events-workspace.scss',
})
export class EventListComponent {
  private readonly api = inject(PermitsApiService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale = inject(LocaleService);
  readonly events = signal<EventSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  query = '';
  selectedStatus = 'ALL';

  constructor() { this.api.events().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (events) => { this.events.set(events); this.loading.set(false); }, error: (error) => { this.error.set(eventErrorMessage(error)); this.loading.set(false); } }); }
  isOrganizer(): boolean { return this.session.hasRole('ORGANIZER'); }
  canEdit(event: EventSummary): boolean { return this.isOrganizer() && ['DRAFT', 'RETURNED_TO_APPLICANT'].includes(event.status); }
  statuses(): string[] { return [...new Set(this.events().map((event) => event.status))].sort(); }
  filteredEvents(): EventSummary[] { const query = this.query.trim().toLowerCase(); return this.events().filter((event) => (this.selectedStatus === 'ALL' || event.status === this.selectedStatus) && (!query || [event.nameEn, event.nameAr, event.referenceNo, event.venueText, event.categoryCode].some((value) => value?.toLowerCase().includes(query)))); }
  countStatus(status: string): number { return this.events().filter((event) => event.status === status).length; }
  inProgressCount(): number { return this.events().filter((event) => !['DRAFT', 'APPROVED', 'REJECTED'].includes(event.status)).length; }
  completedCount(): number { return this.events().filter((event) => ['APPROVED', 'REJECTED'].includes(event.status)).length; }
  statusLabel(status: string): string { return status.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' '); }
  dateRange(event: EventSummary): string { if (!event.startDate && !event.endDate) return 'Dates not set'; if (event.startDate === event.endDate || !event.endDate) return this.formatDate(event.startDate); return `${this.formatDate(event.startDate)} - ${this.formatDate(event.endDate)}`; }
  durationLabel(event: EventSummary): string { if (!event.startDate || !event.endDate) return 'Schedule incomplete'; const days = Math.round((new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 86400000) + 1; return `${days} day${days === 1 ? '' : 's'}`; }
  private formatDate(value: string | null): string { return value ? new Intl.DateTimeFormat('en-SA', { dateStyle: 'medium' }).format(new Date(value + 'T00:00:00')) : 'Not set'; }
}
