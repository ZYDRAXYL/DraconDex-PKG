# CLAUDE.md — DraconDex-PKG

Guidance for Claude Code working in this repo. Read `chain/README.md` and the
`multi-repository-architecture` skill first if you have not.

## What this is

Downloadable **theme / language / view packages** for DraconDex, published as
release assets and installed from inside the app. No application code.

`PACKAGES.md` (Thai) is the format contract — read it before adding a package or
touching the installer side in DraconDex-EXE.

```
packages/<id>/pkg.json      metadata
packages/<id>/payload.json  the data
dist/                       BUILT + COMMITTED — index.json plus one asset per package
tools/build-packages.mjs    validate + build (--check for CI)
tools/extract-from-app.mjs  dev tool: pull a theme or locale out of an EXE checkout
```

```bash
npm run build   # validate, write dist/
npm run check   # validate only — what CI runs
```

## Rules

- **`dist/` is committed and must match `packages/`.** CI fails otherwise.
  Always `npm run build` and commit both.
- **A theme may only set the 15 palette tokens that exist**, and must set the 12
  every built-in theme carries. A theme missing one leaves whatever the previous
  theme put on `<body>` — a half-applied theme, which is harder to diagnose than
  a broken one.
- **A view package may only set settings the app already validates.** It can
  never introduce a new one.
- **A lang package carries the full key set** (~944 keys). A missing key renders
  as the literal key string rather than erroring, so a partial locale looks
  subtly wrong rather than obviously broken.

## Two things that constrain the app side

Both are why the installer in DraconDex-EXE looks the way it does — do not
"simplify" past them:

**The CSP forces main-process fetch.** `electron/index.html` sets
`connect-src 'none'`, so the renderer cannot fetch anything, and `style-src
'self'` means a downloaded `.css` cannot be `<link>`ed. Themes therefore arrive
in main and are applied as inline CSS variables on `<body>` — which is the path
`applyUiSettings()` already uses for user-made custom themes.

**Fetch from the release download URL, not the API.** `api.github.com` caps
anonymous requests at 60/hour per IP. Fine for one person, not fine for a shared
NAT, and this is a path every install hits.

## Releases

Tag `pkg-vX.Y.Z`, matching `package.json`'s `version` — the workflow fails on a
mismatch, because a catalog announcing a release name that does not match its own
tag leaves every installed package with unresolvable provenance.

`pkg-v*` is a fourth namespace alongside `v*` (EXE), `flutter-v*` (APK) and
`sdb-v*` (SDB). Both apps' update checkers filter the shared release list by
prefix, so they ignore these by construction.

## Adding a package

1. `packages/<id>/pkg.json` + `payload.json`, or extract one:
   ```bash
   node tools/extract-from-app.mjs --exe ../DraconDex-EXE --theme atNight --lang de
   ```
2. `npm run build`, commit `packages/` and `dist/` together.
3. Bump `package.json`, tag `pkg-vX.Y.Z`.
