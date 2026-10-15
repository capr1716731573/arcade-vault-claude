// Genera `src/environments/environment.ts` (gitignored) a partir de `.env-template`.
//
// Lee SOLO las variables públicas que van al cliente: SUPABASE_URL y SUPABASE_KEY
// (la publishable key). NUNCA lee SUPABASE_SECRET_KEY ni SUPABASE_DB_PASSWORD ni
// API_KEY_RESEND: esos son server-only y jamás deben entrar en el bundle.
//
// Lo ejecutan los hooks npm postinstall/prestart/prebuild/prewatch, de modo que
// un clon nuevo, CI o el IDE siempre tengan el archivo aunque esté gitignored.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const envTemplate = join(root, '.env-template');
const outDir = join(root, 'src', 'environments');
const outFile = join(outDir, 'environment.ts');
// En dev las variables vienen de `.env-template`; en CI / deploy pueden venir ya
// inyectadas en el entorno del host, así que si el archivo falta no es fatal.
try {
  process.loadEnvFile(envTemplate);
} catch {
  console.warn('⚠ generate-environment: no se encontró .env-template; uso process.env / placeholders.');
}
const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_KEY ?? '';
if (!url || !key) {
  console.warn(
    '⚠ generate-environment: falta SUPABASE_URL y/o SUPABASE_KEY. ' +
      'Escribo placeholders vacíos para no romper el build; ' +
      'rellena .env-template para conectar con Supabase.',
  );
}
const q = (value) => JSON.stringify(value);
const contents = `// GENERADO por scripts/generate-environment.mjs — NO editar a mano.
// Contiene solo configuración pública (va al cliente). Regenerado en cada
// postinstall/prestart/prebuild/prewatch desde .env-template.
export const environment = {
  supabase: {
    url: ${q(url)},
    key: ${q(key)},
  },
};
`;
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, contents);
console.log(`✓ generate-environment: ${outFile}${url ? ` (SUPABASE_URL=${url})` : ' (placeholders vacíos)'}`);
