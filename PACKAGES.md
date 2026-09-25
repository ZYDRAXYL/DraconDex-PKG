# รูปแบบแพ็กเกจ DraconDex

> สัญญาระหว่าง repo นี้กับตัวแอป — อ่านก่อนเพิ่มแพ็กเกจใหม่ หรือก่อนแก้ฝั่ง
> installer ในแอป

แพ็กเกจ 1 ตัว = 1 โฟลเดอร์ใน `packages/` ที่มี 2 ไฟล์ ไม่มีมากกว่านี้:

```
packages/<id>/pkg.json       metadata — ใครสร้าง ใช้กับแอปตัวไหน เวอร์ชันอะไร
packages/<id>/payload.json   ของจริงที่แอปจะเอาไปใช้
```

## 5 ชนิด

| kind | payload | แอปเอาไปทำอะไร |
|---|---|---|
| `theme` | `{ vars: { "--bg": "#…", … } }` | ใส่เป็น inline CSS variable บน `<body>` |
| `lang` | `{ locale, label, keys: { … } }` | merge เข้า `L` ของ `i18n.js` ตอน boot |
| `view` | `{ settings: { … } }` | preset ทับค่าใน `S.settings` |
| `uistyle` | `{ vars: { "--r": "…", "--shadow-pop": "…", … } }` | ใส่เป็น inline CSS variable บน `<body>` เหมือน `theme` แต่คนละชุด token — ดู 7 ตัวด้านล่าง |
| `guide` | `{ format: "ddx-guide", version, locale, spec: { name, modules: [ … ] } }` | คู่มือในแอปอีกภาษาหนึ่ง — สร้างเป็นโฟลเดอร์ตัวอย่างเมื่อผู้ใช้กดสร้างคู่มือ ไม่ได้ใส่ลง UI |

`uistyle` ใช้กลไกเดียวกับ `theme` เป๊ะ (inline CSS var บน `<body>`) เพียงแต่
เซตของ token เป็นคนละชุด: **7 ตัวจาก `electron/css/ui-style.css`**
(`--r --rs --rl --shadow-pop --shadow-float --shadow-menu --shadow-modal`)
ต้องตั้งครบทั้ง 7 ไม่มีชุด optional เหมือน theme ที่แยก 12/15 เพราะ
`ui-style.css` เองก็ตั้งครบทั้ง 7 ในทุก preset block ของมัน — ไม่มี `oldPlain`
เป็นแพ็กเกจ เพราะมันคือค่า default ของ `tokens.css` เอง ไม่มี CSS block ให้ดึง

`guide` (v5 Part 7, APP `docs/V5.md` §11.8) คือ bundle spec ตัวเดียวกับที่
แม่แบบใน DraconDex-EXE ใช้ (`electron/src/db/bundle.js` อธิบายรูปของ `spec`)
แต่มีเนื้อหาจริง — ตัวอย่าง 1 module ต่อ kind และหน้า "เริ่มที่นี่" ที่ `[[ลิงก์]]`
ไปทุกตัว ภาษาไทยกับอังกฤษฝังมากับแอป (`electron/guide/{th,en}.json`) แพ็กเกจ
`guide` มีไว้สำหรับอีก 16 ภาษา: ถ้ามีแพ็กเกจของภาษานั้นติดตั้งอยู่ แอปใช้ตัวนั้น
ไม่งั้นใช้อังกฤษแล้วบอกว่าดาวน์โหลดได้ที่ไหน · `spec.modules` อ้างได้เฉพาะ kind
ที่แอปมีจริง — ตัว build กับตัวติดตั้งในแอปตรวจกฎเดียวกัน

**แพ็กเกจ `guide-<locale>` ทั้ง 16 ภาษา (Procress 12 part 0) เป็นคำแปลโดยเครื่อง**
แปลจาก `templates/guide/en.json` ของ DraconDex-SDB (ต้นฉบับไทย/อังกฤษย้ายไปอยู่ที่นั่นแล้ว)
ด้วยโครงเดียวกันทุกภาษา — ชื่อ field ในสูตร, key ของค่าใน object และ `[[ลิงก์]]` ทุกอัน
ตรงกับชื่อ module/object ที่แปลแล้วในภาษาเดียวกัน (ตรวจตอนสร้าง และลองสร้างจริงผ่าน
`createBundle` ของ EXE แล้ว: ลิงก์ 19 อัน ห้อยอยู่อันเดียวคือ `[[ลิงก์]]` ตัวอย่างใน "About Mira"
เหมือนต้นฉบับ) · ชื่อ kind (Classifier, Exhibitor…) และชื่อ view (Graph, Table, Board, Reader)
คงเป็นอังกฤษเพราะแอปแสดงแบบนั้นทุกภาษา · ปุ่มที่อ้างถึงใช้คำเดียวกับ i18n ของแอป
**ผู้พูดภาษานั้นแก้ได้เลย** — แก้ `payload.json` ตรง ๆ แล้วบัมพ์ `version` ใน `pkg.json`

