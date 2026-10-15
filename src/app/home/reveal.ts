import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

@Directive({ selector: '[appReveal]', standalone: true })
export class Reveal implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private observer: IntersectionObserver | null = null;

  ngOnInit() {
    if (typeof IntersectionObserver === 'undefined') {
      this.el.nativeElement.classList.add('in');
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            this.observer?.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.observer = null;
  }
}
