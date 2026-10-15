import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { About } from './about';
import { ContactService } from '../services/contact.service';

describe('About', () => {
  let sendSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendSpy = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ContactService, useValue: { send: sendSpy } }],
    });
  });

  const create = (): ComponentFixture<About> => {
    const fixture = TestBed.createComponent(About);
    fixture.detectChanges();
    return fixture;
  };

  const q = (f: ComponentFixture<About>, sel: string) =>
    f.nativeElement.querySelector(sel) as HTMLElement | null;

  const setField = (f: ComponentFixture<About>, sel: string, value: string) => {
    const field = q(f, sel) as HTMLInputElement | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };

  const submitForm = (f: ComponentFixture<About>) => {
    q(f, 'form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    f.detectChanges();
  };

  const fillValid = (f: ComponentFixture<About>) => {
    setField(f, '#c-name', 'Ada');
    setField(f, '#c-email', 'ada@example.com');
    setField(f, '#c-msg', 'Hola equipo');
    f.detectChanges();
  };

  it('renderiza hero, 3 highlights, divider y el formulario con sus placeholders', () => {
    const f = create();
    expect(q(f, '.about-title')!.textContent).toContain('ACERCA DE ARCADE VAULT');
    expect(f.nativeElement.querySelectorAll('.highlight').length).toBe(3);
    expect(f.nativeElement.querySelectorAll('.hl-icon').length).toBe(3);
    expect(f.nativeElement.querySelectorAll('.div-pixels span').length).toBe(24);
    expect((q(f, '#c-name') as HTMLInputElement).placeholder).toBe('px_kai');
    expect((q(f, '#c-email') as HTMLInputElement).placeholder).toBe('jugador@vault.gg');
  });

  it('con campos vacíos no llama al servicio y dispara shake', () => {
    const f = create();
    submitForm(f);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(q(f, 'form')!.classList).toContain('shake');
  });

  it('con correo de formato inválido no llama al servicio y dispara shake', () => {
    const f = create();
    setField(f, '#c-name', 'Ada');
    setField(f, '#c-email', 'no-es-email');
    setField(f, '#c-msg', 'Hola');
    f.detectChanges();
    submitForm(f);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(q(f, 'form')!.classList).toContain('shake');
  });

  it('con datos válidos llama a send con { name, email, msg } y muestra la terminal de éxito con el nombre en mayúsculas', () => {
    sendSpy.mockReturnValue(of({ ok: true }));
    const f = create();
    fillValid(f);
    submitForm(f);
    expect(sendSpy).toHaveBeenCalledWith({ name: 'Ada', email: 'ada@example.com', msg: 'Hola equipo' });
    expect(q(f, '.terminal-success')).toBeTruthy();
    expect(q(f, '.term-body .success')!.textContent).toContain('ADA');
  });

  it('"ENVIAR OTRO MENSAJE" vuelve al formulario vacío', () => {
    sendSpy.mockReturnValue(of({ ok: true }));
    const f = create();
    fillValid(f);
    submitForm(f);
    (q(f, '.terminal-success .btn.ghost') as HTMLButtonElement).click();
    f.detectChanges();
    expect(q(f, '.terminal-success')).toBeFalsy();
    expect((q(f, '#c-name') as HTMLInputElement).value).toBe('');
    expect((q(f, '#c-email') as HTMLInputElement).value).toBe('');
  });

  it('si send falla muestra la variante de error con [ERROR]', () => {
    sendSpy.mockReturnValue(throwError(() => new Error('boom')));
    const f = create();
    fillValid(f);
    submitForm(f);
    expect(q(f, '.terminal-success.error')).toBeTruthy();
    expect(q(f, '.term-body .error')!.textContent).toContain('[ERROR]');
  });

  it('"REINTENTAR" vuelve al formulario conservando los datos', () => {
    sendSpy.mockReturnValue(throwError(() => new Error('boom')));
    const f = create();
    fillValid(f);
    submitForm(f);
    (q(f, '.terminal-success.error .btn.ghost') as HTMLButtonElement).click();
    f.detectChanges();
    expect(q(f, '.terminal-success')).toBeFalsy();
    expect((q(f, '#c-name') as HTMLInputElement).value).toBe('Ada');
    expect((q(f, '#c-msg') as HTMLTextAreaElement).value).toBe('Hola equipo');
  });
});
