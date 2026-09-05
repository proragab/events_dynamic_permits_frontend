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
  templateUrl: './event-detail.component.html',
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
