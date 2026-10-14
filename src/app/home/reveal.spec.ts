import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Reveal } from './reveal';

@Component({
  standalone: true,
  imports: [Reveal],
  template: `<div appReveal class="reveal">contenido</div>`,
})
class Host {}

describe('Reveal', () => {
  it('degrada: añade clase "in" inmediatamente cuando IntersectionObserver no está disponible', () => {
    // jsdom no tiene IntersectionObserver → rama de degradación
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.reveal')?.classList).toContain('in');
  });

  it('añade clase "in" vía IntersectionObserver al entrar en viewport', () => {
    let capturedCallback!: IntersectionObserverCallback;
    let capturedObserved: Element | null = null;
    let capturedDisconnected = false;

    class MockIO {
      constructor(cb: IntersectionObserverCallback) {
        capturedCallback = cb;
      }
      observe(el: Element) { capturedObserved = el; }
      unobserve(_el: Element) {}
      disconnect() { capturedDisconnected = true; }
    }
    vi.stubGlobal('IntersectionObserver', MockIO);

    try {
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
      const target = (fixture.nativeElement as HTMLElement).querySelector('.reveal')!;

      expect(capturedObserved).toBe(target);
      expect(target.classList).not.toContain('in');

      // Simulamos entrada en viewport
      capturedCallback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      expect(target.classList).toContain('in');

      // Al destruir el componente, el observer se desconecta
      fixture.destroy();
      expect(capturedDisconnected).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
