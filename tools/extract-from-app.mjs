// One-shot extractor: pull theme and locale data out of a DraconDex-EXE
// checkout and write it as packages here.
//
//   node tools/extract-from-app.mjs --exe ../DraconDex-EXE --theme midnight atDusk
//   node tools/extract-from-app.mjs --exe ../DraconDex-EXE --lang ja ko
//   node tools/extract-from-app.mjs --exe ../DraconDex-EXE --uistyle fluent hardBlock
//
// This exists because the data ALREADY IS data — themes.css says so in its own
// header ("adding a theme = one block here + one entry in UI_THEME_OPTIONS"),
// and i18n.js's `L` is 18 flat key:'value' blocks. Nothing here is invented;
// it is transcription with a parser instead of by hand.
//
// It is a development tool, not part of the build. Packages, once extracted,
// are edited here.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const argOf = f => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const listAfter = f => {
  const i = process.argv.indexOf(f);
  if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < process.argv.length && !process.argv[j].startsWith('--'); j++) out.push(process.argv[j]);
  return out;
};

const EXE = argOf('--exe') || '../DraconDex-EXE';
const need = p => {
  const abs = join(ROOT, EXE, p);
  if (!existsSync(abs)) { console.error(`::error::${abs} not found — pass --exe <path to a DraconDex-EXE checkout>`); process.exit(1); }
  return readFileSync(abs, 'utf8');
};

function writePackage(id, meta, payload) {
  const dir = join(ROOT, 'packages', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pkg.json'), JSON.stringify(meta, null, 2) + '\n');
  writeFileSync(join(dir, 'payload.json'), JSON.stringify(payload, null, 2) + '\n');
  console.log(`  wrote packages/${id}/`);
}

// Shared by --theme and --uistyle: turn a `{ --tok: val; ... }` block body
// into a { '--tok': 'val' } map. Comments are stripped first — ui-style.css's
// hardBlock block carries one between declarations, and a naive split(';')
// merges the comment into the following declaration, silently dropping it
// (caught extracting hardBlock: 6 tokens came out instead of 7).
function parseCssVarBlock(body) {
  const vars = {};
  for (const decl of body.replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
    const [k, v] = decl.split(':').map(s => s && s.trim());
    if (k && v && k.startsWith('--')) vars[k] = v;
  }
  return vars;
}

// ---- themes -----------------------------------------------------------------
const themes = listAfter('--theme');
if (themes.length) {
  const css = need('electron/css/themes.css');
  for (const name of themes) {
    // Each theme is exactly one `body[data-theme="<name>"]{ --tok:val; ... }`
    // block. Matching the literal selector rather than parsing CSS keeps this
    // honest: if the file ever stops being pure data, this stops working
    // loudly instead of extracting something half-right.
    const re = new RegExp(`body\\[data-theme="${name}"\\]\\s*\\{([^}]*)\\}`);
    const m = re.exec(css);
    if (!m) { console.error(`::error::no body[data-theme="${name}"] block in themes.css`); process.exit(1); }
    const vars = parseCssVarBlock(m[1]);
    writePackage(`theme-${name}`, {
      id: `theme-${name}`, kind: 'theme', name,
      displayName: { en: name, th: name },
      version: '1.0.0', targets: ['exe'], minAppVersion: '4.16.0',
      source: 'extracted from DraconDex-EXE electron/css/themes.css',
    }, { vars });
    console.log(`    ${name}: ${Object.keys(vars).length} tokens`);
  }
}

// ---- locales ----------------------------------------------------------------
const langs = listAfter('--lang');
if (langs.length) {
  const js = need('electron/src/renderer/i18n.js');
  const labels = /const LANGUAGE_LABELS\s*=\s*(\{[^\n]*\})/.exec(js);
  const labelMap = labels ? eval(`(${labels[1]})`) : {};
  for (const code of langs) {
    // Locale blocks are `  <code>: { ... }` inside `const L = {`, each one flat
    // key:'value'. Scan braces rather than regex the whole block: the values
    // contain braces and quotes of their own.
    const start = js.indexOf(`\n  ${code}: {`);
    if (start < 0) { console.error(`::error::no "${code}:" block in i18n.js's const L`); process.exit(1); }
    let i = js.indexOf('{', start), depth = 0, end = -1;
    for (let j = i; j < js.length; j++) {
      if (js[j] === '{') depth++;
      else if (js[j] === '}') { depth--; if (!depth) { end = j; break; } }
    }
    const keys = eval(`(${js.slice(i, end + 1)})`);
    writePackage(`lang-${code}`, {
      id: `lang-${code}`, kind: 'lang', name: code,
      displayName: { en: labelMap[code] || code, th: labelMap[code] || code },
      version: '1.0.0', targets: ['exe'], minAppVersion: '4.16.0',
      source: 'extracted from DraconDex-EXE electron/src/renderer/i18n.js',
    }, { locale: code, label: labelMap[code] || code, keys });
    console.log(`    ${code}: ${Object.keys(keys).length} keys`);
  }
}

// ---- ui styles --------------------------------------------------------------
// ui-style.css carries no label table the way i18n.js's LANGUAGE_LABELS does
// for langs, so displayName comes from this small local map instead — matches
// setting-window.js's UI_STYLE_LABEL_KEY English side. 'oldPlain' is
// deliberately absent: it IS tokens.css's own defaults, with no
// body[data-ui-style="oldPlain"] block to extract from.
const UISTYLE_LABELS = {
  roundedMinimal: 'Rounded minimal', cleanMinimal: 'Clean minimal',
  fluent: 'Fluent style', hardBlock: 'Hard block',
};
const uistyles = listAfter('--uistyle');
if (uistyles.length) {
  const css = need('electron/css/ui-style.css');
  for (const name of uistyles) {
    // Same literal-selector match as --theme: one body[data-ui-style="<name>"]
    // block per preset in ui-style.css.
    const re = new RegExp(`body\\[data-ui-style="${name}"\\]\\s*\\{([^}]*)\\}`);
    const m = re.exec(css);
    if (!m) { console.error(`::error::no body[data-ui-style="${name}"] block in ui-style.css`); process.exit(1); }
    const vars = parseCssVarBlock(m[1]);
    const label = UISTYLE_LABELS[name] || name;
    writePackage(`uistyle-${name}`, {
      id: `uistyle-${name}`, kind: 'uistyle', name,
      displayName: { en: label, th: label },
      version: '1.0.0', targets: ['exe'], minAppVersion: '4.16.0',
      source: 'extracted from DraconDex-EXE electron/css/ui-style.css',
    }, { vars });
    console.log(`    ${name}: ${Object.keys(vars).length} tokens`);
  }
}

if (!themes.length && !langs.length && !uistyles.length) {
  console.log('nothing to do — pass --theme <names...>, --lang <codes...> and/or --uistyle <names...>');
}
