import { Component, inject } from '@angular/core';
import { LocaleService } from '../../core/i18n/locale.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.component.html',
})
export class AdminShellComponent { readonly locale = inject(LocaleService); }
