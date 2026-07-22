import { getOccasion } from "./occasions/registry.js";
import { renderWedding } from "./occasions/wedding.js";
import { renderOccasionForm } from "./ui/form-renderer.js";

/**
 * Main browser controller for routing, authentication state, card persistence,
 * public sharing, and workspace theme behavior.
 */
const elements = {
  authShell: document.getElementById("authShell"),
  appHeader: document.getElementById("appHeader"),
  dashboard: document.getElementById("dashboard"),
  adminDashboard: document.getElementById("adminDashboard"),
  plansPage: document.getElementById("plansPage"),
  paymentPage: document.getElementById("paymentPage"),
  weddingBuilder: document.getElementById("builder"),
  occasionBuilder: document.getElementById("occasionBuilder"),
  templateChoice: document.getElementById("templateChoice"),
  weddingInvitation: document.getElementById("invitation"),
  occasionInvitation: document.getElementById("occasionInvitation"),
  weddingForm: document.getElementById("invitationForm"),
  occasionForm: document.getElementById("occasionForm"),
  occasionFields: document.getElementById("occasionFields"),
  cardActions: document.getElementById("cardActions"),
  savedCards: document.getElementById("savedCards"),
  savedEmpty: document.getElementById("savedEmpty"),
  savedLoading: document.getElementById("savedLoading"),
  saveButton: document.getElementById("saveCardButton"),
  shareButton: document.getElementById("shareCardButton"),
  copyShareLinkButton: document.getElementById("copyShareLinkButton"),
  statusBadge: document.getElementById("invitationStatusBadge"),
  saveStatus: document.getElementById("saveStatus"),
  publicBanner: document.getElementById("publicBanner"),
  profileVerifyNotice: document.getElementById("profileVerifyNotice"),
  shareInfo: document.getElementById("shareInfo"),
  adminButton: document.getElementById("adminButton"),
  aboutPage: document.getElementById("aboutPage"),
  contactPage: document.getElementById("contactPage"),
  privacyPage: document.getElementById("privacyPage"),
  termsPage: document.getElementById("termsPage"),
  refundPage: document.getElementById("refundPage"),
  disclaimerPage: document.getElementById("disclaimerPage"),
  acceptableUsePage: document.getElementById("acceptableUsePage")
};

let activeOccasion = "wedding";
let currentInvitationId = null;
let currentShareUrl = null;
let currentPublicExpiresAt = null;
let signedInUser = null;
let pendingDelete = null;
let shareTimer = null;
let activeOccasionConfig = null;
let pendingHomeAction = null;
let pendingTemplateFields = null;
let currentTemplateType = "basic";
let currentInvitationStatus = "DRAFT";

const supportedOccasions = ["wedding", "birthday", "engagement", "office", "custom"];
const publicStaticRoutes = ["about", "contact", "privacy", "terms", "refund", "disclaimer", "acceptable-use"];
const occasionSchemaCache = new Map();

function isGuestUser() {
  return signedInUser?.guest === true;
}

const visualMotifs = {
  cakeRef: `<img class="motif-img" src="/frontend/General/svgs/cake-svgrepo-com.svg" alt="">`,
  cake: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M14 54H58V64H14Z"/><path d="M20 37H52V54H20Z"/><path d="M27 23H45V37H27Z"/><path d="M36 6Q28 16 36 23Q44 16 36 6Z" fill="var(--occasion-accent)"/><path d="M20 45Q28 39 36 45T52 45"/></g></svg>`,
  ringsRef: `<img class="motif-img" src="/frontend/General/svgs/wedding-rings-wedding-svgrepo-com.svg" alt="">`,
  rings: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="3"><circle cx="28" cy="43" r="18"/><circle cx="44" cy="43" r="18"/><path d="M37 18L45 8L53 18L45 28Z" fill="var(--occasion-accent)"/></g></svg>`,
  officeTower: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 63H61M18 63V21H54V63M27 29H33M40 29H46M27 39H33M40 39H46M27 49H33M40 49H46"/><path d="M29 21V11H43V21" stroke="var(--occasion-accent)"/></g></svg>`,
  envelope: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><rect x="13" y="22" width="46" height="32" rx="6"/><path d="M16 27L36 42L56 27M17 50L31 39M55 50L41 39"/><circle cx="36" cy="42" r="4" fill="var(--occasion-accent)"/><path d="M55 13V19M52 16H58M18 12L21 17L26 19L21 21L18 26L15 21L10 19L15 17Z"/></g></svg>`,
  lotus: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M36 51C23 51 15 44 11 35C22 34 31 39 36 51Z"/><path d="M36 51C49 51 57 44 61 35C50 34 41 39 36 51Z"/><path d="M36 50C27 39 28 25 36 14C44 25 45 39 36 50Z" fill="var(--occasion-accent)"/><path d="M17 58H55"/></g></svg>`,
  diya: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M14 43Q36 61 58 43Q47 55 25 55Q17 51 14 43Z"/><path d="M36 13Q25 27 36 36Q47 27 36 13Z" fill="var(--occasion-accent)"/><path d="M24 43H48M20 59H52"/></g></svg>`,
  coupleRef: `<img class="motif-img" src="/frontend/General/svgs/wedding-couple-svgrepo-com.svg" alt="">`,
  couple: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="27" cy="22" r="7"/><circle cx="45" cy="22" r="7"/><path d="M20 58Q22 36 27 30Q32 36 34 58ZM38 58Q40 36 45 30Q50 36 52 58Z"/><path d="M22 16L27 10L32 16M40 15L45 9L50 15" fill="var(--occasion-accent)"/></g></svg>`
};

const weddingPreviewMotifs = {
  inlineGanesha: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 23Q36 12 48 23Q53 34 43 43"/><path d="M25 25Q14 21 11 34Q10 46 25 45M47 25Q58 21 61 34Q62 46 47 45"/><path d="M32 35Q31 49 41 49Q49 49 46 41"/><path d="M25 57Q36 49 47 57"/><path d="M28 18L32 9L36 16L40 9L44 18" fill="var(--gold-light)"/></g></svg>`,
  ganeshaRef: `<img class="motif-img" src="/frontend/General/svgs/ganesha-icon-111519-512.svg" alt="">`
};

