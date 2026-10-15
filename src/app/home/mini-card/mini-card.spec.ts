import { TestBed } from '@angular/core/testing';
import { MiniCard } from './mini-card';
import { Game } from '../../services/games.service';

const MOCK_GAME: Game = {
  id: 'caida',
  title: 'CAÍDA',
  short: 'Encaja las piezas.',
  long: '...',
  cat: 'PUZZLE',
  cover: 'cover-tetro',
  color: 'magenta',
  best: 184220,
  plays: '31.8K',
};

describe('MiniCard', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(MiniCard);
    fixture.componentRef.setInput('game', MOCK_GAME);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('muestra el título y la categoría del juego', () => {
    const { el } = setup();
    expect(el.querySelector('.mini-title')?.textContent).toBe('CAÍDA');
    expect(el.querySelector('.mini-cat')?.textContent).toBe('PUZZLE');
  });

  it('emite "selected" al hacer clic', () => {
    const { fixture, el } = setup();
    const emitted: Game[] = [];
    fixture.componentInstance.selected.subscribe((g: Game) => emitted.push(g));
    el.querySelector<HTMLElement>('.mini-card')!.click();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].id).toBe('caida');
  });

  it('emite "selected" al pulsar Enter', () => {
    const { fixture, el } = setup();
    const emitted: Game[] = [];
    fixture.componentInstance.selected.subscribe((g: Game) => emitted.push(g));
    el.querySelector<HTMLElement>('.mini-card')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(emitted).toHaveLength(1);
  });
});
