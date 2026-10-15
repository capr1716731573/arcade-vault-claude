import { Routes } from '@angular/router';
import { About } from './about/about';
import { Auth } from './auth/auth';
import { GameDetail } from './game-detail/game-detail';
import { GamePlayer } from './game-player/game-player';
import { HallOfFame } from './hall-of-fame/hall-of-fame';
import { Home } from './home/home';
import { Library } from './library/library';

export const routes: Routes = [
  { path: '', component: Library },
  { path: 'juego', component: Home },
  { path: 'juego/:id', component: GameDetail },
  { path: 'jugar/:id', component: GamePlayer },
  { path: 'acceso', component: Auth },
  { path: 'salon', component: HallOfFame },
  { path: 'acerca', component: About },
  { path: '**', redirectTo: '' },
];
