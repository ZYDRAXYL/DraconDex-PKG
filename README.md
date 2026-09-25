<h1 align="center">DraconDex-PKG</h1>

<p align="center">
  Downloadable theme, language and view packages for
  <a href="https://github.com/ZYDRAXYL/DraconDex-APP">DraconDex</a> — published as
  release assets and installed from inside the app.
</p>

---

## What this is

DraconDex ships 4 themes, 2 UI styles and 18 locales built in; the other 28
themes and 3 UI styles live only here (see `PACKAGES.md`). This repo is how
the app gets **more of them without shipping a new build**: each package is a small JSON
payload published as a release asset, and the app fetches and installs it.

```
packages/<id>/pkg.json      what it is, which app, which version
packages/<id>/payload.json  the data itself
dist/index.json             the catalog the app reads
dist/<id>-<version>.json    one asset per package
```

Three kinds:

| kind | is | applied as |
|---|---|---|
| `theme` | a palette — up to 15 CSS custom properties | inline CSS variables on `<body>` |
| `lang` | a full locale key set (~944 keys) | merged into the app's `L` table at boot |
| `view` | a preset over UI settings the app already has | written to the app's settings |

Nothing here is invented: themes and locales in the app are *already* data.
`themes.css`'s own header says "adding a theme = one block here + one entry in
`UI_THEME_OPTIONS`", and `i18n.js`'s `L` is 18 flat `key:'value'` blocks.
`tools/extract-from-app.mjs` transcribes them with a parser instead of by hand.

## Using it

```bash
npm run build    # validate every package, write dist/
npm run check    # validate only — what CI runs
```

`dist/` is committed, and CI fails when it disagrees with `packages/`. Otherwise
a PR that edits a package without rebuilding would publish a catalog that
contradicts its own payloads.

The full format, and every rule the build enforces, is in
[`PACKAGES.md`](PACKAGES.md) (Thai).

## Integrity

`index.json` carries a SHA-256 for every payload. The app downloads a payload
separately and **verifies it against the catalog before installing** — it does
not trust the file it just fetched.

Packages are fetched over plain HTTPS from the release download URL, never
through `api.github.com`, which caps anonymous requests at 60/hour **per IP**.
That is fine for one visitor and not fine for an office or campus behind one
NAT — and this is a path every install hits.

## Where this sits in the chain

```
APP > SDB > EXE, APK > PKG
```

PKG is downstream of both apps: a package declares which app versions it
supports (`targets`, `minAppVersion`), so an app change can invalidate a
package but never the reverse. See [`chain/README.md`](chain/README.md).

Releases are tagged `pkg-vX.Y.Z` — a fourth namespace alongside `v*`
(DraconDex-EXE), `flutter-v*` (DraconDex-APK) and `sdb-v*` (DraconDex-SDB).

## License

MIT — see [LICENSE](LICENSE).
