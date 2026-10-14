import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';

describe('SessionService', () => {
  beforeEach(() => localStorage.clear());
  const service = () => TestBed.inject(SessionService);

  it('login guarda en mayúsculas y recorta a 10 caracteres', () => {
    service().login('abcdefghijklm');
    expect(service().user()).toEqual({ name: 'ABCDEFGHIJ' });
    expect(JSON.parse(localStorage.getItem('av_user')!)).toEqual({ name: 'ABCDEFGHIJ' });
  });

  it('login con usuario vacío usa PLAYER1', () => {
    service().login('  ');
    expect(service().user()?.name).toBe('PLAYER1');
  });

  it('logout limpia el usuario y av_user', () => {
    service().login('kai');
    service().logout();
    expect(service().user()).toBeNull();
    expect(localStorage.getItem('av_user')).toBeNull();
  });

  it('restaura la sesión guardada y tolera JSON corrupto', () => {
    localStorage.setItem('av_user', JSON.stringify({ name: 'KAI' }));
    expect(service().user()?.name).toBe('KAI');

    TestBed.resetTestingModule();
    localStorage.setItem('av_user', '{rota');
    expect(service().user()).toBeNull();
  });
});
