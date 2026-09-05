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
  template: `
    <header class="event-page-header">
      <div><p class="eyebrow">{{ isOrganizer() ? 'MY WORKSPACE' : 'PLATFORM OVERSIGHT' }}</p><h1>Events</h1>
        <p>{{ isOrganizer() ? 'Create events, follow their progress, and manage related permits.' : 'Review all events and their permit activity in one clear list.' }}</p></div>
      @if (isOrganizer()) { <a class="event-button primary" routerLink="/events/new">Create event</a> }
    </header>

    <section class="event-stat-grid" aria-label="Event summary">
      <article><span>All events</span><strong>{{ events().length }}</strong></article>
      <article><span>Drafts</span><strong>{{ countStatus('DRAFT') }}</strong></article>
      <article><span>In progress</span><strong>{{ inProgressCount() }}</strong></article>
      <article><span>Completed</span><strong>{{ completedCount() }}</strong></article>
    </section>

    <section class="event-filter-bar">
      <label class="event-search"><span>Search events</span><input [(ngModel)]="query" placeholder="Name, reference, venue, category..."></label>
      <label><span>Status</span><select [(ngModel)]="selectedStatus"><option value="ALL">All statuses</option>@for (status of statuses(); track status) { <option [value]="status">{{ statusLabel(status) }}</option> }</select></label>
      <span>{{ filteredEvents().length }} results</span>
    </section>

    @if (error()) { <div class="event-alert error">{{ error() }}</div> }
    @if (loading()) { <div class="event-empty">Loading events...</div> }
    @else if (!filteredEvents().length) { <div class="event-empty"><h2>No events found</h2><p>Change the filters or create a new event.</p></div> }
    @else {
      <div class="event-table-wrap"><table class="event-table">
        <thead><tr><th>Event</th><th>Schedule</th><th>Venue</th><th>Category</th><th>Status</th><th></th></tr></thead>
        <tbody>@for (event of filteredEvents(); track event.id) {
          <tr><td><a class="event-name" [routerLink]="['/events', event.id]">{{ locale.text(event.nameEn, event.nameAr) }}</a><small>{{ event.referenceNo }}</small></td>
            <td><strong>{{ dateRange(event) }}</strong><small>{{ durationLabel(event) }}</small></td><td>{{ event.venueText || 'Not specified' }}</td><td><code>{{ event.categoryCode }}</code></td>
            <td><span class="event-status" [attr.data-status]="event.status">{{ statusLabel(event.status) }}</span></td>
            <td><div class="event-row-actions"><a class="event-text-button" [routerLink]="['/events', event.id]">View</a>@if (canEdit(event)) { <a class="event-text-button" [routerLink]="['/events', event.id, 'edit']">Edit</a> }</div></td></tr>
        }</tbody>
      </table></div>
    }
  `,
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
