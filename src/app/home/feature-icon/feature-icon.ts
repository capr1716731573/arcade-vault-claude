import { Component, input } from '@angular/core';

type IconKind = 'GAMEPAD' | 'FREE' | 'TROPHY' | 'ROCKET';

@Component({
  selector: 'av-feature-icon',
  standalone: true,
  templateUrl: './feature-icon.html',
})
export class FeatureIcon {
  readonly kind = input.required<IconKind>();
}
