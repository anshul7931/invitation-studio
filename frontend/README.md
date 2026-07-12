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
│   ├── css/
│   │   ├── design-tokens.css
│   │   └── glyphs.css
│   ├── dialogs/
│   │   ├── delete-dialog.html
│   │   └── profile-dialog.html
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
- `server/occasion-schema.js` → `birthday` only when changing API defaults/required fields/fingerprint fields.

### Wedding / Marriage card only

Edit:

- `frontend/Occasions/Marriage/wedding.js` for rendering behavior.
- `frontend/Occasions/Marriage/wedding-form.html` as the form source reference.
- `frontend/Occasions/Marriage/wedding-card.html` for the large wedding-card SVG/HTML runtime markup.
- `frontend/Occasions/Marriage/wedding-card-map.md` to find the stable DOM IDs used by `wedding.js`.
- `server/occasion-schema.js` → `wedding` only when changing API defaults/required fields/fingerprint fields.

### Engagement card only

Edit:

- `frontend/Occasions/Engagement/engagement.js`
- `server/occasion-schema.js` → `engagement` only when changing API defaults/required fields/fingerprint fields.

### Office Party card only

Edit:

- `frontend/Occasions/OfficeParty/office.js`
- `server/occasion-schema.js` → `office` only when changing API defaults/required fields/fingerprint fields.

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
