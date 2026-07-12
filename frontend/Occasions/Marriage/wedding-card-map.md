# Marriage / Wedding card edit map

Use this folder when changing only the wedding invitation.

- `wedding.js` updates rendered wedding-card text and DOM field mapping.
- `wedding-form.html` documents the wedding form ownership and required IDs.
- `server/occasion-schema.js` still owns backend defaults, required fields, title fields, and duplicate-public fingerprint fields for `wedding`.
- The large current wedding-card HTML/SVG runtime markup still lives in `index.html` until a template build step is introduced.

Stable IDs used by `wedding.js`:

- Form: `invitationForm`
- Names: `brideName`, `groomName`, `monogram`
- Main ceremony: `weddingDay`, `weddingDateBanner`, `weddingWhen`, `weddingEventVenue`
- Venue: `venueName`, `venueAddress`
- Optional events: `haldiEvent`, `haldiWhen`, `haldiVenue`, `engagementEvent`, `engagementWhen`, `engagementVenue`
- RSVP: `rsvpSection`, `rsvpDetails`
