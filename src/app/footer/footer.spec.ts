import { TestBed } from '@angular/core/testing';
import { Footer } from './footer';

describe('Footer', () => {
  it('muestra el texto legal', () => {
    const fixture = TestBed.createComponent(Footer);
    expect(fixture.nativeElement.textContent).toContain('ARCADE VAULT');
  });
});
