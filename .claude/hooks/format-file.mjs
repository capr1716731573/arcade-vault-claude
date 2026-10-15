#!/usr/bin/env node
// Hook PostToolUse (Write|Edit) para Arcade Vault.
// Lee el JSON del hook por stdin, saca la ruta del archivo tocado y lo "formatea":
//   1. Prettier (--write --ignore-unknown)
//   2. ESLint (--fix) para TS/JS
//   3. Elimina las líneas vacías para dejar el código más compacto/legible
//      (solo en archivos de código; nunca en Markdown/YAML).
// No toca nada dentro de node_modules/dist/.angular/.git/.claude (tooling y build).
// Nunca bloquea: cualquier fallo se traga y siempre termina en exit(0).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, isAbsolute, extname } from 'node:path';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', '.git', '.claude']);

// Tipos de archivo a los que SÍ se les borran las líneas vacías. Se excluyen a
// propósito Markdown y YAML, donde las líneas en blanco son significativas.
const BLANKABLE_EXTS = new Set([
  'ts',
  'js',
  'mjs',
  'cjs',
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'json',
]);

// Tipos donde hay que respetar las líneas en blanco dentro de un template `...`.
const TEMPLATE_AWARE_EXTS = new Set(['ts', 'js', 'mjs', 'cjs']);

// Borra las líneas vacías (o solo-espacios) del archivo. En TS/JS lleva la
// cuenta de los backticks no escapados para no tocar las líneas en blanco que
// vivan dentro de un template literal (ante la duda, conserva la línea).
function stripBlankLines(filePath, ext) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const templateAware = TEMPLATE_AWARE_EXTS.has(ext);
  const out = [];
  let insideTemplate = false;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '' && !insideTemplate) continue; // salta la línea vacía
    out.push(line);
    if (templateAware) {
      const backticks = (line.match(/(?<!\\)`/g) ?? []).length;
      if (backticks % 2 === 1) insideTemplate = !insideTemplate;
    }
  }

  let result = out.join(eol);
  if (result && !result.endsWith(eol)) result += eol; // un único salto final

  if (result !== text) {
    try {
      writeFileSync(filePath, result);
    } catch {
      /* no bloquear por un fallo de escritura */
    }
  }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let file;
  try {
    const data = JSON.parse(raw);
    file = data?.tool_response?.filePath ?? data?.tool_input?.file_path;
  } catch {
    process.exit(0);
  }
  if (!file) process.exit(0);

  // Solo archivos dentro del proyecto; saltar carpetas de build/dependencias/tooling.
  const rel = relative(projectDir, file);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) process.exit(0);
  if (rel.split(/[\\/]/).some((part) => SKIP_DIRS.has(part))) process.exit(0);
  if (!existsSync(file)) process.exit(0);

  const run = (cmd, args) => {
    try {
      execFileSync(cmd, args, { cwd: projectDir, stdio: 'ignore', shell: true });
    } catch {
      /* nunca bloquear la escritura por un fallo de formateo/lint */
    }
  };

  // Prettier formatea lo que entiende (TS/JS/HTML/CSS/SCSS/JSON/MD/YAML…)
  // y, con --ignore-unknown, salta en silencio cualquier otro tipo de archivo.
  run('npx', ['--no-install', 'prettier', '--write', '--ignore-unknown', file]);

  const ext = extname(file).slice(1).toLowerCase();

  // ESLint solo si hay flat config y el archivo es TS/JS.
  const hasEslint = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'].some((f) =>
    existsSync(`${projectDir}/${f}`),
  );
  if (hasEslint && /^(ts|js|mjs|cjs)$/.test(ext)) {
    run('npx', ['--no-install', 'eslint', '--fix', file]);
  }

  // Y por último, dejar el código sin líneas vacías (salvo Markdown/YAML).
  if (BLANKABLE_EXTS.has(ext)) stripBlankLines(file, ext);

  process.exit(0);
});
