# Invitation Studio

A login-based invitation creator for Wedding, Birthday, Engagement, and Office Party cards.

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

Database settings can be overridden with `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.

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