## `pkg.json`

```json
{
  "id": "theme-midnight",
  "kind": "theme",
  "name": "midnight",
  "displayName": { "en": "Midnight", "th": "เที่ยงคืน" },
  "version": "1.0.0",
  "targets": ["exe"],
  "minAppVersion": "4.16.0"
}
```

`displayName` ต้องมีทั้ง `en` และ `th` — เว็บกับแอปใช้คนละภาษาเป็น default
`targets` บอกว่าแพ็กเกจนี้ใช้กับ `exe` (Electron) หรือ `apk` (Flutter) ได้บ้าง
เพราะสองฝั่งไม่เท่ากัน: Electron ฝังมา 4 ธีมกับ 18 ภาษา, Flutter มี 3 ธีมกับ 13 ภาษา

## แพ็กเกจไหนแทนของที่ฝังในแอป (Procress 10 part 2)

ตั้งแต่ EXE `5.0.0-10` แอปฝังมาแค่ **ธีม 4 ตัว** (`daylight` `moonlight`
`midnight` `rainbow`) กับ **UI style 2 ตัว** (`oldPlain` `fluent`) — ที่เหลือ
**มีเฉพาะที่นี่**: `theme-*` อีก 28 ตัว และ `uistyle-roundedMinimal`
`uistyle-cleanMinimal` `uistyle-hardBlock` ในหน้า Setting → Appearance ของแอป
ตัวที่ยังไม่ดาวน์โหลดจะขึ้นเป็นช่องล็อกพร้อมปุ่มดาวน์โหลด

- **ห้ามลบหรือเปลี่ยน `id` ของ 31 ตัวนี้** — แอปแปลงค่าที่ผู้ใช้เคยตั้งไว้
  (`theme: 'atDusk'`) เป็น `pkg:theme-atDusk` แล้วดาวน์โหลดเองตอนเปิดแอป
  ถ้า id หาย ผู้ใช้คนนั้นจะค้างอยู่ที่ midnight ตลอด
- payload ของทั้ง 31 ตัว**ตรงกับ CSS block เดิมทุกค่า** (ตรวจแล้วก่อนลบออกจากแอป)
- `rainbow` ยังฝังในแอป เพราะมี rule นอก palette (กรอบไล่สี, แผงเบลอ) ที่แพ็กเกจ
  theme ใส่ไม่ได้ · `fluent` ยังฝัง เพราะ Procress 13 จะขยายมันเกิน 7 token
- ภาษายังฝังครบ 18 ภาษา — แพ็กเกจ `lang-*` จึงยังเป็นของซ้ำกับในแอป

## ข้อจำกัดที่ตัว build บังคับ

`tools/build-packages.mjs` ตรวจก่อน build ทุกครั้ง (`npm run check` คือตัวเดียวกัน
แบบไม่เขียนไฟล์ — CI ใช้ตัวนี้) และ **fail ทันที** ถ้า:

- **theme** ตั้ง token นอก 16 ตัวที่มีจริง (รวม `--t3-aa` — ข้อความจาง ≥ 4.5:1 ค่ามาจาก DraconDex-SDB `design/tokens.json`) หรือขาด 1 ใน 12 ตัวที่ทุกธีม built-in
  มีครบ — ธีมที่ขาด token จะไม่พังชัดๆ แต่จะทิ้งค่าของธีมเดิมค้างบน `<body>`
  กลายเป็นธีมครึ่งๆ กลางๆ ที่หาสาเหตุยากที่สุด
- **lang** มี key น้อยกว่า 100 — locale block จริงมี ~944 key ถ้าน้อยกว่านั้นแปลว่า
  extract มาไม่ครบ (key ที่หายจะ render เป็นชื่อ key ตรงๆ ไม่ error)
- **view** ตั้ง setting ที่แอปไม่รู้จัก — ทุก key ต้องเป็นตัวที่ `setUiSetting()`
  validate อยู่แล้ว แพ็กเกจจึงไม่มีทางสร้าง setting ใหม่ที่แอปไม่เข้าใจ
- **uistyle** ตั้ง token นอก 7 ตัวที่มีจริง หรือขาดตัวใดตัวหนึ่งใน 7 — ไม่มี
  ชุด optional เหมือน theme, ครบทั้ง 7 เท่านั้น
