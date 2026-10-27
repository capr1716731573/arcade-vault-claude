import { PASSWORD_REQUIREMENTS, validatePassword } from './password-policy';
describe('validatePassword', () => {
  it('acepta contraseñas que cumplen ≥8 + minúscula + MAYÚSCULA + dígito + símbolo', () => {
    for (const p of ['Abcdef1!', 'Str0ng#Pass', 'P@ssw0rd', 'aA1!aaaa']) {
      expect(validatePassword(p)).toBeNull();
    }
  });
  it('rechaza con el mensaje de requisitos cuando falta alguna clase o longitud', () => {
    const malas = [
      'abc', // corta + sin mayúscula/dígito/símbolo
      'Abc1!', // 5 caracteres (corta)
      'abcdef1!', // sin MAYÚSCULA
      'ABCDEF1!', // sin minúscula
      'Abcdefg!', // sin dígito
      'Abcdefg1', // sin símbolo
      'Abcdef1', // 7 caracteres + sin símbolo
      '', // vacía
    ];
    for (const p of malas) {
      expect(validatePassword(p)).toBe(PASSWORD_REQUIREMENTS);
    }
  });
});