function initPreviewSelect(selectId, previews) {
  const select = document.getElementById(selectId);
  if (!select || select.dataset.previewReady) return;
  select.dataset.previewReady = "true";
  select.classList.add("visual-select-source");
  const grid = document.createElement("div");
  grid.className = "svg-preview-grid";
  [...select.options].forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "svg-preview-option";
    button.dataset.value = option.value;
    button.innerHTML = `<span class="svg-preview-art">${previews[option.value] || visualMotifs[option.value] || ""}</span><span>${option.textContent}</span>`;
    button.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    grid.append(button);
  });
  const sync = () => grid.querySelectorAll(".svg-preview-option")
    .forEach((button) => button.classList.toggle("is-selected", button.dataset.value === select.value));
  select.addEventListener("change", sync);
  select.after(grid);
  sync();
}

function initWeddingSvgPreviews() {
  initPreviewSelect("weddingIconInput", {});
  initPreviewSelect("ganeshaVariantInput", {
    inline: weddingPreviewMotifs.inlineGanesha,
    "ganesha-icon": weddingPreviewMotifs.ganeshaRef
  });
  initPreviewSelect("coupleVariantInput", {
    inline: visualMotifs.couple,
    "couple-ref": visualMotifs.coupleRef
  });
}

function initGenericMotifPreview() {
  initPreviewSelect("occasion-cardIcon", {});
}

const hideableSections = [
  elements.authShell,
  elements.dashboard,
  elements.adminDashboard,
  elements.plansPage,
  elements.paymentPage,

  elements.aboutPage,
  elements.contactPage,
  elements.privacyPage,
  elements.termsPage,
  elements.refundPage,
  elements.disclaimerPage,
  elements.acceptableUsePage,

  elements.weddingBuilder,
  elements.occasionBuilder,
  elements.templateChoice,
  elements.weddingInvitation,
  elements.occasionInvitation
].filter(Boolean);

function localDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const helpers = {
  firstName(name) {
    return name.trim().split(/\s+/)[0] || "";
  },
  formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" })
      .format(localDate(value));
  },
  weekday(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(localDate(value));
  },
  fullDate(value) {
    if (!value) return "";
    return `${this.weekday(value)}, ${this.formatDate(value)}`;
  },
  formatTime(value) {
    if (!value) return "";
    const [hours, minutes] = value.split(":").map(Number);
    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric", minute: "2-digit", hour12: true
    }).format(new Date(2000, 0, 1, hours, minutes));
  }
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || "Request failed.");
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadOccasionSchema(occasionId) {
  if (!occasionSchemaCache.has(occasionId)) {
    occasionSchemaCache.set(occasionId, api(`/api/occasions/${occasionId}`));
  }
  return occasionSchemaCache.get(occasionId);
}

function withServerDefaults(occasion, schema) {
  const defaults = schema.defaults || {};
  const sections = occasion.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({
      ...field,
      value: Object.prototype.hasOwnProperty.call(defaults, field.name) ? defaults[field.name] : field.value
    }))
  }));
  return {
    ...occasion,
    defaultTheme: defaults.palette || occasion.defaultTheme,
    sections
  };
}

