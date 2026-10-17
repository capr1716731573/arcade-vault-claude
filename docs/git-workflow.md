# Flujo de git por spec — referencia rápida

Ciclo completo para implementar un spec y llevarlo a `main`.
Reemplaza `NN-slug` por el número y nombre del spec (ej. `05-autenticacion` → rama `spec-05-autenticacion`).

---

## 0) Partir de un `main` actualizado (recomendado)

```bash
git checkout main
git pull origin main
```

## 1) Crear la rama del spec

```bash
git checkout -b spec-NN-slug
```

> Si usas `/spec-impl`, este paso lo hace solo. El nombre debe ser `spec-NN-slug`.

## 2) Spec implementado → subir los cambios a GitHub

```bash
git status            # 1º REVISA qué vas a subir (evita colar carpetas sueltas, p. ej. references/)
git add -A            # todo lo mostrado... o rutas concretas: git add src/ specs/ package.json
git commit -m "feat: breve descripción - spec NN"
git push -u origin spec-NN-slug
```

> `-u` enlaza la rama con `origin` solo la **primera** vez; después basta `git push`.
> Antes del commit final, marca el spec como **`Implementado`** en `specs/NN-slug.md` para que el estado viaje a `main`.

## 3) Merge a `main` (desde GitHub)

- Abre el **Pull Request** que GitHub sugiere tras el push (o *Pull requests → New*).
- Revisa el diff → **Merge pull request** → confirma.
- (Opcional) **Delete branch** para borrar la rama remota ya fusionada.

Con GitHub CLI (`gh`):

```bash
gh pr create --base main --head spec-NN-slug --fill
gh pr merge spec-NN-slug --merge --delete-branch
```

## 4) Actualizar tu `main` local tras el merge

```bash
git checkout main
git pull origin main          # trae el merge hecho en GitHub
git branch -d spec-NN-slug     # borra la rama local ya fusionada (opcional)
git fetch --prune              # limpia referencias a ramas remotas borradas (opcional)
```

---

## Comandos de apoyo (verificación)

```bash
git branch --show-current                              # en qué rama estoy
git log --oneline origin/main..HEAD                    # commits míos que aún no están en main
git log --oneline HEAD..origin/main                    # si sale algo, mi rama está ATRASADA respecto a main
git show --stat HEAD                                    # qué archivos/líneas trae el último commit
git push --force-with-lease origin spec-NN-slug         # reescribir un commit ya pusheado (p. ej. sacar algo colado)
```

---

## Notas aprendidas

- **Antes de `git add -A`, mira `git status`** — así no se cuela material de referencia ni temporales.
- Si algo se coló en un commit ya pusheado: quítalo del índice (`git rm -r --cached <ruta>`), añádelo al `.gitignore`, `git commit --amend`, y `git push --force-with-lease`.
- El cambio de estado del spec (`Aprobado → Implementado`) **también hay que commitearlo**; editar el archivo no basta para que llegue a `main`.
