// Validate every package and emit the release payload + the catalog the app reads.
//
//   node tools/build-packages.mjs           build into dist/
//   node tools/build-packages.mjs --check   validate only, exit 1 on a problem
//
// Output shape, and why:
//   dist/index.json          ONE file the app fetches to see what exists. It
//                            carries each package's sha256, so the app can
//                            verify a payload it downloads separately.
//   dist/<id>-<version>.json the payload, one asset per package. Versioned in
//                            the filename because release assets are immutable
//                            and an installed package records which one it came
//                            from.
//
// Both are published as assets on a `pkg-vX.Y.Z` release. The app fetches over
// plain HTTPS from the release download URL — no GitHub API call, so no
// 60-request-per-hour anonymous rate limit on the path every user hits.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHECK = process.argv.includes('--check');
const KINDS = new Set(['theme', 'lang', 'view', 'uistyle', 'guide']);
const TARGETS = new Set(['exe', 'apk']);

// The 15 palette tokens a theme may set. Not a guess — this is every token that
// actually appears across the 32 built-in blocks in DraconDex-EXE's
// electron/css/themes.css:
//
//   12 in all 32 themes:  --bg --surface --raised --hover --border
//                         --t1 --t2 --t3 --accent --accentH --danger --success
//   --on-accent  in 15/32     --button  in 12/32     --on-button  in 12/32
//
// Anything outside this list is rejected rather than passed through: the app
// applies these as inline CSS variables on <body>, so an unrecognised token
// would either do nothing or collide with a layout variable a theme has no
// business touching.
const THEME_TOKENS = new Set(['--bg','--surface','--raised','--hover','--border',
  '--t1','--t2','--t3','--accent','--accentH','--danger','--success',
  '--button','--on-accent','--on-button']);

// The settings a view package may preset — every one already validated by the
// app's own setUiSetting(). A package can never introduce a setting the app
// does not understand.
const VIEW_SETTINGS = new Set(['size','fontScale','animationsEnabled','animationSpeed',
  'workspaceStyle','navOrientation','navHorizontalDisplay','navVerticalAlwaysLabel',
  'nameMode','nestShowItems','nestShowMajorIcon','nestShowMinorIcon','nestSignatureMode','dragonView']);

// The 7 shape/elevation tokens a uistyle package may set — every one of the
// custom properties DraconDex-EXE's electron/css/ui-style.css assigns per
// body[data-ui-style="<name>"]. Unlike theme's 12-of-15 split there is no
// optional subset here: all 7 are required, because ui-style.css itself sets
// all 7 in every one of its preset blocks.
const UISTYLE_TOKENS = ['--r','--rs','--rl','--shadow-pop','--shadow-float','--shadow-menu','--shadow-modal'];

// v5 Part 7 (APP docs/V5.md §11.8): the module kinds a guide may build. A
// guide is a bundle spec with content — one example module per kind — and
// the app refuses a guide naming a kind it does not have, whole. Must match
// GUIDE_KINDS in DraconDex-EXE's electron/src/db/guide.js.
const GUIDE_KINDS = new Set(['manager', 'inspector', 'classifier', 'locator', 'chronicler', 'wanderer', 'narrator',
  'author', 'scribe', 'drafter', 'exhibitor', 'sketcher', 'designer', 'diviner']);

const problems = [];
const bad = (id, msg) => problems.push(`${id}: ${msg}`);
const semver = /^\d+\.\d+\.\d+$/;

const dir = join(ROOT, 'packages');
const ids = existsSync(dir) ? readdirSync(dir).filter(d => existsSync(join(dir, d, 'pkg.json'))) : [];
if (!ids.length) { console.error('::error::no packages found under packages/'); process.exit(1); }

