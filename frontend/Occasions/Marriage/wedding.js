const firstName = (name) => name.trim().split(/\s+/)[0] || "";
const initial = (name) => firstName(name).charAt(0).toUpperCase();

const ganeshaSources = {
  "ganesha-icon": "/frontend/General/svgs/ganesha-icon-111519-512.svg"
};

const coupleSources = {
  "couple-ref": "/frontend/General/svgs/wedding-couple-svgrepo-com.svg"
};

let weddingCountdownTimer = null;

function driveImageUrl(link) {
  const text = String(link || "").trim();
  const id = text.match(/\/d\/([^/]+)/)?.[1] || text.match(/[?&]id=([^&]+)/)?.[1];
  return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200` : text;
}

function renderPhotoGallery(values) {
  const gallery = document.getElementById("weddingPhotoGallery");
  const urls = values.templateType === "premium"
    ? String(values.photoLinks || "").split(/\n|,/).map(driveImageUrl).filter(Boolean).slice(0, 10)
    : [];
  gallery.hidden = urls.length === 0;
  gallery.classList.toggle("photo-carousel", urls.length > 1);
  const track = document.createElement("div");
  track.className = "photo-carousel-track";
  track.replaceChildren(...urls.map((url, index) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = `Wedding photo ${index + 1}`;
    img.loading = "lazy";
    const slide = document.createElement("figure");
    slide.className = "photo-slide";
    slide.append(img);
    return slide;
  }));
  gallery.replaceChildren(track);
}

function eventTarget(date, time) {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hours = 0, minutes = 0] = String(time || "00:00").split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function countdownParts(target) {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  return [
    ["Days", Math.floor(totalSeconds / 86400)],
    ["Hours", Math.floor((totalSeconds % 86400) / 3600)],
    ["Mins", Math.floor((totalSeconds % 3600) / 60)],
    ["Secs", totalSeconds % 60]
  ];
}

function renderCountdown(container, values) {
  clearInterval(weddingCountdownTimer);
  const enabled = values.templateType === "premium" && values.addCountdown === "yes";
  const target = enabled ? eventTarget(values.weddingDate, values.weddingTime) : null;
  container.hidden = !target;
  if (!target) {
    container.replaceChildren();
    return;
  }
  const tick = () => {
    const parts = countdownParts(target);
    if (!parts) {
      container.replaceChildren(Object.assign(document.createElement("p"), { textContent: "The celebration has begun." }));
      clearInterval(weddingCountdownTimer);
      return;
    }
    container.replaceChildren(
      Object.assign(document.createElement("p"), { className: "countdown-kicker", textContent: "Counting down to the wedding" }),
      ...parts.map(([label, value]) => {
        const item = document.createElement("span");
        item.className = "countdown-item";
        item.innerHTML = `<strong>${String(value).padStart(2, "0")}</strong><small>${label}</small>`;
        return item;
      })
    );
  };
  tick();
  weddingCountdownTimer = setInterval(tick, 1000);
}

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
  const brideParents = value("brideParents");
  const groomParents = value("groomParents");
  const date = value("weddingDate");
  const time = value("weddingTime");
  const venue = value("venue");
  const rsvp = [value("rsvpName").toUpperCase(), value("rsvpPhone")].filter(Boolean);

  document.getElementById("invitation").dataset.theme = value("theme");
  const ganeshaChoice = value("ganeshaVariant") || "inline";
  const ganeshaWrap = document.querySelector(".ganesha-wrap");
  const inlineGanesha = document.getElementById("ganeshaInlineSvg");
  const refGanesha = document.getElementById("ganeshaReferenceSvg");
  const useReferenceGanesha = ganeshaChoice !== "inline";
  ganeshaWrap.dataset.selected = useReferenceGanesha ? "ref" : "inline";
  inlineGanesha.hidden = useReferenceGanesha;
  refGanesha.hidden = !useReferenceGanesha;
  if (ganeshaSources[ganeshaChoice]) refGanesha.src = ganeshaSources[ganeshaChoice];

  const coupleChoice = value("coupleVariant") || "inline";
  const coupleFrame = document.querySelector(".couple-frame");
  const inlineCouple = document.getElementById("coupleInlineSvg");
  const refCouple = document.getElementById("coupleReferenceSvg");
  const useReferenceCouple = coupleChoice !== "inline";
  coupleFrame.dataset.selected = useReferenceCouple ? "ref" : "inline";
  inlineCouple.hidden = useReferenceCouple;
  refCouple.hidden = !useReferenceCouple;
  if (coupleSources[coupleChoice]) refCouple.src = coupleSources[coupleChoice];
  document.getElementById("brideName").textContent = firstName(bride);
  document.getElementById("groomName").textContent = firstName(groom);
  document.getElementById("brideFullName").textContent = bride;
  document.getElementById("groomFullName").textContent = groom;
  document.getElementById("brideParentsText").textContent = brideParents || "the bride's family";
  document.getElementById("groomParentsText").textContent = groomParents || "the groom's family";
  const parentDetails = document.getElementById("parentDetails");
  const brideParentCard = document.getElementById("brideParentCard");
  const groomParentCard = document.getElementById("groomParentCard");
  parentDetails.replaceChildren(...(
    value("coupleOrder") === "groom-first"
      ? [groomParentCard, brideParentCard]
      : [brideParentCard, groomParentCard]
  ));
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
  renderPhotoGallery({ templateType: value("templateType"), photoLinks: value("photoLinks") });
  renderCountdown(document.getElementById("weddingCountdown"), {
    templateType: value("templateType"),
    addCountdown: value("addCountdown"),
    weddingDate: date,
    weddingTime: time
  });

  setOptionalEvent(form, "haldi", "Haldi", helpers);
  setOptionalEvent(form, "engagement", "Engagement", helpers);
  document.title = `${firstName(bride)} & ${firstName(groom)} | Wedding Invitation`;
}
