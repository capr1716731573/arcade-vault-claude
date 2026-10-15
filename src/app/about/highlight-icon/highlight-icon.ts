import { Component, input } from '@angular/core';

export type HighlightKind = 'HEART' | 'BROWSER' | 'PLANT';

@Component({
  selector: 'av-highlight-icon',
  standalone: true,
  templateUrl: './highlight-icon.html',
})
export class HighlightIcon {
  readonly kind = input.required<HighlightKind>();
}
