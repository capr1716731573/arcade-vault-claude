import { Component, inject, signal } from '@angular/core';
import { ContactService } from '../services/contact.service';
import { Reveal } from '../home/reveal';
import { HighlightIcon, HighlightKind } from './highlight-icon/highlight-icon';

type Status = 'idle' | 'sending' | 'ok' | 'error';

interface Highlight {
  kind: HighlightKind;
  text: string;
  color: 'magenta' | 'cyan' | 'green';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'av-about',
  standalone: true,
  imports: [Reveal, HighlightIcon],
  templateUrl: './about.html',
})
export class About {
  private readonly contact = inject(ContactService);

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly msg = signal('');
  protected readonly status = signal<Status>('idle');
  protected readonly shake = signal(false);
  /** Nombre fijado al enviar, para la terminal de éxito. */
  protected readonly sentName = signal('');

  protected readonly highlights: Highlight[] = [
    { kind: 'HEART', text: 'HECHO CON ❤️ PARA JUGADORES', color: 'magenta' },
    { kind: 'BROWSER', text: 'JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR', color: 'cyan' },
    { kind: 'PLANT', text: 'PROYECTO EN CONSTANTE CRECIMIENTO', color: 'green' },
  ];

  protected readonly tips: { text: string; led: '' | 'y' | 'm' }[] = [
    { text: 'RESPUESTA EN 24-48H', led: '' },
    { text: 'SUGERENCIAS BIENVENIDAS', led: 'y' },
    { text: 'SIN SPAM, JAMÁS', led: 'm' },
  ];

  /** 24 pixels del divider (el índice da el retardo de animación en el template). */
  protected readonly dividerPixels = Array.from({ length: 24 });

  /** Validar → sending → send() → ok/error. shake si falta algún campo o el correo es inválido. */
  protected submit(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    const email = this.email().trim();
    const msg = this.msg().trim();

    if (!name || !email || !msg || !EMAIL_RE.test(email)) {
      this.triggerShake();
      return;
    }

    this.status.set('sending');
    this.contact.send({ name, email, msg }).subscribe({
      next: () => {
        this.sentName.set(name);
        this.status.set('ok');
      },
      error: () => this.status.set('error'),
    });
  }

  /** "ENVIAR OTRO MENSAJE": vuelve al formulario vacío. */
  protected reset(): void {
    this.status.set('idle');
    this.name.set('');
    this.email.set('');
    this.msg.set('');
    this.sentName.set('');
  }

  /** "REINTENTAR": vuelve al formulario conservando los datos escritos. */
  protected retry(): void {
    this.status.set('idle');
  }

  private triggerShake(): void {
    this.shake.set(true);
    setTimeout(() => this.shake.set(false), 400);
  }
}
