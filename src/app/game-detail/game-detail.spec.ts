import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { GameDetail } from './game-detail';

describe('GameDetail', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: GameDetail },
          { path: 'juego/:id', component: GameDetail },
        ]),
      ],
    }),
  );

  it('muestra el juego y 10 filas con top1/top2/top3', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/juego/caida', GameDetail);
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.querySelector('h2')?.textContent).toContain('CAÍDA');
    expect(el.querySelectorAll('.stat-strip > div').length).toBe(3);
    const rows = el.querySelectorAll('.lb-row');
    expect(rows.length).toBe(10);
    expect(rows[0].classList).toContain('top1');
    expect(rows[1].classList).toContain('top2');
    expect(rows[2].classList).toContain('top3');
  });

  it('un id inválido redirige a /', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/juego/nope', GameDetail);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
