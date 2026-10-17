import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HallOfFame } from './hall-of-fame';
import {
  GAMES_FIXTURE,
  MockData,
  provideSupabaseMock,
  scoreRow,
} from '../testing/supabase-mock';
describe('HallOfFame', () => {
  const render = async (data: MockData) => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideSupabaseMock({ games: GAMES_FIXTURE, ...data })],
    });
    const fixture: ComponentFixture<HallOfFame> = TestBed.createComponent(HallOfFame);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };
  it('muestra una pestaña por juego del catálogo', async () => {
    const el = await render({ scores: [] });
    expect(el.querySelectorAll('.hall-tabs .chip').length).toBe(9);
  });
  it('sin puntuaciones muestra el estado vacío y no hay podio', async () => {
    const el = await render({ scores: [] });
    expect(el.textContent).toContain('SIN PUNTUACIONES AÚN');
    expect(el.querySelectorAll('.podium-slot').length).toBe(0);
  });
  it('con marcas reales muestra podio (3) y filas de la tabla', async () => {
    const el = await render({
      scores: [scoreRow('ACE', 9000), scoreRow('NEO', 6500), scoreRow('VIX', 4200)],
    });
    expect(el.querySelectorAll('.podium-slot').length).toBe(3);
    expect(el.querySelectorAll('.hall-table .tr').length).toBe(3);
    expect(el.querySelector('.podium-slot.gold .name')?.textContent).toContain('ACE');
  });
  it('no renderiza la fila "TÚ" simulada', async () => {
    const el = await render({ scores: [scoreRow('ACE', 9000)] });
    expect(el.querySelector('.tr.you')).toBeNull();
  });
});