const entries = [];
for (const id of ids) {
  let meta, payload;
  try { meta = JSON.parse(readFileSync(join(dir, id, 'pkg.json'), 'utf8')); }
  catch (e) { bad(id, `pkg.json does not parse: ${e.message}`); continue; }
  try { payload = JSON.parse(readFileSync(join(dir, id, 'payload.json'), 'utf8')); }
  catch (e) { bad(id, `payload.json does not parse: ${e.message}`); continue; }

  if (meta.id !== id) bad(id, `pkg.json id is "${meta.id}" but the directory is "${id}"`);
  // Must match DraconDex-EXE's validateEntry() in electron/src/db/pkg.js.
  // These two rules disagreeing is worse than either being wrong: the
  // package builds and publishes here, then the app silently drops it from
  // the catalog. Caught exactly that way — theme-clearAurora built fine and
  // would not install.
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(id)) bad(id, `id "${id}" is not [A-Za-z0-9-], max 64`);
  if (!KINDS.has(meta.kind)) bad(id, `kind "${meta.kind}" is not one of ${[...KINDS].join(', ')}`);
  if (!semver.test(meta.version || '')) bad(id, `version "${meta.version}" is not x.y.z`);
  if (!Array.isArray(meta.targets) || !meta.targets.length) bad(id, 'targets must be a non-empty array');
  else for (const t of meta.targets) if (!TARGETS.has(t)) bad(id, `unknown target "${t}"`);
  if (!meta.displayName?.en || !meta.displayName?.th) bad(id, 'displayName needs both en and th');

  if (meta.kind === 'theme') {
    const vars = payload.vars || {};
    const keys = Object.keys(vars);
    if (!keys.length) bad(id, 'a theme package has no vars');
    for (const k of keys) if (!THEME_TOKENS.has(k)) bad(id, `unknown palette token "${k}"`);
    // Without these the app falls back to whatever the previous theme left on
    // <body>, which reads as a half-applied theme rather than a broken one —
    // the worst kind of failure to diagnose.
    // The 12 every built-in theme sets. A package missing one of these leaves
    // whatever the previous theme put on <body>, which reads as a half-applied
    // theme rather than a broken one — the worst kind of failure to diagnose.
    for (const req of ['--bg','--surface','--raised','--hover','--border',
                       '--t1','--t2','--t3','--accent','--accentH','--danger','--success']) {
      if (!vars[req]) bad(id, `theme is missing the required token ${req}`);
    }
  } else if (meta.kind === 'lang') {
    if (!payload.locale) bad(id, 'a lang package has no locale');
    const n = Object.keys(payload.keys || {}).length;
    if (n < 100) bad(id, `only ${n} keys — a locale block should carry the app's full key set`);
  } else if (meta.kind === 'view') {
    const s = payload.settings || {};
    if (!Object.keys(s).length) bad(id, 'a view package has no settings');
    for (const k of Object.keys(s)) if (!VIEW_SETTINGS.has(k)) bad(id, `"${k}" is not a settable UI setting`);
  } else if (meta.kind === 'uistyle') {
    const vars = payload.vars || {};
    const keys = Object.keys(vars);
    for (const k of keys) if (!UISTYLE_TOKENS.includes(k)) bad(id, `unknown ui-style token "${k}"`);
    for (const req of UISTYLE_TOKENS) if (!vars[req]) bad(id, `uistyle is missing the required token ${req}`);
  } else if (meta.kind === 'guide') {
    // The same rules as validateGuide() in the app — here so a guide that
    // would be refused at install time never reaches a release.
    if (payload.format !== 'ddx-guide') bad(id, 'a guide payload needs "format": "ddx-guide"');
    if (!/^[a-z]{2,8}$/.test(payload.locale || '')) bad(id, `guide locale "${payload.locale}" is not a locale code`);
    const mods = payload.spec?.modules;
    if (typeof payload.spec?.name !== 'string' || !payload.spec.name.trim()) bad(id, 'a guide spec has no name');
    if (!Array.isArray(mods) || !mods.length || mods.length > 60) bad(id, 'a guide spec needs 1–60 modules');
    else for (const m of mods) {
      if (!GUIDE_KINDS.has(m?.kind)) bad(id, `guide module kind "${m?.kind}" does not exist in the app`);
      if (typeof m?.name !== 'string' || !m.name.trim()) bad(id, 'a guide module has no name');
    }
  }

  const body = JSON.stringify({ meta, payload }, null, 2) + '\n';
  entries.push({
    id, kind: meta.kind, version: meta.version,
    displayName: meta.displayName, description: meta.description || null,
    targets: meta.targets, minAppVersion: meta.minAppVersion || null,
    asset: `${id}-${meta.version}.json`,
    sha256: createHash('sha256').update(body, 'utf8').digest('hex'),
    bytes: Buffer.byteLength(body, 'utf8'),
    _body: body,
  });
}

if (problems.length) {
  for (const p of problems) console.error(`::error::${p}`);
  console.error(`\n${problems.length} problem(s) in ${ids.length} package(s).`);
  process.exit(1);
}

entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
const pkgVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const index = {
  catalogVersion: 1,
  repo: 'ZYDRAXYL/DraconDex-PKG',
  release: `pkg-v${pkgVersion}`,
  packages: entries.map(({ _body, ...e }) => e),
};
const indexOut = JSON.stringify(index, null, 2) + '\n';

if (CHECK) {
  const cur = existsSync(join(ROOT, 'dist/index.json')) ? readFileSync(join(ROOT, 'dist/index.json'), 'utf8') : null;
  if (cur !== indexOut) { console.error('::error::dist/index.json is stale — run: npm run build'); process.exit(1); }
  for (const e of entries) {
    const p = join(ROOT, 'dist', e.asset);
    if (!existsSync(p) || readFileSync(p, 'utf8') !== e._body) {
      console.error(`::error::dist/${e.asset} is stale or missing — run: npm run build`); process.exit(1);
    }
  }
  console.log(`packages in sync (${entries.length} packages, release ${index.release})`);
  process.exit(0);
}

// Rebuild dist/ from scratch so a renamed or deleted package cannot leave a
// stale asset behind that index.json no longer lists but the release still ships.
rmSync(join(ROOT, 'dist'), { recursive: true, force: true });
mkdirSync(join(ROOT, 'dist'), { recursive: true });
for (const e of entries) writeFileSync(join(ROOT, 'dist', e.asset), e._body);
writeFileSync(join(ROOT, 'dist/index.json'), indexOut);

const byKind = entries.reduce((a, e) => (a[e.kind] = (a[e.kind] || 0) + 1, a), {});
console.log(`built ${entries.length} package(s) into dist/ — ${Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ')}`);
console.log(`release ${index.release}`);
