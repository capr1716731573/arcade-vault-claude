import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionService } from '../services/session.service';
@Component({
  selector: 'app-nav',
  imports: [RouterLink],
  templateUrl: './nav.html',
  host: { '(document:keydown.escape)': 'open.set(false)' },
})
export class Nav {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);
  protected readonly open = signal(false);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly inHome = computed(() => this.url() === '/juego');
  protected readonly inLibrary = computed(() => {
    const u = this.url();
    return u === '/' || u.startsWith('/juego/') || u.startsWith('/jugar/');
  });
  protected readonly inHall = computed(() => this.url().startsWith('/salon'));
  protected readonly inAbout = computed(() => this.url() === '/acerca');
  protected readonly inAuth = computed(() => this.url().startsWith('/acceso'));
  protected readonly inCuenta = computed(() => this.url().startsWith('/cuenta'));
}
