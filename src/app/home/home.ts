import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HomeService } from '../services/home.service';
import { Game } from '../services/games.service';
import { FloatingSilhouettes } from './floating-silhouettes/floating-silhouettes';
import { FeatureIcon } from './feature-icon/feature-icon';
import { MiniCard } from './mini-card/mini-card';
import { Reveal } from './reveal';
@Component({
  selector: 'av-home',
  standalone: true,
  imports: [RouterLink, FloatingSilhouettes, FeatureIcon, MiniCard, Reveal],
  templateUrl: './home.html',
})
export class Home {
  private readonly router = inject(Router);
  protected readonly svc = inject(HomeService);
  protected readonly features = this.svc.features();
  protected readonly stats = this.svc.stats();
  protected readonly activity = this.svc.activity();
  protected readonly topToday = this.svc.topToday();
  protected readonly pricingFeatures = this.svc.pricingFeatures();
  protected readonly faqs = this.svc.faqs();
  protected readonly previewGames = computed(() => this.svc.previewGames());
  protected rankClass(rank: number): string {
    if (rank === 1) return 'top-row top1';
    if (rank === 2) return 'top-row top2';
    if (rank === 3) return 'top-row top3';
    return 'top-row';
  }
  protected onGameSelected(game: Game) {
    this.router.navigate(['/juego', game.id]);
  }
}
