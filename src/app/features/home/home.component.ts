import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../core/i18n/locale.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="hero">
      <p class="eyebrow">ENJZ · EVENTS & PERMITS</p>
      <h1>{{ locale.locale() === 'ar' ? 'منصة موحدة للفعاليات والتصاريح' : 'One clear path for events and permits' }}</h1>
      <p>{{ locale.locale() === 'ar' ? 'أنشئ الفعالية، أكمل التصاريح الديناميكية، وتابع مسار الاعتماد.' : 'Create an event, complete metadata-driven permits, and follow every approval round.' }}</p>
      <div class="actions"><a routerLink="/events" class="primary">{{ locale.locale() === 'ar' ? 'عرض فعالياتي' : 'View my events' }}</a><a routerLink="/tasks">{{ locale.locale() === 'ar' ? 'قائمة المهام' : 'Task queue' }}</a></div>
    </section>
    <section class="feature-grid">
      <article><span>01</span><h2>{{ locale.locale() === 'ar' ? 'بيانات مرنة' : 'Flexible definitions' }}</h2><p>{{ locale.locale() === 'ar' ? 'النماذج تتبع تعريف نوع التصريح مباشرة.' : 'Forms follow the live Permit Type catalog automatically.' }}</p></article>
      <article><span>02</span><h2>{{ locale.locale() === 'ar' ? 'مسارات واضحة' : 'Visible workflow' }}</h2><p>{{ locale.locale() === 'ar' ? 'الأدوار والقرارات والجولات محفوظة بوضوح.' : 'Roles, decisions, and return rounds remain explicit.' }}</p></article>
      <article><span>03</span><h2>{{ locale.locale() === 'ar' ? 'مصدر موثوق' : 'Authoritative storage' }}</h2><p>{{ locale.locale() === 'ar' ? 'كل تصريح محفوظ في جدوله الفعلي.' : 'Every Permit Type owns its physical authoritative table.' }}</p></article>
    </section>`
})
export class HomeComponent { readonly locale = inject(LocaleService); }
