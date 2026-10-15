import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('monta navbar, contenido y footer', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-nav')).not.toBeNull();
    expect(el.querySelector('main.av-main')).not.toBeNull();
    expect(el.querySelector('app-footer')).not.toBeNull();
  });
});
