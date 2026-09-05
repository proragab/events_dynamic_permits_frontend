import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PermitsApiService } from '../../core/api/permits-api.service';
import { EventRequest, EventSummary } from '../../shared/models/api.models';
import { eventErrorMessage } from './event-error';

@Component({
  selector: 'app-event-editor',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="event-page-header compact">
      <div><a class="event-breadcrumb" [routerLink]="isEdit ? ['/events', eventId] : ['/events']">{{ isEdit ? 'Event details' : 'Events' }}</a>
        <p class="eyebrow">{{ isEdit ? 'EDIT EVENT' : 'NEW EVENT' }}</p><h1>{{ isEdit ? (event()?.nameEn || 'Edit event') : 'Create an event' }}</h1>
        <p>{{ isEdit ? 'Update the event information before it continues through approval.' : 'Enter the core event information. Permits can be added after the event is created.' }}</p></div>
    </header>
    @if (error()) { <div class="event-alert error">{{ error() }}</div> }
    @if (loading()) { <div class="event-empty">Loading event...</div> }
    @else {
      @if (isEdit && !editable()) { <div class="event-alert warning">This event can no longer be edited because its current status is {{ statusLabel(event()!.status) }}.</div> }
      <form class="event-editor" (ngSubmit)="save()">
        <section class="event-form-section"><header><span>1</span><div><h2>Event identity</h2><p>Names and category used across the platform.</p></div></header>
          <div class="event-form-grid"><label><span>English name</span><input name="nameEn" [(ngModel)]="form.nameEn" required maxlength="200" placeholder="Example: Riyadh Design Week"></label>
            <label><span>Arabic name</span><input name="nameAr" [(ngModel)]="form.nameAr" maxlength="200" dir="rtl"></label>
            <label class="wide"><span>Category code</span><input name="categoryCode" [(ngModel)]="form.categoryCode" required maxlength="60" placeholder="EXHIBITION"><small>Use a short code that describes the event category.</small></label></div>
        </section>
        <section class="event-form-section"><header><span>2</span><div><h2>Place and capacity</h2><p>Where the event happens and its expected size.</p></div></header>
          <div class="event-form-grid"><label class="wide"><span>Venue</span><input name="venueText" [(ngModel)]="form.venueText" maxlength="500" placeholder="Venue or location description"></label>
            <label><span>Expected attendees</span><input name="attendeeCount" type="number" min="0" [(ngModel)]="form.attendeeCount" placeholder="0"></label></div>
        </section>
        <section class="event-form-section"><header><span>3</span><div><h2>Schedule</h2><p>Choose the first and last event dates.</p></div></header>
          <div class="event-form-grid"><label><span>Start date</span><input name="startDate" type="date" [(ngModel)]="form.startDate"></label>
            <label><span>End date</span><input name="endDate" type="date" [(ngModel)]="form.endDate" [min]="form.startDate || ''"></label></div>
          @if (!datesValid()) { <p class="event-field-error">End date cannot be before the start date.</p> }
        </section>
        <footer class="event-editor-actions"><a class="event-button secondary" [routerLink]="isEdit ? ['/events', eventId] : ['/events']">Cancel</a>
          <button class="event-button primary" type="submit" [disabled]="saving() || !datesValid() || (isEdit && !editable())">{{ saving() ? 'Saving...' : (isEdit ? 'Save changes' : 'Create event') }}</button></footer>
      </form>
    }
  `,
  styleUrl: './events-workspace.scss',
})
export class EventEditorComponent {
  private readonly api = inject(PermitsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly eventId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
  readonly isEdit = this.eventId > 0;
  readonly event = signal<EventSummary | null>(null);
  readonly loading = signal(this.isEdit);
  readonly saving = signal(false);
  readonly error = signal('');
  form: EventRequest = { nameEn: '', nameAr: '', categoryCode: '', venueText: '', attendeeCount: null, startDate: '', endDate: '' };

  constructor() { if (this.isEdit) this.api.event(this.eventId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (event) => { this.event.set(event); this.form = { nameEn: event.nameEn, nameAr: event.nameAr, categoryCode: event.categoryCode, venueText: event.venueText, attendeeCount: event.attendeeCount ?? null, startDate: event.startDate, endDate: event.endDate }; this.loading.set(false); }, error: (error) => this.fail(error) }); }
  editable(): boolean { return !!this.event() && ['DRAFT', 'RETURNED_TO_APPLICANT'].includes(this.event()!.status); }
  datesValid(): boolean { return !this.form.startDate || !this.form.endDate || this.form.endDate >= this.form.startDate; }
  statusLabel(status: string): string { return status.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' '); }
  save(): void {
    if (!this.datesValid()) return;
    this.saving.set(true); this.error.set('');
    const request: EventRequest = { ...this.form, nameEn: this.form.nameEn.trim(), nameAr: this.form.nameAr?.trim() || null, categoryCode: this.form.categoryCode.trim().toUpperCase(), venueText: this.form.venueText?.trim() || null, attendeeCount: this.form.attendeeCount ?? null, startDate: this.form.startDate || null, endDate: this.form.endDate || null };
    const operation = this.isEdit ? this.api.updateEvent(this.eventId, request) : this.api.createEvent(request);
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (event) => this.router.navigate(['/events', event.id], { state: { message: this.isEdit ? 'Event updated successfully.' : 'Event created successfully.' } }), error: (error) => this.fail(error) });
  }
  private fail(error: unknown): void { this.error.set(eventErrorMessage(error)); this.loading.set(false); this.saving.set(false); }
}
