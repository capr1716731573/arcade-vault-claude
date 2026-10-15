import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;
  let httpMock: HttpTestingController;

  const payload = { name: 'Ada', email: 'ada@example.com', msg: 'Hola equipo' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContactService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('hace POST a /api/contacto con el cuerpo { name, email, msg }', () => {
    service.send(payload).subscribe();
    const req = httpMock.expectOne('/api/contacto');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ok: true });
  });

  it('rama ok: emite { ok: true } cuando el servidor responde 200', () => {
    const emitted: unknown[] = [];
    service.send(payload).subscribe((r) => emitted.push(r));
    httpMock.expectOne('/api/contacto').flush({ ok: true });
    expect(emitted).toEqual([{ ok: true }]);
  });

  it('rama error: va al canal de error (no a next) cuando el servidor responde 500', () => {
    let nexted = false;
    let errored = false;
    service.send(payload).subscribe({
      next: () => (nexted = true),
      error: () => (errored = true),
    });
    httpMock
      .expectOne('/api/contacto')
      .flush(
        { ok: false, error: 'No se pudo enviar el correo.' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    expect(errored).toBe(true);
    expect(nexted).toBe(false);
  });
});