async function getHydratedOccasion(occasionId) {
  const [occasion, schema] = await Promise.all([
    Promise.resolve(getOccasion(occasionId)),
    loadOccasionSchema(occasionId)
  ]);
  return withServerDefaults(occasion, schema);
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showOnly(section) {
  document.body.classList.remove("public-share");
  hideableSections.forEach((element) => element.hidden = element !== section);
  elements.cardActions.hidden = ![elements.weddingInvitation, elements.occasionInvitation].includes(section);
  elements.publicBanner.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetCurrentCard() {
  currentInvitationId = null;
  currentShareUrl = null;
  currentPublicExpiresAt = null;
  elements.saveButton.textContent = "Save Card";
  elements.shareButton.disabled = false;
  elements.copyShareLinkButton.hidden = true;
  elements.saveStatus.textContent = "";
  elements.shareInfo.textContent = "";
  updateStatusBadge("DRAFT");
  clearInterval(shareTimer);
  pendingTemplateFields = null;
  currentTemplateType = "basic";
}

function effectiveStatus(status, expiresAt) {
  if (status === "PAID") return "PAID";
  if (status === "PUBLISHED" && expiresAt && new Date(expiresAt).getTime() <= Date.now()) return "EXPIRED";
  return status || "DRAFT";
}

function updateStatusBadge(status = currentInvitationStatus) {
  currentInvitationStatus = effectiveStatus(status, currentPublicExpiresAt);
  if (!elements.statusBadge) return;
  const label = currentInvitationStatus.charAt(0) + currentInvitationStatus.slice(1).toLowerCase();
  elements.statusBadge.textContent = label;
  elements.statusBadge.className = `status-badge status-${currentInvitationStatus.toLowerCase()}`;
}

function hasActiveCardWork() {
  return [elements.weddingBuilder, elements.occasionBuilder, elements.templateChoice, elements.weddingInvitation, elements.occasionInvitation]
    .some((section) => section && !section.hidden);
}

function goHome() {
  resetCurrentCard();
  history.pushState({}, "", "/");
  showOnly(elements.dashboard);
  loadSavedCards();
}

function confirmBeforeHome(action = goHome) {
  if (!hasActiveCardWork()) {
    action();
    return;
  }
  pendingHomeAction = action;
  document.getElementById("unsavedModal").classList.remove("hidden");
}

function applyWorkspaceMode(mode) {
  document.body.dataset.mode = mode;
}

function applyAppTheme(theme) {
  document.body.dataset.theme = theme || "maroon";
}

function applyFontTheme(font) {
  document.body.dataset.font = font || "default";
}

function preferenceKey() {
  return signedInUser?.email ? `invitation_studio_preferences_${signedInUser.email.toLowerCase()}` : null;
}

function currentPreferences() {
  return {
    theme: document.body.dataset.theme || "maroon",
    mode: document.body.dataset.mode || "light",
    font: document.body.dataset.font || "default"
  };
}

function saveUserPreferences() {
  const key = preferenceKey();
  if (key) localStorage.setItem(key, JSON.stringify(currentPreferences()));
}

function applyUserPreferences() {
  const key = preferenceKey();
  const prefs = key ? JSON.parse(localStorage.getItem(key) || "{}") : {};
  applyAppTheme(prefs.theme || "maroon");
  applyWorkspaceMode(prefs.mode || "light");
  applyFontTheme(prefs.font || "default");
}

function updateProfileVerifyNotice() {
  if (elements.profileVerifyNotice) {
    elements.profileVerifyNotice.hidden = !signedInUser || signedInUser.emailVerified;
  }
}

function resetPaymentPage() {
  document.querySelector("#paymentPage h1").textContent = "Page Under Development";
  document.querySelector("#paymentPage .builder-intro").textContent =
    "Razorpay integration will be added here in a future release.";
}

function driveImageUrl(link) {
  const text = String(link || "").trim();
  const id = text.match(/\/d\/([^/]+)/)?.[1] || text.match(/[?&]id=([^&]+)/)?.[1];
  return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200` : text;
}

function photoUrls(values) {
  if (values.templateType !== "premium") return [];
  return String(values.photoLinks || "").split(/\n|,/).map(driveImageUrl).filter(Boolean).slice(0, 10);
}

function renderPhotoGallery(container, urls) {
  container.hidden = urls.length === 0;
  container.replaceChildren(...urls.map((url) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Invitation photo";
    img.loading = "lazy";
    return img;
  }));
}

function renderGenericCard(occasion, values = formValues(elements.occasionForm)) {
  const cardData = occasion.build(values, helpers);
  elements.occasionInvitation.dataset.occasion = occasion.id;
  elements.occasionInvitation.dataset.palette = values.palette || occasion.defaultTheme;
  document.getElementById("occasionMark").innerHTML =
    visualMotifs[values.cardIcon || occasion.defaultIcon || "envelope"] || visualMotifs.envelope;
  document.getElementById("occasionCardKicker").textContent = occasion.kicker;
  document.getElementById("occasionCardTitle").textContent = cardData.title;
  document.getElementById("occasionCardSubtitle").textContent = cardData.subtitle;
  document.getElementById("occasionCardMessage").textContent = cardData.message;
  renderPhotoGallery(document.getElementById("occasionPhotoGallery"), photoUrls(values));
  document.getElementById("occasionCardRsvp").textContent =
    cardData.rsvp ? `RSVP · ${cardData.rsvp}` : "";

  const details = document.getElementById("occasionDetails");
  details.replaceChildren();
  cardData.details.forEach(([label, value]) => {
    if (!value) return;
    const item = document.createElement("div");
    item.className = "occasion-detail";
    const caption = document.createElement("span");
    const content = document.createElement("strong");
    caption.textContent = label;
    content.textContent = value;
    item.append(caption, content);
    details.append(item);
  });
  document.title = cardData.documentTitle;
}

function selectedBuilder() {
  return activeOccasion === "wedding" ? elements.weddingBuilder : elements.occasionBuilder;
}

function selectedInvitation() {
  return activeOccasion === "wedding" ? elements.weddingInvitation : elements.occasionInvitation;
}

function setFormTemplateType(templateType) {
  const form = activeOccasion === "wedding" ? elements.weddingForm : elements.occasionForm;
  currentTemplateType = templateType || "basic";
  if (form.elements.templateType) form.elements.templateType.value = currentTemplateType;
}

function showTemplateChoice(fields) {
  pendingTemplateFields = fields;
  showOnly(elements.templateChoice);
}

function openSelectedTemplate(templateType) {
  if (!pendingTemplateFields) return;
  pendingTemplateFields = { ...pendingTemplateFields, templateType };
  setFormTemplateType(templateType);
  updateStatusBadge(currentInvitationId ? currentInvitationStatus : "DRAFT");
  if (activeOccasion === "wedding") {
    renderWedding(elements.weddingForm, helpers);
    renderWeddingMotif();
  } else {
    renderGenericCard(activeOccasionConfig || getOccasion(activeOccasion), pendingTemplateFields);
  }
  elements.saveStatus.textContent = `${templateType === "premium" ? "Premium" : "Basic"} card selected. Save it to your account.`;
  showOnly(selectedInvitation());
}

function renderWeddingMotif() {
  const key = elements.weddingForm.elements.cardIcon?.value || "rings";
  document.getElementById("weddingMotif").innerHTML = visualMotifs[key] || visualMotifs.rings;
}

function fillForm(form, values) {
  Object.entries(values || {}).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value;
  });
}

async function openOccasion(occasionId, updateUrl = true) {
  activeOccasion = occasionId;
  activeOccasionConfig = null;
  resetCurrentCard();
  if (updateUrl) history.pushState({}, "", `/${occasionId}`);

  if (occasionId === "wedding") {
    elements.weddingInvitation.dataset.theme = elements.weddingForm.elements.theme.value;
    showOnly(elements.weddingBuilder);
    return;
  }

  const occasion = await getHydratedOccasion(occasionId);
  activeOccasionConfig = occasion;
  document.getElementById("occasionFormTitle").textContent = occasion.formTitle;
  document.getElementById("occasionFormIntro").textContent = occasion.intro;
  document.getElementById("occasionFormKicker").textContent =
    `Create your ${occasion.name.toLowerCase()} card`;
  renderOccasionForm(occasion, elements.occasionFields);
  initGenericMotifPreview();
  showOnly(elements.occasionBuilder);
}

async function renderInvitationFromData(invitation, readOnly = false) {
  activeOccasion = invitation.occasion;
  currentInvitationId = readOnly ? null : invitation.id;
  currentShareUrl = invitation.shareUrl;
  currentPublicExpiresAt = invitation.publicExpiresAt;
  updateStatusBadge(invitation.status);
  currentTemplateType = invitation.fields?.templateType || (String(invitation.fields?.photoLinks || "").trim() ? "premium" : "basic");
  pendingTemplateFields = invitation.fields || null;
  elements.saveButton.textContent = currentInvitationId ? "Update Card" : "Save Card";

  if (invitation.occasion === "wedding") {
    fillForm(elements.weddingForm, invitation.fields);
    renderWedding(elements.weddingForm, helpers);
    renderWeddingMotif();
    showOnly(elements.weddingInvitation);
  } else {
    const occasion = await getHydratedOccasion(invitation.occasion);
    activeOccasionConfig = occasion;
    renderOccasionForm(occasion, elements.occasionFields);
    fillForm(elements.occasionForm, invitation.fields);
    initGenericMotifPreview();
    renderGenericCard(occasion, invitation.fields);
    showOnly(elements.occasionInvitation);
  }

  if (readOnly) {
    elements.cardActions.hidden = true;
    elements.publicBanner.hidden = false;
    elements.publicBanner.textContent = `Shared invitation from ${invitation.owner || "Invitation Studio"}`;
  } else {
    elements.saveStatus.textContent = "Saved in your account.";
    updateShareDisplay();
  }
}

function currentFields() {
  const fields = formValues(activeOccasion === "wedding" ? elements.weddingForm : elements.occasionForm);
  fields.templateType = pendingTemplateFields?.templateType ||
    currentTemplateType ||
    (String(fields.photoLinks || "").trim() ? "premium" : fields.templateType || "basic");
  return fields;
}

async function saveCurrentCard() {
  const url = currentInvitationId
    ? `/api/invitations/${activeOccasion}/${currentInvitationId}`
    : `/api/invitations/${activeOccasion}`;
  const invitation = await api(url, {
    method: currentInvitationId ? "PUT" : "POST",
    body: JSON.stringify(currentFields())
  });
  currentInvitationId = invitation.id;
  currentShareUrl = invitation.shareUrl;
  currentPublicExpiresAt = invitation.publicExpiresAt;
  currentTemplateType = invitation.fields?.templateType || currentFields().templateType || "basic";
  pendingTemplateFields = invitation.fields || { ...currentFields(), templateType: currentTemplateType };
  elements.saveButton.textContent = "Update Card";
  history.replaceState({}, "", invitation.url);
  return invitation;
}

function updateShareDisplay() {
  clearInterval(shareTimer);
  if (!currentShareUrl || !currentPublicExpiresAt) {
    elements.shareInfo.textContent = "";
    elements.shareButton.textContent = "Generate Public Link";
    elements.copyShareLinkButton.hidden = true;
    updateStatusBadge(currentInvitationStatus);
    return;
  }
  const link = `${location.origin}${currentShareUrl}`;
  elements.shareButton.textContent = "Public Link Created";
  elements.shareButton.disabled = true;
  elements.copyShareLinkButton.hidden = false;
  elements.copyShareLinkButton.dataset.link = link;
  const tick = () => {
    const remainingMs = new Date(currentPublicExpiresAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      elements.shareInfo.textContent = `Public link expired: ${link}`;
      updateStatusBadge("EXPIRED");
      clearInterval(shareTimer);
      return;
    }
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    elements.shareInfo.textContent =
      `Public link: ${link} · expires in ${minutes}:${String(seconds).padStart(2, "0")}`;
  };
  tick();
  shareTimer = setInterval(tick, 1000);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

async function loadSavedCards() {
  if (!signedInUser) return;
  elements.savedCards.replaceChildren();
  if (isGuestUser()) {
    elements.savedLoading.hidden = true;
    elements.savedEmpty.hidden = false;
    elements.savedEmpty.textContent = "Guest cards are not saved and will reset after refresh.";
    return;
  }
  elements.savedEmpty.hidden = true;
  elements.savedLoading.hidden = false;
  try {
    const { invitations } = await api("/api/invitations");
    elements.savedLoading.hidden = true;
    elements.savedEmpty.hidden = invitations.length > 0;
    invitations.forEach((invitation) => {
      const card = document.createElement("article");
      card.className = "saved-card";
      const type = document.createElement("span");
      type.className = "saved-card-type";
      type.textContent = invitation.occasion;
      const status = document.createElement("span");
      status.className = `status-badge status-${String(invitation.status || "DRAFT").toLowerCase()}`;
      status.textContent = String(invitation.status || "DRAFT").charAt(0) +
        String(invitation.status || "DRAFT").slice(1).toLowerCase();
      const title = document.createElement("h3");
      title.textContent = invitation.title;
      const time = document.createElement("time");
      time.textContent = `Updated ${new Intl.DateTimeFormat("en-IN", {
        day: "numeric", month: "short", year: "numeric"
      }).format(new Date(invitation.updatedAt))}`;
      const actions = document.createElement("div");
      actions.className = "saved-actions";

      const open = document.createElement("button");
      open.className = "open-card";
      open.type = "button";
      open.textContent = "Open";
      open.addEventListener("click", () => {
        history.pushState({}, "", invitation.url);
        loadRoute();
      });

      const remove = document.createElement("button");
      remove.className = "delete-card";
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => openDeleteModal(invitation));

      actions.append(open, remove);
      const meta = document.createElement("div");
      meta.className = "saved-card-meta";
      meta.append(type, status);
      card.append(meta, title, time, actions);
      elements.savedCards.append(card);
    });
  } catch (error) {
    elements.savedLoading.hidden = true;
    elements.savedEmpty.hidden = false;
    elements.savedEmpty.textContent = error.message;
  }
}

function openDeleteModal(invitation) {
  pendingDelete = invitation;
  document.getElementById("deleteCardTitle").textContent = invitation.title;
  document.getElementById("deleteModal").classList.remove("hidden");
}

function openSignoutModal() {
  document.getElementById("signoutModal").classList.remove("hidden");
}

function closeSignoutModal() {
  document.getElementById("signoutModal").classList.add("hidden");
}

function openPublicLinkModal() {
  const duration = currentFields().templateType === "premium" ? 5 : 10;
  const text = document.getElementById("publicLinkDurationText");
  if (text) text.textContent = `Link creation will be allowed once for ${duration} minutes.`;
  const confirm = document.getElementById("confirmPublicLinkBtn");
  if (confirm) confirm.textContent = `Create ${duration} min link`;
  document.getElementById("publicLinkModal").classList.remove("hidden");
}

function closePublicLinkModal() {
  document.getElementById("publicLinkModal").classList.add("hidden");
}

async function loadRoute() {
  const parts = location.pathname.split("/").filter(Boolean);
  const route = parts[0];
  document.body.classList.toggle("preauth-static", publicStaticRoutes.includes(route) && !signedInUser);
  if (publicStaticRoutes.includes(route) && !signedInUser) elements.appHeader.hidden = true;

  if (route === "verify-email") {
    elements.appHeader.hidden = true;
    showOnly(elements.authShell);
    setAuthMode("login");
    const message = document.querySelector("#loginForm [data-auth-message]");
    try {
      const token = new URLSearchParams(location.search).get("token");
      const { user, message: apiMessage } = await api("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token })
      });
      if (signedInUser && user) signedInUser = { ...signedInUser, emailVerified: user.emailVerified };
      message.textContent = apiMessage || "Email verified successfully. Please sign in.";
    } catch (error) {
      message.textContent = error.message;
    }
    history.replaceState({}, "", "/login");
    return;
  }

  if (route === "reset-password") {
    elements.appHeader.hidden = true;
    showOnly(elements.authShell);
    setAuthMode("reset");
    document.getElementById("resetToken").value = new URLSearchParams(location.search).get("token") || "";
    return;
  }

  if (route === "share" && parts[1]) {
    try {
      const invitation = await api(`/api/public/${parts[1]}`);
      await renderInvitationFromData(invitation, true);
      document.body.classList.add("public-share");
    } catch (error) {
      elements.appHeader.hidden = true;
      showOnly(elements.paymentPage);
      elements.publicBanner.hidden = false;
      elements.publicBanner.textContent = "This public invitation link is expired or no longer available.";
      document.querySelector("#paymentPage h1").textContent = "Link Expired";
      document.querySelector("#paymentPage .builder-intro").textContent =
        "Please ask the card owner for a fresh invitation link.";
    }
    return;
  }

  if (route === "payment") {
    history.replaceState({}, "", "/payments");
    resetPaymentPage();
    showOnly(elements.paymentPage);
    return;
  }

  if (route === "payments") {
    resetPaymentPage();
    showOnly(elements.paymentPage);
    return;
  }

  if (route === "plans") {
    showOnly(elements.plansPage);
    return;
  }

  if (route === "about") {
    showOnly(elements.aboutPage);
    return;
  }

  if (route === "contact") {
      showOnly(elements.contactPage);
      return;
  }

  if (route === "privacy") {
      showOnly(elements.privacyPage);
      return;
  }

  if (route === "terms") {
      showOnly(elements.termsPage);
      return;
  }

  if (route === "refund") {
      showOnly(elements.refundPage);
      return;
  }

  if (route === "disclaimer") {
      showOnly(elements.disclaimerPage);
      return;
  }

  if (route === "acceptable-use") {
      showOnly(elements.acceptableUsePage);
      return;
  }

  if (route === "admin") {
    if (signedInUser?.role !== "ADMIN") {
      history.replaceState({}, "", "/");
      showOnly(elements.dashboard);
      return;
    }
    await loadAdminDashboard();
    showOnly(elements.adminDashboard);
    return;
  }

  if (!route) {
    showOnly(elements.dashboard);
    await loadSavedCards();
    return;
  }

  if (!supportedOccasions.includes(route)) {
    history.replaceState({}, "", "/");
    showOnly(elements.dashboard);
    await loadSavedCards();
    return;
  }

  await openOccasion(route, false);
  const invitationId = new URLSearchParams(location.search).get("id");
  if (!invitationId) return;
  const invitation = await api(`/api/invitations/${route}/${invitationId}`);
  await renderInvitationFromData(invitation, false);
}

async function loadAdminDashboard() {
  const [statsData, usersData, invitationsData] = await Promise.all([
    api("/api/admin/stats"),
    api("/api/admin/users"),
    api("/api/admin/invitations")
  ]);
  document.getElementById("adminStats").innerHTML = Object.entries(statsData.stats)
    .map(([label, value]) => `<div class="admin-stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
  document.getElementById("adminUsers").innerHTML = usersData.users
    .map((user) => `<li>${user.name} · ${user.email}${user.phone ? ` · ${user.phone}` : ""} · ${user.role} · ${user.invitationCount} cards</li>`)
    .join("");
  document.getElementById("adminInvitations").innerHTML = invitationsData.invitations
    .map((card) => `<li>${card.title} · ${card.occasion} · ${card.owner.name} (${card.owner.email})</li>`)
    .join("");
}

function cleanLogoutUi() {
  resetCurrentCard();
  signedInUser = null;
  applyAppTheme("maroon");
  applyWorkspaceMode("light");
  applyFontTheme("default");
  elements.appHeader.hidden = true;
  elements.cardActions.hidden = true;
  elements.publicBanner.hidden = true;
  updateProfileVerifyNotice();
  elements.copyShareLinkButton.hidden = true;
  elements.savedCards.replaceChildren();
  elements.savedEmpty.textContent = "You have not saved an invitation yet.";
  elements.savedEmpty.hidden = false;
  elements.savedLoading.hidden = true;
  hideableSections.forEach((element) => element.hidden = true);
  elements.authShell.hidden = false;
  document.getElementById("userName").textContent = "";
  history.replaceState({}, "", "/login");
}

function setAuthMode(mode) {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  document.getElementById("loginForm").hidden = mode !== "login";
  document.getElementById("registerForm").hidden = mode !== "register";
  document.getElementById("forgotPasswordForm").hidden = mode !== "forgot";
  document.getElementById("resetPasswordForm").hidden = mode !== "reset";
  document.querySelectorAll("[data-auth-message]").forEach((message) => message.textContent = "");
}

async function submitAuth(form, endpoint) {
  const message = form.querySelector("[data-auth-message]");
  message.textContent = "";
  try {
    const { user } = await api(endpoint, { method: "POST", body: JSON.stringify(formValues(form)) });
    signedInUser = user;
    await enterApplication();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function enterApplication() {
  applyUserPreferences();
  elements.authShell.hidden = true;
  elements.appHeader.hidden = false;
  document.getElementById("userName").textContent = `Hello, ${signedInUser.name}`;
  elements.adminButton.hidden = signedInUser.role !== "ADMIN";
  document.getElementById("profileButton").hidden = isGuestUser();
  document.getElementById("logoutButton").textContent = isGuestUser() ? "Exit Guest" : "Sign out";
  if (isGuestUser()) {
    await loadRoute();
    return;
  }
  document.getElementById("profileName").value = signedInUser.name;
  document.getElementById("profileEmail").value = signedInUser.email;
  document.getElementById("profilePhone").value = signedInUser.phone || "";
  document.getElementById("profileAppTheme").value = document.body.dataset.theme || "maroon";
  document.getElementById("profileModeTheme").value = document.body.dataset.mode || "light";
  document.getElementById("profileFontTheme").value = document.body.dataset.font || "default";
  updateProfileVerifyNotice();
  await loadRoute();
}

document.querySelectorAll("[data-select-occasion]").forEach((button) => {
  button.addEventListener("click", () => openOccasion(button.dataset.selectOccasion));
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-back-dashboard]")) {
    event.preventDefault();
    confirmBeforeHome(() => {
    if (window.history.length > 1 && !location.pathname.startsWith("/login")) {
      history.back();
      return;
    }
    if (signedInUser) {
      history.pushState({}, "", "/");
      showOnly(elements.dashboard);
      loadSavedCards();
    } else {
      history.pushState({}, "", "/login");
      elements.appHeader.hidden = true;
      showOnly(elements.authShell);
    }
    });
  }
});

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "Hide" : "Show";
  });
});

