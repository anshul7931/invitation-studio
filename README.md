# Invitation Studio

A login-based invitation creator for Wedding, Birthday, Engagement, and Office Party cards.

## Project structure

```text
invitation-studio/
├── database/
│   └── schema.sql              # Reference MySQL schema used by the app
├── js/
│   ├── app.js                  # Browser controller: auth, routing, saves, sharing, UI state
│   ├── occasions/
│   │   ├── registry.js         # Frontend occasion registry
│   │   ├── wedding.js          # Wedding card renderer
│   │   ├── birthday.js         # Birthday presentation metadata and renderer
│   │   ├── engagement.js       # Engagement presentation metadata and renderer
│   │   ├── office.js           # Office-party presentation metadata and renderer
│   │   └── README.md           # Notes for adding a new occasion
│   └── ui/
│       └── form-renderer.js    # Shared renderer for dynamic non-wedding forms
├── server/
│   ├── auth.js                 # Password hashing, sessions, and auth helpers
│   ├── config.js               # Central constants and environment-variable defaults
│   ├── database.js             # MySQL connection and auto-migration bootstrap
│   ├── occasion-schema.js      # Backend occasion defaults, validation, titles, fingerprints
│   └── openapi.js              # Swagger/OpenAPI document generation
├── index.html                  # Single-page app markup and inline styling
├── server.js                   # HTTP server, API routes, static serving, Swagger UI
├── package.json                # Node project metadata and scripts
└── requirements.txt            # Requirement/task tracker notes
```

### Occasion data ownership

- `server/occasion-schema.js` is the source of truth for API defaults, required fields, invitation title fields, and public-link fingerprint fields.
- `js/occasions/*.js` owns only frontend presentation details: form labels/sections, theme choices, and how each card is rendered.
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

All configuration is centralized in `server/config.js`. If an environment variable is not set, the default below is used.

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `Invitation Studio` | Application name used by server-side configuration. |
| `HOST` | `127.0.0.1` | App host value in config. |
| `PORT` | `3000` | HTTP server port. |
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
| `PAYMENT_PATH` | `/payment` | Placeholder payment route used when free public-link generation is exhausted. |
| `MAX_JSON_BODY_BYTES` | `1000000` | Maximum JSON request body size accepted by the API. |

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
