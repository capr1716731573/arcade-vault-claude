import { Component, input, output } from '@angular/core';
import { Game } from '../../services/games.service';

@Component({
  selector: 'av-mini-card',
  standalone: true,
  templateUrl: './mini-card.html',
})
export class MiniCard {
  readonly game = input.required<Game>();
  readonly selected = output<Game>();
}
