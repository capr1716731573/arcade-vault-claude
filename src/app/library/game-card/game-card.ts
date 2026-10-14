import { Component, ElementRef, computed, inject, input, output } from '@angular/core';
import { EsNumberPipe } from '../../shared/es-number.pipe';
import { Game } from '../../services/games.service';

@Component({
  selector: 'app-game-card',
  imports: [EsNumberPipe],
  templateUrl: './game-card.html',
  host: {
    class: 'card',
    '(mousemove)': 'onMove($event)',
    '(mouseleave)': 'onLeave()',
    '(click)': 'selected.emit(game())',
  },
})
export class GameCard {
  readonly game = input.required<Game>();
  readonly selected = output<Game>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly btnClass = computed(() => {
    const c = this.game().color;
    return c === 'magenta' || c === 'yellow' ? c : '';
  });

  protected onMove(e: MouseEvent) {
    const r = this.el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    this.el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  }

  protected onLeave() {
    this.el.style.transform = '';
  }

  protected onPlay(e: Event) {
    e.stopPropagation();
    this.selected.emit(this.game());
  }
}
