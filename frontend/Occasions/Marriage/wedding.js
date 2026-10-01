import { applyPhotoImageFallbacks, parsePhotoLinks } from "../../General/js/photo-links.js";
import { svgAssetMap } from "../../General/js/svg-registry.js";
import { applyInvitationSvgTheme } from "../../General/js/svg-theme.js";
import { renderVenueMap } from "../../General/js/map-preview.js";

const firstName = (name) => name.trim().split(/\s+/)[0] || "";
const initial = (name) => firstName(name).charAt(0).toUpperCase();

const ganeshaSources = {
  ganesh: svgAssetMap.ganesha1,
  "ganesha-linework": svgAssetMap.ganesha2,
  "ganesha-3": svgAssetMap.ganesha3
};

const coupleSources = {
  "couple-ref": svgAssetMap.couple3,
  "couple-royal": svgAssetMap.couple1,
  "couple-emerald": svgAssetMap.couple2,
};

let weddingCountdownTimer = null;

function renderPhotoGallery(values) {
  const gallery = document.getElementById("weddingPhotoGallery");
  const urls = values.templateType === "premium"
    ? parsePhotoLinks(values.photoLinks)
    : [];
  gallery.hidden = urls.length === 0;
  gallery.classList.toggle("photo-carousel", urls.length > 1);
  const track = document.createElement("div");
  track.className = "photo-carousel-track";
  track.replaceChildren(...urls.map((url, index) => {
    const img = document.createElement("img");
    applyPhotoImageFallbacks(img, url);
    img.alt = `Wedding photo ${index + 1}`;
    img.loading = "lazy";
    const slide = document.createElement("figure");
    slide.className = "photo-slide";
    slide.append(img);
    return slide;
  }));
  gallery.replaceChildren(track);
  setupWeddingPhotoCarousel(track);
}

function setupWeddingPhotoCarousel(track) {
  const slides = [...track.querySelectorAll(".photo-slide")];

  if (!slides.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle(
          "is-active",
          entry.isIntersecting
        );
      });
    },
    {
      root: track,
      threshold: 0.65
    }
  );

  slides.forEach((slide) => observer.observe(slide));

  slides[0].classList.add("is-active");
}

function eventTarget(date, time) {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hours = 0, minutes = 0] = String(time || "00:00").split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function countdownParts(target) {
  const ms = target.getTime() - Date.now();
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
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
    container.replaceChildren(
      Object.assign(document.createElement("p"), { className: "countdown-kicker", textContent: "Counting down to the wedding" }),
      ...parts.map(([label, value]) => {
        const item = document.createElement("span");
        item.className = "countdown-item";
        item.innerHTML = `<strong>${String(value).padStart(2, "0")}</strong><small>${label}</small>`;
        return item;
      })
    );
    if (target.getTime() <= Date.now()) clearInterval(weddingCountdownTimer);
  };
  tick();
  weddingCountdownTimer = setInterval(tick, 1000);
}

function setOptionalEvent(form, prefix, title, helpers) {
  const value = (name) => form.elements[name].value.trim();
  const date = value(`${prefix}Date`);
  const time = value(`${prefix}Time`);
  const venue = value(`${prefix}Venue`);
  const mapUrl = value(`${prefix}VenueLink`);
  const card = document.getElementById(`${prefix}Event`);
  card.hidden = !(date || time || venue || mapUrl);
  if (card.hidden) return;

  const when = document.getElementById(`${prefix}When`);
  when.replaceChildren();
  [helpers.formatDate(date), helpers.formatTime(time)].filter(Boolean).forEach((line, index) => {
    if (index) when.append(document.createElement("br"));
    when.append(document.createTextNode(line));
  });
  document.getElementById(`${prefix}Venue`).textContent =
    venue || `${title} venue to be announced`;
  renderVenueMap(document.getElementById(`${prefix}Map`), document.getElementById(`${prefix}MapFrame`), mapUrl, venue || title);
}

export function renderWedding(form, helpers) {
  const value = (name) => {
    const element = form.elements[name];
    if (!element) return "";
    if (element.type === "checkbox") return element.checked ? element.value : "";
    return element.value.trim();
  };
  const bride = value("bride");
  const groom = value("groom");
  const brideParents = value("brideParents");
  const groomParents = value("groomParents");
  const date = value("weddingDate");
  const time = value("weddingTime");
  const venue = value("venue");
  const rsvp = [value("rsvpName").toUpperCase(), value("rsvpPhone")].filter(Boolean);

  document.getElementById("invitation").dataset.theme = value("theme");
  const ganeshaWrap = document.querySelector(".ganesha-wrap");
  const inlineGanesha = document.getElementById("ganeshaInlineSvg");
  const refGanesha = document.getElementById("ganeshaReferenceSvg");
  const ganeshaChoice = value("ganeshaVariant") || "inline";
  const useReferenceGanesha = Boolean(ganeshaSources[ganeshaChoice]);
  ganeshaWrap.dataset.selected = useReferenceGanesha ? "ref" : "inline";
  inlineGanesha.hidden = useReferenceGanesha;
  refGanesha.hidden = !useReferenceGanesha;
  if (useReferenceGanesha) refGanesha.src = ganeshaSources[ganeshaChoice];

  const requestedCouple = value("coupleVariant") || "inline";
  const coupleChoice = requestedCouple === "couple-ref" || requestedCouple === "couple-royal" || requestedCouple === "couple-emerald"
    ? requestedCouple
    : "inline";
  form.elements.coupleVariant.value = coupleChoice;
  const coupleFrame = document.querySelector(".couple-frame");
  const inlineCouple = document.getElementById("coupleInlineSvg");
  const refCouple = document.getElementById("coupleReferenceSvg");
  const useReferenceCouple = coupleChoice !== "inline";
  coupleFrame.dataset.selected = useReferenceCouple ? "ref" : "inline";
  inlineCouple.hidden = useReferenceCouple;
  refCouple.hidden = !useReferenceCouple;
  if (coupleSources[coupleChoice]) refCouple.src = coupleSources[coupleChoice];
  const brideDetails = {
    name: bride,
    parentLine: `(D/o. ${brideParents || "the bride's family"})`
  };
  const groomDetails = {
    name: groom,
    parentLine: `(S/o. ${groomParents || "the groom's family"})`
  };
  const orderedCouple = value("coupleOrder") === "groom-first"
    ? [groomDetails, brideDetails]
    : [brideDetails, groomDetails];
  document.getElementById("firstCoupleName").textContent = orderedCouple[0].name;
  document.getElementById("firstParentLine").textContent = orderedCouple[0].parentLine;
  document.getElementById("secondCoupleName").textContent = orderedCouple[1].name;
  document.getElementById("secondParentLine").textContent = orderedCouple[1].parentLine;
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
  document.getElementById("venueName").textContent = venue;
  document.getElementById("venueAddress").textContent = value("address");
  renderVenueMap(document.getElementById("weddingMap"), document.getElementById("weddingMapFrame"), value("venueLink"), venue);
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
  applyInvitationSvgTheme(document.getElementById("invitation"));
  document.title = `${firstName(bride)} & ${firstName(groom)} | Wedding Invitation`;
}
