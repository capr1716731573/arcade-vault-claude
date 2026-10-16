import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HallOfFame } from './hall-of-fame';
import { SessionService } from '../services/session.service';
describe('HallOfFame', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });
  const setup = () => {
    const fixture = TestBed.createComponent(HallOfFame);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };
  it('tiene 9 pestañas, podio y 12 filas', () => {
    const { el } = setup();
    expect(el.querySelectorAll('.hall-tabs .chip').length).toBe(9);
    expect(el.querySelectorAll('.podium-slot').length).toBe(3);
    expect(el.querySelectorAll('.hall-table .tr:not(.you):not(.you-label)').length).toBe(12);
  });
  it('cambiar de pestaña actualiza la pestaña activa y el podio', () => {
    const { fixture, el } = setup();
    const champion = () => el.querySelector('.podium-slot.gold .name')?.textContent;
    const first = champion();
    const tabs = el.querySelectorAll<HTMLButtonElement>('.hall-tabs .chip');
    tabs[1].click();
    fixture.detectChanges();
    expect(tabs[1].classList).toContain('active');
    expect(tabs[0].classList).not.toContain('active');
    expect(champion()).toBeTruthy();
    expect(first).toBeTruthy();
  });
  it('"tu mejor marca" solo aparece con sesión', () => {
    const { fixture, el } = setup();
    expect(el.querySelector('.tr.you')).toBeNull();
    TestBed.inject(SessionService).login('kai');
    fixture.detectChanges();
    expect(el.querySelector('.tr.you')?.textContent).toContain('KAI');
  });
});