initWeddingSvgPreviews();

elements.weddingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.weddingForm.reportValidity()) return;
  activeOccasion = "wedding";
  showTemplateChoice(formValues(elements.weddingForm));
});

elements.occasionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.occasionForm.reportValidity()) return;
  showTemplateChoice(formValues(elements.occasionForm));
});

document.querySelectorAll("[data-open-template]").forEach((button) => {
  button.addEventListener("click", () => openSelectedTemplate(button.dataset.openTemplate));
});

document.getElementById("backToDetailsButton")?.addEventListener("click", () => {
  showOnly(selectedBuilder());
});

document.addEventListener("change", (event) => {
  const toggle = event.target.closest("[data-premium-toggle]");
  if (!toggle) return;
  const wrapper = toggle.closest(".premium-options");
  const fields = wrapper?.querySelector(".premium-fields");
  if (fields) fields.hidden = !toggle.checked;
});

elements.saveButton.addEventListener("click", async () => {
  if (isGuestUser()) {
    elements.saveStatus.textContent = "Please sign in to save this card.";
    return;
  }
  elements.saveButton.disabled = true;
  elements.saveStatus.textContent = "Saving…";
  try {
    const invitation = await saveCurrentCard();
    elements.saveStatus.textContent = "Saved in your account.";
    currentShareUrl = invitation.shareUrl;
    currentPublicExpiresAt = invitation.publicExpiresAt;
    updateStatusBadge(invitation.status);
    updateShareDisplay();
  } catch (error) {
    elements.saveStatus.textContent = error.message;
  } finally {
    elements.saveButton.disabled = false;
  }
});

