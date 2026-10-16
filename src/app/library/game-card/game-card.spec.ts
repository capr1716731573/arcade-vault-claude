import { TestBed } from '@angular/core/testing';
import { GameCard } from './game-card';
import { Game } from '../../services/games.service';
const mkGame = (playable?: boolean): Game => ({
  id: 'x',
  title: 'X',
  short: 's',
  long: 'l',
  cat: 'ARCADE',
  cover: 'cover-bricks',
  color: 'cyan',
  best: 100,
  plays: '1K',
  playable,
});
describe('GameCard · badge PRÓXIMAMENTE', () => {
  const render = (playable?: boolean) => {
    const f = TestBed.createComponent(GameCard);
    f.componentRef.setInput('game', mkGame(playable));
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  };
  it('muestra el badge cuando el juego no es jugable', () => {
    expect(render(false).querySelector('.soon-badge')?.textContent).toContain('PRÓXIMAMENTE');
  });
  it('no muestra el badge cuando el juego es jugable', () => {
    expect(render(true).querySelector('.soon-badge')).toBeNull();
  });
});
