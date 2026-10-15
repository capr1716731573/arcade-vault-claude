import { Injectable, inject } from '@angular/core';
import { ACTIVITY, FAQS, FEATURES, HOME_STATS, PRICING_FEATURES, TOP_TODAY } from '../data/home.data';
import { GamesService } from './games.service';

export type { Feature, HomeStat, ActivityRow, TopPlayer, Faq, NeonColor } from '../data/home.data';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private games = inject(GamesService);

  features() {
    return FEATURES;
  }

  stats() {
    return HOME_STATS;
  }

  activity() {
    return ACTIVITY;
  }

  topToday() {
    return TOP_TODAY;
  }

  pricingFeatures() {
    return PRICING_FEATURES;
  }

  faqs() {
    return FAQS;
  }

  previewGames() {
    return this.games.all().slice(0, 6);
  }
}