async function createPublicLink() {
  elements.saveStatus.textContent = "";
  try {
    if (!currentInvitationId) {
      elements.saveStatus.textContent = "Save the card before generating a public link.";
      return;
    }
    const invitation = await api(`/api/invitations/${activeOccasion}/${currentInvitationId}/share`, { method: "POST" });
    currentShareUrl = invitation.shareUrl;
    currentPublicExpiresAt = invitation.publicExpiresAt;
    updateStatusBadge(invitation.status);
    updateShareDisplay();
  } catch (error) {
    if (error.status === 402 && error.data?.paymentUrl) {
      history.pushState({}, "", error.data.paymentUrl);
      showOnly(elements.paymentPage);
      return;
    }
    elements.saveStatus.textContent = error.message;
  }
}

elements.shareButton.addEventListener("click", () => {
  if (isGuestUser()) {
    elements.saveStatus.textContent = "Please sign in to create a public link.";
    return;
  }
  if (!currentInvitationId) {
    elements.saveStatus.textContent = "Save the card before generating a public link.";
    return;
  }
  openPublicLinkModal();
});

document.getElementById("cancelPublicLinkBtn").addEventListener("click", closePublicLinkModal);

document.getElementById("publicLinkPayNowBtn").addEventListener("click", () => {
  closePublicLinkModal();
  history.pushState({}, "", "/plans");
  showOnly(elements.plansPage);
});

