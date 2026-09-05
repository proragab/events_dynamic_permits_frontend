import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Locale = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly document = inject(DOCUMENT);
  readonly locale = signal<Locale>('en');

  toggle(): void { this.use(this.locale() === 'en' ? 'ar' : 'en'); }
  use(locale: Locale): void {
    this.locale.set(locale);
    this.document.documentElement.lang = locale;
    this.document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }

  text(en: string | null | undefined, ar: string | null | undefined): string {
    return this.locale() === 'ar' ? ar || en || '' : en || ar || '';
  }
}
