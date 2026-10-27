/**
 * Política de contraseña en cliente, espejo del requisito del panel de Supabase
 * ("Lowercase, uppercase letters, digits and symbols", min length 8). Se valida
 * antes de llamar a Supabase en el alta (`auth.ts`) y en el reset (`nueva-clave.ts`)
 * para dar feedback inmediato; Supabase sigue siendo la fuente de verdad en servidor.
 */
export const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
/** Mensaje legible con los requisitos de la contraseña. */
export const PASSWORD_REQUIREMENTS =
  'La contraseña debe tener al menos 8 caracteres e incluir minúscula, MAYÚSCULA, dígito y símbolo.';
/**
 * Devuelve el mensaje de requisitos si la contraseña no cumple la política, o
 * `null` si es válida.
 */
export function validatePassword(password: string): string | null {
  return PASSWORD_RE.test(password) ? null : PASSWORD_REQUIREMENTS;
}