document.getElementById("confirmPublicLinkBtn").addEventListener("click", async () => {
  closePublicLinkModal();
  await createPublicLink();
});

elements.copyShareLinkButton.addEventListener("click", async () => {
  const link = elements.copyShareLinkButton.dataset.link;
  if (!link) return;
  const previousText = elements.copyShareLinkButton.textContent;
  try {
    await copyText(link);
    elements.copyShareLinkButton.textContent = "Copied!";
    elements.saveStatus.textContent = "Public link copied.";
  } catch {
    elements.saveStatus.textContent = "Unable to copy automatically. Please copy the public link from above.";
  } finally {
    window.setTimeout(() => {
      elements.copyShareLinkButton.textContent = previousText;
    }, 1400);
  }
});

document.getElementById("editButton").addEventListener("click", () => {
  showOnly(activeOccasion === "wedding" ? elements.weddingBuilder : elements.occasionBuilder);
});

document.getElementById("newCardButton").addEventListener("click", () => {
  confirmBeforeHome();
});

document.getElementById("homeButton").addEventListener("click", () => {
  confirmBeforeHome();
});

document.getElementById("cancelUnsavedBtn").addEventListener("click", () => {
  pendingHomeAction = null;
  document.getElementById("unsavedModal").classList.add("hidden");
});

