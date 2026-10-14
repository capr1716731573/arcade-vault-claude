import { EsNumberPipe } from './es-number.pipe';

describe('EsNumberPipe', () => {
  it('formatea con separador de miles es-ES', () => {
    expect(new EsNumberPipe().transform(28450)).toBe('28.450');
  });
});