- **guide** ไม่มี `format: "ddx-guide"` หรือ `locale`, `spec` ไม่มีชื่อ, มี module
  0 หรือเกิน 60 ตัว หรืออ้าง kind ที่แอปไม่มี — แอปจะปฏิเสธทั้งแพ็กเกจตอนติดตั้ง
  เพราะคู่มือที่สร้าง module ผิดชนิดคือโฟลเดอร์ที่พังทั้งโฟลเดอร์
- `id` ไม่ตรงชื่อโฟลเดอร์, `version` ไม่ใช่ `x.y.z`, `targets` ว่าง,
  `displayName` ขาด `en` หรือ `th`

## Build แล้วได้อะไร

```bash
npm run build     # เขียน dist/
npm run check     # ตรวจอย่างเดียว — CI ใช้ตัวนี้
```

```
dist/index.json              catalog ไฟล์เดียวที่แอปดึงมาดูว่ามีอะไรบ้าง
dist/<id>-<version>.json     payload 1 ไฟล์ต่อ 1 แพ็กเกจ
```

`index.json` มี `sha256` ของทุก payload — แอปดาวน์โหลด payload แยกแล้ว **ตรวจ hash
เทียบกับ catalog ก่อนติดตั้ง** ไม่ใช่เชื่อไฟล์ที่ดาวน์โหลดมาตรงๆ

แพ็กเกจ `theme` และ `uistyle` มี **`preview: { vars }`** ใน `index.json` ด้วย —
ก็อปจาก `payload.vars` ของตัวเองตอน build (ไม่มีใครเขียนมือ จึงไม่มีทางไม่ตรง)
แอปใช้วาดตัวอย่างสีและรูปทรงในช่องที่ยังล็อกอยู่ ให้ผู้ใช้เห็นก่อนกดดาวน์โหลด ·
**ใช้แสดงผลอย่างเดียว** แอปตรวจด้วยกฎเดียวกับ payload และไม่เคยเอาไป apply —
ที่ apply จริงยังเป็น payload ที่ผ่านการตรวจ hash แล้วเท่านั้น

ชื่อไฟล์มีเวอร์ชันติดมาด้วยเพราะ release asset เปลี่ยนไม่ได้ และแพ็กเกจที่ติดตั้ง
แล้วต้องจำได้ว่ามาจาก asset ตัวไหน

`dist/` **commit ไว้ด้วย** และ CI fail ถ้ามันไม่ตรงกับ `packages/` — ไม่งั้น PR ที่
แก้แพ็กเกจแต่ลืม build จะ publish catalog ที่ขัดกับ payload ของตัวเอง

## แอปดึงยังไง

ผ่าน **HTTPS ตรงไปที่ release download URL** ไม่ผ่าน `api.github.com` เลย —
API แบบไม่ล็อกอินจำกัด 60 request/ชั่วโมง **ต่อ IP** ซึ่งพอสำหรับคนเดียวแต่ไม่พอ
สำหรับออฟฟิศหรือมหาลัยที่ออกเน็ตทาง NAT เดียวกัน และนี่คือ path ที่ทุกเครื่องเรียก

**ฝั่ง Electron ต้องดึงใน main process เท่านั้น** — `electron/index.html` ตั้ง
`connect-src 'none'` ไว้ renderer จึง fetch อะไรไม่ได้เลย และ `style-src 'self'`
ก็แปลว่า `<link>` ไฟล์ `.css` ที่โหลดมาไม่ได้เช่นกัน ธีมจึงต้องลงเป็น inline CSS
variable บน `<body>` ซึ่งเป็นทางที่ `applyUiSettings()` ใช้กับ custom theme
อยู่แล้ว

## Release

tag `pkg-vX.Y.Z` ต้องตรงกับ `package.json`'s `version` (workflow บังคับ)
`pkg-v*` เป็น namespace ที่ 4 ต่อจาก `v*` (EXE), `flutter-v*` (APK), `sdb-v*` (SDB)
— update checker ของทั้งสองแอป filter ตาม prefix อยู่แล้ว จึงข้ามพวกนี้ไปเอง

## เพิ่มแพ็กเกจใหม่

1. สร้าง `packages/<id>/pkg.json` + `payload.json`
2. `npm run build` แล้ว commit ทั้ง `packages/` และ `dist/`
3. bump `package.json` version, tag `pkg-vX.Y.Z`

ถ้าจะดึงธีม/ภาษาจากแอปมาเป็นแพ็กเกจ ใช้ตัวช่วย (dev tool ไม่ใช่ส่วนของ build):

```bash
node tools/extract-from-app.mjs --exe ../DraconDex-EXE --theme atNight clearMoon
node tools/extract-from-app.mjs --exe ../DraconDex-EXE --lang de fr
node tools/extract-from-app.mjs --exe ../DraconDex-EXE --uistyle fluent hardBlock
```