document.getElementById("confirmUnsavedBtn").addEventListener("click", () => {
  document.getElementById("unsavedModal").classList.add("hidden");
  const action = pendingHomeAction || goHome;
  pendingHomeAction = null;
  action();
});

document.getElementById("adminButton").addEventListener("click", async () => {
  history.pushState({}, "", "/admin");
  await loadRoute();
});

document.getElementById("paymentHomeButton").addEventListener("click", () => {
  history.pushState({}, "", "/");
  showOnly(elements.dashboard);
  loadSavedCards();
});

document.getElementById("planPayButton").addEventListener("click", () => {
  history.pushState({}, "", "/payments");
  resetPaymentPage();
  showOnly(elements.paymentPage);
});

document.getElementById("profileButton").addEventListener("click", () => {
  if (isGuestUser()) return;
  document.getElementById("profileMessage").textContent = "";
  document.getElementById("profileName").value = signedInUser.name;
  document.getElementById("profileEmail").value = signedInUser.email;
  document.getElementById("profilePhone").value = signedInUser.phone || "";
  document.getElementById("profileAppTheme").value = document.body.dataset.theme || "maroon";
  document.getElementById("profileModeTheme").value = document.body.dataset.mode || "light";
  document.getElementById("profileFontTheme").value = document.body.dataset.font || "default";
  updateProfileVerifyNotice();
  document.body.classList.add("modal-open");
  document.getElementById("profileDialog").showModal();
});

