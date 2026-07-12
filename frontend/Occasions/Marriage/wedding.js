const firstName = (name) => name.trim().split(/\s+/)[0] || "";
const initial = (name) => firstName(name).charAt(0).toUpperCase();

function setOptionalEvent(form, prefix, title, helpers) {
  const value = (name) => form.elements[name].value.trim();
  const date = value(`${prefix}Date`);
  const time = value(`${prefix}Time`);
  const venue = value(`${prefix}Venue`);
  const card = document.getElementById(`${prefix}Event`);
  card.hidden = !(date || time || venue);
  if (card.hidden) return;

  const when = document.getElementById(`${prefix}When`);
  when.replaceChildren();
  [helpers.formatDate(date), helpers.formatTime(time)].filter(Boolean).forEach((line, index) => {
    if (index) when.append(document.createElement("br"));
    when.append(document.createTextNode(line));
  });
  document.getElementById(`${prefix}Venue`).textContent =
    venue || `${title} venue to be announced`;
}

export function renderWedding(form, helpers) {
  const value = (name) => form.elements[name].value.trim();
  const bride = value("bride");
  const groom = value("groom");
  const date = value("weddingDate");
  const time = value("weddingTime");
  const venue = value("venue");
  const rsvp = [value("rsvpName").toUpperCase(), value("rsvpPhone")].filter(Boolean);

  document.body.dataset.theme = value("theme");
  document.getElementById("brideName").textContent = firstName(bride);
  document.getElementById("groomName").textContent = firstName(groom);
  document.getElementById("blessingText").textContent = value("message");
  document.getElementById("monogram").textContent = `${initial(bride)}&${initial(groom)}`;
  document.getElementById("weddingDay").textContent = helpers.weekday(date);
  document.getElementById("weddingDateBanner").textContent =
    `${helpers.formatDate(date)} · ${helpers.formatTime(time)}`;

  const weddingWhen = document.getElementById("weddingWhen");
  weddingWhen.replaceChildren(
    document.createTextNode(helpers.formatDate(date)),
    document.createElement("br"),
    document.createTextNode(helpers.formatTime(time))
  );
  document.getElementById("weddingEventVenue").textContent = venue;
  document.getElementById("venueName").textContent = venue;
  document.getElementById("venueAddress").textContent = value("address");
  document.getElementById("rsvpDetails").textContent = rsvp.join(" · ");
  document.getElementById("rsvpSection").hidden = rsvp.length === 0;

  setOptionalEvent(form, "haldi", "Haldi", helpers);
  setOptionalEvent(form, "engagement", "Engagement", helpers);
  document.title = `${firstName(bride)} & ${firstName(groom)} | Wedding Invitation`;
}
