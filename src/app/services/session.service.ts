import { Injectable, signal } from '@angular/core';

export interface User {
  name: string;
}

const KEY = 'av_user';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly _user = signal<User | null>(this.read());
  readonly user = this._user.asReadonly();

  login(name: string): void {
    const user: User = { name: (name.trim() || 'PLAYER1').toUpperCase().slice(0, 10) };
    this._user.set(user);
    try {
      localStorage.setItem(KEY, JSON.stringify(user));
    } catch {}
  }

  logout(): void {
    this._user.set(null);
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  private read(): User | null {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      return raw && typeof raw.name === 'string' ? { name: raw.name } : null;
    } catch {
      return null;
    }
  }
}
