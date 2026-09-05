import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PermitsApiService } from '../../core/api/permits-api.service';
import { SessionService } from '../../core/auth/session.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { EventSummary, PermitApplication, PermitType } from '../../shared/models/api.models';
import { eventErrorMessage } from './event-error';

@Component({
  selector: 'app-event-detail',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="event-page-header detail">
      <div><a class="event-breadcrumb" routerLink="/events">Events</a><p class="eyebrow">{{ event()?.referenceNo || 'EVENT DETAILS' }}</p>
        <h1>{{ event() ? locale.text(event()!.nameEn, event()!.nameAr) : 'Event details' }}</h1>@if (event()) { <p>{{ event()!.venueText || 'Venue not specified' }}</p> }</div>
      @if (event()) { <div class="event-header-actions"><span class="event-status large" [attr.data-status]="event()!.status">{{ statusLabel(event()!.status) }}</span>
        @if (canEdit()) { <a class="event-button secondary" [routerLink]="['/events', eventId, 'edit']">Edit event</a> }
        @if (canSubmit()) { <button class="event-button primary" type="button" (click)="submitEvent()" [disabled]="working()">{{ working() ? 'Submitting...' : (event()!.status === 'DRAFT' ? 'Submit event' : 'Resubmit event') }}</button> }
      </div> }
    </header>
    @if (error()) { <div class="event-alert error">{{ error() }}</div> }
    @if (message()) { <div class="event-alert success">{{ message() }}</div> }
    @if (loading()) { <div class="event-empty">Loading event...</div> }
    @else if (event(); as current) {
      <section class="event-overview-grid">
        <article class="event-overview-card primary-info"><div class="event-card-heading"><p class="eyebrow">OVERVIEW</p><h2>Event information</h2></div>
          <dl class="event-detail-list"><div><dt>Reference</dt><dd><code>{{ current.referenceNo }}</code></dd></div><div><dt>Category</dt><dd>{{ current.categoryCode }}</dd></div>
            <div><dt>Venue</dt><dd>{{ current.venueText || 'Not specified' }}</dd></div><div><dt>Expected attendees</dt><dd>{{ current.attendeeCount ?? 'Not specified' }}</dd></div></dl></article>
        <article class="event-overview-card schedule"><div class="event-card-heading"><p class="eyebrow">SCHEDULE</p><h2>{{ dateRange(current) }}</h2></div>
          <div class="event-date-pair"><div><span>Starts</span><strong>{{ formatDate(current.startDate) }}</strong></div><div><span>Ends</span><strong>{{ formatDate(current.endDate) }}</strong></div></div></article>
      </section>

      <section class="event-permits-section">
        <header><div><p class="eyebrow">PERMITS</p><h2>Permit applications</h2><p>Applications created under this event.</p></div>
          @if (isOrganizer()) { <button class="event-button primary" type="button" (click)="togglePermitEditor()">{{ permitEditorOpen() ? 'Close form' : 'Create permit' }}</button> }
        </header>
        @if (permitEditorOpen()) {
          <form class="permit-create-panel" (ngSubmit)="createApplication()"><div class="event-card-heading"><h3>New permit application</h3><p>Select a permit type and provide its activity information.</p></div>
            <div class="event-form-grid"><label class="wide"><span>Permit type</span><select name="permitTypeCode" [(ngModel)]="applicationForm.permitTypeCode" required><option value="">Select permit type</option>@for (type of types(); track type.code) { <option [value]="type.code">{{ locale.text(type.nameEn, type.nameAr) }}</option> }</select></label>
              <label class="wide"><span>Activity location</span><input name="locationText" [(ngModel)]="applicationForm.locationText" placeholder="Location within the event"></label>
              <label><span>Activity starts</span><input name="activityFrom" type="date" [(ngModel)]="applicationForm.activityFrom"></label><label><span>Activity ends</span><input name="activityTo" type="date" [(ngModel)]="applicationForm.activityTo" [min]="applicationForm.activityFrom || ''"></label>
              <label><span>Expected attendees</span><input name="attendeeCount" type="number" min="0" [(ngModel)]="applicationForm.attendeeCount"></label></div>
            <footer class="permit-create-actions"><button class="event-button secondary" type="button" (click)="togglePermitEditor()">Cancel</button><button class="event-button primary" type="submit" [disabled]="working() || !applicationForm.permitTypeCode">{{ working() ? 'Creating...' : 'Create permit application' }}</button></footer>
          </form>
        }
        @if (!applications().length) { <div class="event-empty compact"><h3>No permit applications</h3><p>Create the first permit application for this event.</p></div> }
        @else { <div class="permit-list">@for (application of applications(); track application.id) {
          <a [routerLink]="['/applications', application.id, 'form']"><span class="permit-icon">P</span><div><strong>{{ permitTypeName(application.permitTypeCode) }}</strong><small>{{ application.referenceNo }} · {{ application.locationText || 'Location not specified' }}</small></div>
            <span class="event-status" [attr.data-status]="application.status">{{ statusLabel(application.status) }}</span><span class="permit-open">Open</span></a>
        }</div> }
      </section>
    }
  `,
  styleUrl: './events-workspace.scss',
})
export class EventDetailComponent {
  private readonly api = inject(PermitsApiService);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale = inject(LocaleService);
  readonly eventId = Number(this.route.snapshot.paramMap.get('id'));
  readonly event = signal<EventSummary | null>(null);
  readonly types = signal<PermitType[]>([]);
  readonly applications = signal<PermitApplication[]>([]);
  readonly loading = signal(true);
  readonly working = signal(false);
  readonly permitEditorOpen = signal(false);
  readonly error = signal('');
  readonly message = signal((window.history.state?.message as string | undefined) ?? '');
  applicationForm = { permitTypeCode: '', locationText: '', activityFrom: '', activityTo: '', attendeeCount: null as number | null };

  constructor() { this.reload(); }
  reload(): void { this.loading.set(true); forkJoin({ event: this.api.event(this.eventId), applications: this.api.eventApplications(this.eventId), types: this.api.permitTypes() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: ({ event, applications, types }) => { this.event.set(event); this.applications.set(applications); this.types.set(types); this.loading.set(false); this.working.set(false); }, error: (error) => this.fail(error) }); }
  isOrganizer(): boolean { return this.session.hasRole('ORGANIZER'); }
  canEdit(): boolean { return this.isOrganizer() && !!this.event() && ['DRAFT', 'RETURNED_TO_APPLICANT'].includes(this.event()!.status); }
  canSubmit(): boolean { return this.canEdit(); }
  togglePermitEditor(): void { this.permitEditorOpen.update((open) => !open); this.error.set(''); }
  submitEvent(): void { this.working.set(true); this.error.set(''); this.message.set(''); this.api.submitEvent(this.eventId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.message.set('Event submitted successfully.'); this.reload(); }, error: (error) => this.fail(error) }); }
  createApplication(): void {
    if (!this.applicationForm.permitTypeCode) return;
    this.working.set(true); this.error.set(''); this.message.set('');
    this.api.createApplication({ eventId: this.eventId, permitTypeCode: this.applicationForm.permitTypeCode, locationText: this.applicationForm.locationText || null, attendeeCount: this.applicationForm.attendeeCount, activityFrom: this.applicationForm.activityFrom || null, activityTo: this.applicationForm.activityTo || null }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (application) => { this.applications.update((items) => [...items, application]); this.applicationForm = { permitTypeCode: '', locationText: '', activityFrom: '', activityTo: '', attendeeCount: null }; this.permitEditorOpen.set(false); this.working.set(false); this.message.set('Permit application created successfully.'); }, error: (error) => this.fail(error) });
  }
  permitTypeName(code: string): string { const type = this.types().find((item) => item.code === code); return type ? this.locale.text(type.nameEn, type.nameAr) : code; }
  statusLabel(status: string): string { return status.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' '); }
  dateRange(event: EventSummary): string { if (!event.startDate && !event.endDate) return 'Schedule not set'; if (!event.endDate || event.startDate === event.endDate) return this.formatDate(event.startDate); return `${this.formatDate(event.startDate)} - ${this.formatDate(event.endDate)}`; }
  formatDate(value: string | null): string { return value ? new Intl.DateTimeFormat('en-SA', { dateStyle: 'long' }).format(new Date(value + 'T00:00:00')) : 'Not set'; }
  private fail(error: unknown): void { this.error.set(eventErrorMessage(error)); this.loading.set(false); this.working.set(false); }
}
