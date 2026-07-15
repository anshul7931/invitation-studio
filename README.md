# Invitation Studio

A login-based invitation creator for Wedding, Birthday, Engagement, and Office Party cards.

## Project structure

```text
invitation-studio/
├── database/
│   └── schema.sql              # Reference MySQL schema used by the app
├── frontend/
│   ├── Occasions/              # Occasion-specific frontend source files
│   ├── Dashboard/              # User/Admin dashboard HTML ownership
│   ├── General/                # Shared dialogs, SVGs, CSS tokens, reusable JS
│   └── StaticPages/            # About, Contact, Terms, 404 and policy pages
├── js/
│   ├── app.js                  # Browser controller: auth, routing, saves, sharing, UI state
│   ├── occasions/              # Compatibility wrappers into frontend/Occasions
│   └── ui/                     # Compatibility wrapper into frontend/General/js
├── backend/
│   ├── apis/                   # Auth, profile, admin, occasion, invitation, and public APIs
│   ├── middleware/             # Request guards such as signed-in/admin checks
│   ├── services/               # Business workflows such as email verification/reset flows
│   ├── utils/                  # HTTP, template, DTO, text, and Swagger page helpers
│   ├── auth.js                 # Password hashing, sessions, and auth helpers
│   ├── app.js                  # HTTP server wiring, static routes, Swagger UI, SPA shell serving
│   ├── config.js               # Central constants and environment-variable defaults
│   ├── database.js             # MySQL connection and auto-migration bootstrap
│   ├── env-loader.js           # Loads local .env/.env.local files before config is built
│   ├── email/
│   │   ├── service.js          # Provider-neutral transactional email orchestration
│   │   └── providers/
│   │       └── resend.js       # Resend adapter
│   ├── occasion-schema.js      # Backend occasion defaults, validation, titles, fingerprints
│   └── openapi.js              # Swagger/OpenAPI document generation
├── index.html                  # Single-page shell with server-side frontend includes
├── server.js                   # Thin launcher for backend/app.js
├── package.json                # Node project metadata and scripts
└── requirements.txt            # Requirement/task tracker notes
```

### Frontend modification guide

For UI changes, start with `frontend/README.md`. It maps each occasion, dashboard, reusable dialog/SVG, and static page to the right file. `index.html` now uses server-side include markers that are resolved from the `frontend/` files by `backend/utils/http.js`.

### Occasion data ownership

- `backend/occasion-schema.js` is the source of truth for API defaults, required fields, invitation title fields, and public-link fingerprint fields.
- `frontend/Occasions/*/*.js` owns frontend presentation details: form labels/sections, theme choices, and how each card is rendered.
- `js/occasions/*.js` exists as compatibility wrappers for the current browser imports.
- The browser fetches `/api/occasions/:occasion` before rendering dynamic occasion forms so backend defaults prefill the UI without duplicating demo values in every frontend module.

## Run locally

MySQL must be available at `127.0.0.1:3306`. The default connection is:

- User: `root`
- Password: `root`
- Database: `invitation_factory`

The database and tables are created automatically on startup.

```bash
npm install
npm start
```

Open:

- Application: `http://127.0.0.1:3000`
- Swagger UI: `http://127.0.0.1:3000/api-docs`
- OpenAPI JSON: `http://127.0.0.1:3000/openapi.json`

## Environment variables

All configuration is centralized in `backend/config.js`. If an environment variable is not set, the default below is used.

