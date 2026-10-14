import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.html',
  host: { class: 'av-auth-wrap fade-in' },
})
export class Auth {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  protected readonly tab = signal<'in' | 'up'>('in');
  protected readonly user = signal('');

  protected submit(e: Event) {
    e.preventDefault();
    this.session.login(this.user());
    this.router.navigateByUrl('/');
  }

  protected guest() {
    this.session.logout();
    this.router.navigateByUrl('/');
  }
}
