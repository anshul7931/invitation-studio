# Frontend source layout

This folder separates the UI into maintainable areas while preserving the current runtime behavior.

`index.html` is now a single-page runtime shell with server-side include markers. `server.js` replaces those markers with files from this `frontend/` folder before sending the page to the browser, so the structured files are the live source for page markup.

## Folder map

```text
frontend/
├── Occasions/
│   ├── Birthday/
│   │   ├── birthday.js
│   │   └── README.md
│   ├── Marriage/
│   │   ├── wedding.js
│   │   ├── wedding-form.html
│   │   └── wedding-card-map.md
│   ├── Engagement/
│   │   ├── engagement.js
│   │   └── README.md
│   └── OfficeParty/
│       ├── office.js
│       └── README.md
├── Dashboard/
│   ├── UserDashboard/user-dashboard.html
│   └── AdminDashboard/admin-dashboard.html
├── General/
│   ├── js/svg-registry.js   # Central motif SVGs, per-occasion options, and defaults
│   ├── css/
│   │   ├── design-tokens.css
│   │   └── glyphs.css
│   ├── dialogs/
│   │   ├── delete-dialog.html
│   │   ├── profile-dialog.html
│   │   └── signout-dialog.html
│   ├── js/form-renderer.js
│   └── svgs/brand-glyph.svg
└── StaticPages/
    ├── About/about.html
    ├── ContactUs/contact-us.html
    ├── TermsAndConditions/terms-and-conditions.html
    ├── Privacy/privacy.html
    ├── Refund/refund.html
    ├── Disclaimer/disclaimer.html
    ├── AcceptableUse/acceptable-use.html
    └── NotFound/404.html
```

## What to edit

### Birthday card only

Edit:

- `frontend/Occasions/Birthday/birthday.js`
- `backend/occasion-schema.js` → `birthday` only when changing API defaults/required fields/fingerprint fields.

### Motif SVGs

`frontend/General/js/svg-registry.js` is the single mapping for motif choices and defaults. Invitation artwork uses lowercase category-number filenames in `frontend/General/svgs/`: `cake1–2`, `couple1–3`, `ganesha1–3`, `bouquet1–3`, `rings1–3`, plus `cradle1`, `house1`, `kalash1`, `lotus1–2`, and `wreath1` (all with `.svg`). `brand-glyph.svg` and `favicon.svg` are intentionally separate and keep their names. The paths are centralized in `svgAssetMap`. To add artwork, use the next number for its category, add its path/key there, then add the key to the relevant catalog and occasion options. The card creator shows image-only choices (names are retained as accessible labels, not displayed beneath images).

`frontend/General/js/svg-theme.js` contains the `THEME_ADAPTED_ASSETS` allow-list. Only listed SVG filenames inherit invitation colours; all other artwork (including bouquets) keeps its original palette. Add/remove filenames there to control the effect. `brand-glyph.svg` and `favicon.svg` are separate and never included.

### Wedding / Marriage card only

Edit:

- `frontend/Occasions/Marriage/wedding.js` for rendering behavior.
- `frontend/Occasions/Marriage/wedding-form.html` as the form source reference.
- `frontend/Occasions/Marriage/wedding-card.html` for the large wedding-card SVG/HTML runtime markup.
- `frontend/Occasions/Marriage/wedding-card-map.md` to find the stable DOM IDs used by `wedding.js`.
- `backend/occasion-schema.js` → `wedding` only when changing API defaults/required fields/fingerprint fields.

### Engagement card only

Edit:

- `frontend/Occasions/Engagement/engagement.js`
- `backend/occasion-schema.js` → `engagement` only when changing API defaults/required fields/fingerprint fields.

### Office Party card only

Edit:

- `frontend/Occasions/OfficeParty/office.js`
- `backend/occasion-schema.js` → `office` only when changing API defaults/required fields/fingerprint fields.

### Dashboard

Edit:

- User dashboard markup: `frontend/Dashboard/UserDashboard/user-dashboard.html`
- Admin dashboard markup: `frontend/Dashboard/AdminDashboard/admin-dashboard.html`
- Runtime event behavior remains in `js/app.js` until dashboard event modules are extracted.

### Reusable UI

Edit:

- Dialog markup: `frontend/General/dialogs/`
- Shared SVGs: `frontend/General/svgs/`
- Shared form renderer: `frontend/General/js/form-renderer.js`
- Shared design tokens/glyph styles: `frontend/General/css/`

### Static pages

Edit files under `frontend/StaticPages/`.

The current runtime sections are included through `frontend/StaticPages/static-pages.html` with these IDs:

- `aboutPage`
- `contactPage`
- `privacyPage`
- `termsPage`
- `refundPage`
- `disclaimerPage`
- `acceptableUsePage`
- `notFoundPage`

## Current compatibility wrappers

The browser still imports from the existing `js/` paths. Those files now re-export from `frontend/`:

- `js/occasions/birthday.js` → `frontend/Occasions/Birthday/birthday.js`
- `js/occasions/engagement.js` → `frontend/Occasions/Engagement/engagement.js`
- `js/occasions/office.js` → `frontend/Occasions/OfficeParty/office.js`
- `js/occasions/wedding.js` → `frontend/Occasions/Marriage/wedding.js`
- `js/ui/form-renderer.js` → `frontend/General/js/form-renderer.js`

## After modifying files

Run:

```bash
npm run check
node --input-type=module --check < js/app.js
node --input-type=module --check < frontend/Occasions/Birthday/birthday.js
node --input-type=module --check < frontend/Occasions/Engagement/engagement.js
node --input-type=module --check < frontend/Occasions/OfficeParty/office.js
node --input-type=module --check < frontend/Occasions/Marriage/wedding.js
node --input-type=module --check < frontend/General/js/form-renderer.js
```

## Important note

This is a non-breaking source separation. It does not introduce a frontend bundler; instead, the Node server performs simple HTML includes at request time. Keep `id`, `name`, and `data-*` attributes stable unless you also update the JavaScript that reads them.