Local `.env` and `.env.local` files are loaded automatically on startup, so you do not need to prefix every `npm start` command with environment variables. These files are ignored by Git. Use `.env.example` as the safe template.

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `Invitation Studio` | Application name used by server-side configuration. |
| `HOST` | `127.0.0.1` | App host value in config. |
| `PORT` | `3000` | HTTP server port. |
| `PUBLIC_APP_URL` | `http://127.0.0.1:3000` | Public base URL used in emailed verification/reset links. |
| `PUBLIC_SHARE_MINUTES` | `10` | Number of minutes a generated public card link remains valid. |
| `ADMIN_EMAILS` | `admin@invitation.local` | Comma-separated emails that receive the `ADMIN` role on registration. |
| `DB_HOST` | `127.0.0.1` | MySQL host. |
| `DB_PORT` | `3306` | MySQL port. |
| `DB_USER` | `root` | MySQL user. |
| `DB_PASSWORD` | `root` | MySQL password. |
| `DB_NAME` | `invitation_factory` | MySQL database/schema name. |
| `DB_CONNECTION_LIMIT` | `10` | MySQL pool connection limit. |
| `SESSION_COOKIE_NAME` | `invitation_session` | HttpOnly session cookie name. |
| `SESSION_DAYS` | `30` | Login session duration in days. |
| `PAYMENT_PATH` | `/plans` | Placeholder plans route used when free public-link generation is exhausted. |
| `MAX_JSON_BODY_BYTES` | `1000000` | Maximum JSON request body size accepted by the API. |
| `EMAIL_ENABLED` | `false` | Enables real transactional email sending when set to `true`. |
| `EMAIL_PROVIDER` | `resend` | Default email provider key. |
| `VERIFY_EMAIL_PROVIDER` | value of `EMAIL_PROVIDER` | Provider used for verification emails. |
| `RESET_PASSWORD_EMAIL_PROVIDER` | value of `EMAIL_PROVIDER` | Provider used for reset-password emails. |
| `EMAIL_FROM` | `Invitation Studio <onboarding@resend.dev>` | Sender used for transactional emails. Replace with a verified sender/domain before production. |
| `EMAIL_REPLY_TO` | empty | Optional reply-to email address. |
| `EMAIL_VERIFY_TOKEN_MINUTES` | `60` | Verification link validity window. |
| `PASSWORD_RESET_TOKEN_MINUTES` | `30` | Password-reset link validity window. |
| `EMAIL_RATE_LIMIT_PER_SECOND` | `10` | Application-level email send limit per second. |
| `EMAIL_RATE_LIMIT_PER_DAY` | `100` | Application-level email send limit per day. |
| `RESEND_API_KEY` | empty | Resend API key. Keep this in the environment; do not commit it. |
| `RESEND_API_URL` | `https://api.resend.com/emails` | Resend send-email API endpoint. |

## Email verification and password reset

Transactional email is intentionally provider-neutral:

- `backend/email/service.js` contains shared orchestration, provider selection, send logging, and app-level rate limiting.
- `backend/email/providers/resend.js` contains the Resend-specific request/response mapping.
- Verification emails and password-reset emails can use different providers through `VERIFY_EMAIL_PROVIDER` and `RESET_PASSWORD_EMAIL_PROVIDER`.

Email sending is disabled unless `EMAIL_ENABLED=true`. When disabled, verification/reset tokens are still created and sends are logged as `SKIPPED`, which is useful for local development without accidentally using a real provider.

To use Resend locally:

```bash
cp .env.example .env
```

Then edit `.env` and set `RESEND_API_KEY` plus your verified `EMAIL_FROM` sender. After that, run `npm start` normally.

Supported flows:

- `POST /api/auth/verify-email/request` sends/resends a verification email for the signed-in user.
- `POST /api/auth/verify-email` verifies a token from `/verify-email?token=...`.
- `POST /api/auth/forgot-password` sends a reset link if the account exists.
- `POST /api/auth/reset-password` resets the password using `/reset-password?token=...`.

The current app-level email limits default to 10 sends per second and 100 sends per day.

## SVG asset note

SVGs in `frontend/General/svgs/` that were imported from free-use sources now include the non-visual attribute `data-invitation-studio-tweak="tiny-root-metadata-shift"` on the root SVG element. This records the tiny customization pass without changing visible artwork. New app-owned SVGs such as the favicon and card motifs are original inline/vector assets.

Card creation also exposes SVG customization controls using the reference assets in `frontend/General/svgs/`: wedding cards can switch between the inline Ganesha and the uploaded Ganesha SVGs, switch the couple illustration to the uploaded couple SVG, and change the monogram motif; birthday cards can use the uploaded cake SVG; engagement cards can use the uploaded couple/rings SVGs or the app-owned motifs.

## Postman authentication

1. Call `POST /api/auth/register` or `POST /api/auth/login`.
2. Keep Postman's cookie jar enabled. The response sets the HttpOnly `invitation_session` cookie.
3. Use that session for invitation list, create, update, retrieve, and delete requests.

Example registration body:

```json
{
  "name": "Aisha Sharma",
  "email": "aisha@example.com",
  "password": "secret123"
}
```

Example card creation:

```http
POST /api/invitations/birthday
Content-Type: application/json
```

```json
{
  "celebrant": "Maya Singh",
  "date": "2026-08-22",
  "time": "20:00",
  "venue": "The Courtyard",
  "address": "Mumbai",
  "message": "Please join us to celebrate."
}
```

The full API contract and request models are available in Swagger.
