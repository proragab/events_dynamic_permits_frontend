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
  templateUrl: './event-editor.component.html',
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