document.getElementById("closeProfileButton").addEventListener("click", () => {
  document.getElementById("profileDialog").close();
});

document.getElementById("profileDialog").addEventListener("close", () => {
  document.body.classList.remove("modal-open");
});

document.getElementById("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("profileMessage");
  try {
    const { user } = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify(formValues(event.currentTarget))
    });
    signedInUser = user;
    applyAppTheme(document.getElementById("profileAppTheme").value);
    applyWorkspaceMode(document.getElementById("profileModeTheme").value);
    applyFontTheme(document.getElementById("profileFontTheme").value);
    saveUserPreferences();
    document.getElementById("userName").textContent = `Hello, ${user.name}`;
    document.getElementById("profileEmail").value = user.email;
    document.getElementById("profilePhone").value = user.phone || "";
    updateProfileVerifyNotice();
    message.textContent = "Profile updated.";
  } catch (error) {
    message.textContent = error.message;
  }
});

document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth(event.currentTarget, "/api/auth/login");
});

document.getElementById("guestLoginButton").addEventListener("click", async () => {
  signedInUser = { name: "Guest", role: "GUEST", emailVerified: true, guest: true };
  history.replaceState({}, "", "/");
  await enterApplication();
});

document.getElementById("forgotPasswordButton").addEventListener("click", () => {
  setAuthMode("forgot");
});

document.getElementById("forgotPasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = event.currentTarget.querySelector("[data-auth-message]");
  message.textContent = "Sending reset link…";
  try {
    const result = await api("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(formValues(event.currentTarget))
    });
    message.textContent = result.message;
  } catch (error) {
    message.textContent = error.message;
  }
});

document.getElementById("resetPasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = event.currentTarget.querySelector("[data-auth-message]");
  message.textContent = "Resetting password…";
  try {
    const result = await api("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(formValues(event.currentTarget))
    });
    message.textContent = result.message;
    event.currentTarget.reset();
    window.setTimeout(() => setAuthMode("login"), 900);
  } catch (error) {
    message.textContent = error.message;
  }
});

document.getElementById("registerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth(event.currentTarget, "/api/auth/register");
});

document.getElementById("resendVerificationButton").addEventListener("click", async () => {
  const button = document.getElementById("resendVerificationButton");
  const previousText = button.textContent;
  button.disabled = true;
  button.textContent = "Sending…";
  try {
    const result = await api("/api/auth/verify-email/request", { method: "POST" });
    button.textContent = result.message || "Sent";
  } catch (error) {
    button.textContent = error.message;
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = previousText;
    }, 2200);
  }
});

document.getElementById("logoutButton").addEventListener("click", openSignoutModal);

document.getElementById("cancelSignoutBtn").addEventListener("click", closeSignoutModal);

document.getElementById("confirmSignoutBtn").addEventListener("click", async () => {
  if (!isGuestUser()) await api("/api/auth/logout", { method: "POST" });
  closeSignoutModal();
  cleanLogoutUi();
});

document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
  pendingDelete = null;
  document.getElementById("deleteModal").classList.add("hidden");
});

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  if (!pendingDelete) return;
  await api(`/api/invitations/${pendingDelete.occasion}/${pendingDelete.id}`, { method: "DELETE" });
  pendingDelete = null;
  document.getElementById("deleteModal").classList.add("hidden");
  await loadSavedCards();
});

window.addEventListener("popstate", () => {
  const route = location.pathname.split("/").filter(Boolean)[0];
  if (signedInUser || location.pathname.startsWith("/share/") || publicStaticRoutes.includes(route)) loadRoute();
});

applyAppTheme("maroon");
applyWorkspaceMode("light");
applyFontTheme("default");

(async function bootstrap() {
  const bootRoute = location.pathname.replace(/^\/+/, "");
  if (
    location.pathname.startsWith("/share/") ||
    location.pathname === "/payment" ||
    location.pathname === "/payments" ||
    location.pathname === "/plans" ||
    location.pathname === "/verify-email" ||
    location.pathname === "/reset-password" ||
    publicStaticRoutes.includes(bootRoute)
  ) {
    if (publicStaticRoutes.includes(bootRoute)) {
      try {
        const { user } = await api("/api/auth/me");
        signedInUser = user;
        elements.appHeader.hidden = !signedInUser;
        if (signedInUser) {
          applyUserPreferences();
          document.getElementById("userName").textContent = `Hello, ${signedInUser.name}`;
          elements.adminButton.hidden = signedInUser.role !== "ADMIN";
        }
      } catch {
        signedInUser = null;
        elements.appHeader.hidden = true;
      }
    } else {
      elements.appHeader.hidden = true;
    }
    await loadRoute();
    return;
  }
  try {
    const { user } = await api("/api/auth/me");
    signedInUser = user;
  } catch {
    signedInUser = null;
  }
  if (!signedInUser) {
    cleanLogoutUi();
    return;
  }
  await enterApplication();
})();
