# รูปแบบแพ็กเกจ DraconDex

> สัญญาระหว่าง repo นี้กับตัวแอป — อ่านก่อนเพิ่มแพ็กเกจใหม่ หรือก่อนแก้ฝั่ง
> installer ในแอป

แพ็กเกจ 1 ตัว = 1 โฟลเดอร์ใน `packages/` ที่มี 2 ไฟล์ ไม่มีมากกว่านี้:

```
packages/<id>/pkg.json       metadata — ใครสร้าง ใช้กับแอปตัวไหน เวอร์ชันอะไร
packages/<id>/payload.json   ของจริงที่แอปจะเอาไปใช้
```

## 3 ชนิด

| kind | payload | แอปเอาไปทำอะไร |
|---|---|---|
| `theme` | `{ vars: { "--bg": "#…", … } }` | ใส่เป็น inline CSS variable บน `<body>` |
| `lang` | `{ locale, label, keys: { … } }` | merge เข้า `L` ของ `i18n.js` ตอน boot |
| `view` | `{ settings: { … } }` | preset ทับค่าใน `S.settings` |

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
เพราะสองฝั่งไม่เท่ากัน: Electron มี 32 ธีมกับ 18 ภาษา, Flutter มี 3 ธีมกับ 13 ภาษา

## ข้อจำกัดที่ตัว build บังคับ

`tools/build-packages.mjs` ตรวจก่อน build ทุกครั้ง (`npm run check` คือตัวเดียวกัน
แบบไม่เขียนไฟล์ — CI ใช้ตัวนี้) และ **fail ทันที** ถ้า:

- **theme** ตั้ง token นอก 15 ตัวที่มีจริง หรือขาด 1 ใน 12 ตัวที่ทุกธีม built-in
  มีครบ — ธีมที่ขาด token จะไม่พังชัดๆ แต่จะทิ้งค่าของธีมเดิมค้างบน `<body>`
  กลายเป็นธีมครึ่งๆ กลางๆ ที่หาสาเหตุยากที่สุด
- **lang** มี key น้อยกว่า 100 — locale block จริงมี ~944 key ถ้าน้อยกว่านั้นแปลว่า
  extract มาไม่ครบ (key ที่หายจะ render เป็นชื่อ key ตรงๆ ไม่ error)
- **view** ตั้ง setting ที่แอปไม่รู้จัก — ทุก key ต้องเป็นตัวที่ `setUiSetting()`
  validate อยู่แล้ว แพ็กเกจจึงไม่มีทางสร้าง setting ใหม่ที่แอปไม่เข้าใจ
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
```
