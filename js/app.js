import { getOccasion } from "./occasions/registry.js";
import { renderWedding } from "./occasions/wedding.js";
import { renderOccasionForm } from "./ui/form-renderer.js";
import { applyPhotoImageFallbacks, initPhotoLinkEditor, parsePhotoLinks, setPhotoLinkEditorValue } from "../frontend/General/js/photo-links.js";
import { applyInvitationSvgTheme } from "../frontend/General/js/svg-theme.js";
import { occasionSvgMap, occasionSvgOptions, svgMarkup, weddingIllustrations } from "../frontend/General/js/svg-registry.js";

/**
 * Main browser controller for routing, authentication state, card persistence,
 * public sharing, and workspace theme behavior.
 */
const elements = {
  authShell: document.getElementById("authShell"),
  appHeader: document.getElementById("appHeader"),
  appFooter: document.getElementById("appFooter"),
  dashboard: document.getElementById("dashboard"),
  adminDashboard: document.getElementById("adminDashboard"),
  monitoringPage: document.getElementById("monitoringPage"),
  plansPage: document.getElementById("plansPage"),
  paymentPage: document.getElementById("paymentPage"),
  weddingBuilder: document.getElementById("builder"),
  occasionBuilder: document.getElementById("occasionBuilder"),
  weddingInvitation: document.getElementById("invitation"),
  occasionInvitation: document.getElementById("occasionInvitation"),
  weddingForm: document.getElementById("invitationForm"),
  occasionForm: document.getElementById("occasionForm"),
  occasionFields: document.getElementById("occasionFields"),
  cardActions: document.getElementById("cardActions"),
  savedCards: document.getElementById("savedCards"),
  savedEmpty: document.getElementById("savedEmpty"),
  savedLoading: document.getElementById("savedLoading"),
  purchasedInvitations: document.getElementById("purchasedInvitations"),
  purchasedInvitationsEmpty: document.getElementById("purchasedInvitationsEmpty"),
  expiredInvitations: document.getElementById("expiredInvitations"),
  expiredInvitationsEmpty: document.getElementById("expiredInvitationsEmpty"),
  invitationSorts: [...document.querySelectorAll("[data-invitation-sort]")],
  purchasedPlans: document.getElementById("purchasedPlans"),
  plansEmpty: document.getElementById("plansEmpty"),
  plansLoading: document.getElementById("plansLoading"),
  saveButton: document.getElementById("saveCardButton"),
  shareButton: document.getElementById("shareCardButton"),
  copyShareLinkButton: document.getElementById("copyShareLinkButton"),
  previewBasicButton: document.getElementById("previewBasicButton"),
  previewPremiumButton: document.getElementById("previewPremiumButton"),
  statusBadge: document.getElementById("invitationStatusBadge"),
  saveStatus: document.getElementById("saveStatus"),
  publicBanner: document.getElementById("publicBanner"),
  profileVerifyNotice: document.getElementById("profileVerifyNotice"),
  shareInfo: document.getElementById("shareInfo"),
  shareInfoText: document.getElementById("shareInfoText"),
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
let currentShareStates = {};
let currentSavedVariants = new Set();
let dashboardInvitations = [];
let planCatalog = null;
let selectedBillingPeriod = "monthly";
let selectedPlanForPayment = null;
let profilePreviewPreferences = null;
let profileChangesCommitted = false;
let pendingCreditPurchases = [];
let selectedPublicLinkDuration = "free";
let activeAccountSection = "profile";
let staticReturnState = null;
let guestAuthAction = null;
let staticHistoryMarkerActive = false;
let occasionCountdownTimer = null;
const adminListState = {
  users: { page: 1, q: "", total: 0 },
  cards: { page: 1, q: "", total: 0 }
};
let adminNotificationRecords = [];
let adminFeedbackRecords = [];

const supportedOccasions = ["wedding", "birthday", "engagement", "office", "custom"];
const publicStaticRoutes = ["about", "contact", "privacy", "terms", "refund", "disclaimer", "acceptable-use"];
const isCustomPublicPath = (pathname) => /^\/\d+\/[a-z0-9-]+$/i.test(pathname);
const occasionSchemaCache = new Map();

function isGuestUser() {
  return signedInUser?.guest === true;
}

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
    button.setAttribute("aria-label", option.textContent.trim());
    button.innerHTML = `<span class="svg-preview-art">${previews[option.value] || svgMarkup(option.value)}</span>`;
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
  populateSvgSelect("weddingIconInput", occasionSvgOptions("wedding"), occasionSvgMap.wedding.default);
  populateSvgSelect("ganeshaVariantInput", weddingIllustrations.ganesha.options.map(({ value, label }) => [value, label]), weddingIllustrations.ganesha.default);
  populateSvgSelect("coupleVariantInput", weddingIllustrations.couple.options.map(({ value, label }) => [value, label]), weddingIllustrations.couple.default);
  initPreviewSelect("weddingIconInput", Object.fromEntries(occasionSvgMap.wedding.options.map((key) => [key, svgMarkup(key)])));
  initPreviewSelect("ganeshaVariantInput", Object.fromEntries(weddingIllustrations.ganesha.options.map((option) => [option.value, option.markup])));
  initPreviewSelect("coupleVariantInput", Object.fromEntries(weddingIllustrations.couple.options.map((option) => [option.value, option.markup])));
}

function populateSvgSelect(selectId, options, defaultValue) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const currentValue = select.value;
  select.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
  select.value = options.some(([value]) => value === currentValue) ? currentValue : defaultValue;
}

function initGenericMotifPreview() {
  const config = activeOccasionConfig || getOccasion(activeOccasion);
  populateSvgSelect("occasion-cardIcon", occasionSvgOptions(config.id), occasionSvgMap[config.id]?.default || "envelope");
  initPreviewSelect("occasion-cardIcon", {});
}

function isClearableOptionalControl(control) {
  if (!control || control.required || control.dataset.clearReady) return false;
  if (!control.closest(".details-form")) return false;
  const tag = control.tagName.toLowerCase();
  const type = String(control.type || "").toLowerCase();
  return tag === "textarea" || (
    tag === "input" &&
    !["hidden", "radio", "checkbox", "button", "submit", "reset"].includes(type)
  );
}

function enhanceOptionalClearButtons(root = document) {
  root.querySelectorAll("input, textarea").forEach((control) => {
    if (!isClearableOptionalControl(control)) return;
    control.dataset.clearReady = "true";
    const row = document.createElement("div");
    row.className = "field-control-row";
    control.before(row);
    row.append(control);
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "optional-clear-button";
    clearButton.textContent = "Clear";
    clearButton.setAttribute("aria-label", `Clear ${control.name || "optional field"}`);
    clearButton.addEventListener("click", () => {
      control.value = "";
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      control.focus();
    });
    row.append(clearButton);
  });
}

async function createDraftForCurrentOccasion() {
  if (!signedInUser || isGuestUser() || currentInvitationId) return;
  try {
    const form = activeOccasion === "wedding" ? elements.weddingForm : elements.occasionForm;
    const fields = formValues(form);
    fields.addCountdown = form.elements.addCountdown?.checked ? "yes" : "no";
    fields.templateType = fields.templateType || "basic";
    const invitation = await api(`/api/invitations/${activeOccasion}`, {
      method: "POST",
      body: JSON.stringify({ ...fields, __draft: true })
    });
    currentInvitationId = invitation.id;
    currentInvitationStatus = "DRAFT";
    currentShareStates = invitation.shareStates || {};
    elements.saveButton.textContent = "Save Card";
  } catch {
    currentInvitationId = null;
  }
}

const hideableSections = [
  elements.authShell,
  elements.dashboard,
  elements.adminDashboard,
  elements.monitoringPage,
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
  elements.weddingInvitation,
  elements.occasionInvitation
].filter(Boolean);

const staticPageByRoute = {
  about: elements.aboutPage,
  contact: elements.contactPage,
  privacy: elements.privacyPage,
  terms: elements.termsPage,
  refund: elements.refundPage,
  disclaimer: elements.disclaimerPage,
  "acceptable-use": elements.acceptableUsePage
};

const staticPageSections = Object.values(staticPageByRoute).filter(Boolean);

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
  document.body.classList.toggle("static-view", staticPageSections.includes(section));
  if (elements.appFooter) elements.appFooter.hidden = !signedInUser || staticPageSections.includes(section);
  hideableSections.forEach((element) => element.hidden = element !== section);
  elements.cardActions.hidden = ![elements.weddingInvitation, elements.occasionInvitation].includes(section);
  elements.publicBanner.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetCurrentCard() {
  currentInvitationId = null;
  currentShareUrl = null;
  currentPublicExpiresAt = null;
  currentShareStates = {};
  currentSavedVariants = new Set();
  elements.saveButton.textContent = "Save Card";
  elements.shareButton.disabled = false;
  elements.shareButton.hidden = false;
  elements.copyShareLinkButton.hidden = true;
  elements.saveStatus.textContent = "";
  setShareInfo("");
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

function setShareInfo(text = "") {
  if (elements.shareInfoText) {
    elements.shareInfoText.textContent = text;
  } else if (elements.shareInfo) {
    elements.shareInfo.textContent = text;
  }
}

function shareStateForCurrentTemplate() {
  return currentShareStates[currentTemplateType] || {};
}

function applyCurrentTemplateShareState() {
  const state = shareStateForCurrentTemplate();
  currentShareUrl = state.shareUrl || null;
  currentPublicExpiresAt = state.publicExpiresAt || null;
  updateStatusBadge(state.status || "DRAFT");
  updateShareDisplay();
}

function hasActiveCardWork() {
  return [elements.weddingBuilder, elements.occasionBuilder, elements.weddingInvitation, elements.occasionInvitation]
    .some((section) => section && !section.hidden);
}

function goHome() {
  resetCurrentCard();
  history.pushState({}, "", "/");
  showOnly(elements.dashboard);
  loadSavedCards();
  loadPlanSummary();
}

function visibleSection() {
  return hideableSections.find((section) => !section.hidden) || null;
}

function openStaticPage(route) {
  const page = staticPageByRoute[route];
  if (!page) return false;
  staticReturnState = {
    path: `${location.pathname}${location.search}${location.hash}`,
    section: visibleSection(),
    appHeaderHidden: elements.appHeader.hidden,
    appFooterHidden: elements.appFooter?.hidden ?? true,
    cardActionsHidden: elements.cardActions.hidden,
    publicBannerHidden: elements.publicBanner.hidden
  };
  history.pushState({ staticOverlay: true }, "", staticReturnState.path);
  staticHistoryMarkerActive = true;
  document.body.classList.toggle("preauth-static", !signedInUser);
  if (!signedInUser) elements.appHeader.hidden = true;
  showOnly(page);
  return true;
}

function closeStaticPage({ fromHistory = false } = {}) {
  if (!fromHistory && staticHistoryMarkerActive && window.history.length > 1) {
    history.back();
    return;
  }
  const fallbackPath = signedInUser ? "/" : "/login";
  const state = staticReturnState;
  staticReturnState = null;
  staticHistoryMarkerActive = false;
  history.replaceState({}, "", state?.path || fallbackPath);
  document.body.classList.remove("preauth-static", "static-view");
  if (state?.section && hideableSections.includes(state.section)) {
    hideableSections.forEach((section) => section.hidden = section !== state.section);
    elements.appHeader.hidden = state.appHeaderHidden;
    elements.cardActions.hidden = state.cardActionsHidden;
    elements.publicBanner.hidden = state.publicBannerHidden;
    if (elements.appFooter) elements.appFooter.hidden = state.appFooterHidden;
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (signedInUser) {
    showOnly(elements.dashboard);
    loadSavedCards();
    loadPlanSummary();
  } else {
    elements.appHeader.hidden = true;
    showOnly(elements.authShell);
  }
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
  document.body.dataset.theme = theme || "royal-blue";
}

function applyFontTheme(font) {
  document.body.dataset.font = font || "default";
}

function preferenceKey() {
  return signedInUser?.email ? `invitation_studio_preferences_${signedInUser.email.toLowerCase()}` : null;
}

function currentPreferences() {
  return {
    theme: document.body.dataset.theme || "royal-blue",
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
  applyAppTheme(prefs.theme || "royal-blue");
  applyWorkspaceMode(prefs.mode || "light");
  applyFontTheme(prefs.font || "default");
}

function setProfilePreferenceFields(preferences = currentPreferences()) {
  document.getElementById("profileAppTheme").value = preferences.theme || "royal-blue";
  document.getElementById("profileModeTheme").value = preferences.mode || "light";
  document.getElementById("profileFontTheme").value = preferences.font || "default";
}

function applyProfilePreview() {
  applyAppTheme(document.getElementById("profileAppTheme").value);
  applyWorkspaceMode(document.getElementById("profileModeTheme").value);
  applyFontTheme(document.getElementById("profileFontTheme").value);
}

function setAccountSection(section) {
  activeAccountSection = section;
  const titles = {
    profile: "Profile",
    settings: "App Settings",
    plans: "Plan Details"
  };
  document.getElementById("accountDialogTitle").textContent = titles[section] || "Account";
  document.querySelectorAll("[data-account-panel]").forEach((panel) => {
    const active = panel.dataset.accountPanel === section;
    panel.hidden = !active;
    panel.querySelectorAll("input, select, textarea, button").forEach((control) => {
      if (control.id !== "resendVerificationButton") control.disabled = !active;
    });
  });
  const saveButton = document.getElementById("saveAccountButton");
  saveButton.hidden = section === "plans";
  saveButton.textContent = section === "settings" ? "Save settings" : "Save profile";
}

function openAccountDialog(section = "profile") {
  if (isGuestUser()) return;
  profilePreviewPreferences = currentPreferences();
  profileChangesCommitted = false;
  document.getElementById("profileMessage").textContent = "";
  document.getElementById("profileName").value = signedInUser.name;
  document.getElementById("profileEmail").value = signedInUser.email;
  document.getElementById("profilePhone").value = signedInUser.phone || "";
  setProfilePreferenceFields(profilePreviewPreferences);
  updateProfileVerifyNotice();
  loadPlanSummary();
  setAccountSection(section);
  document.body.classList.add("modal-open");
  document.getElementById("profileDialog").showModal();
}

function updateProfileVerifyNotice() {
  if (elements.profileVerifyNotice) {
    elements.profileVerifyNotice.hidden = !signedInUser || signedInUser.emailVerified;
  }
}

function resetPaymentPage() {
  selectedPlanForPayment = null;
  document.querySelector("#paymentPage h1").textContent = "Complete Payment";
  document.getElementById("paymentSummary").textContent =
    "Select a plan first. Razorpay integration will be added here later.";
  document.getElementById("paymentAmountInput").value = "";
  document.getElementById("paymentMessage").textContent = "";
}

function formatCurrency(value) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

async function getPlanCatalog() {
  if (!planCatalog) planCatalog = await api("/api/plans");
  return planCatalog;
}

function renderPlanCard(plan) {
  const period = planCatalog.periods[selectedBillingPeriod];
  const price = plan.prices[selectedBillingPeriod];
  const article = document.createElement("article");
  article.className = `plan-card ${plan.cardType === "premium" ? "premium-plan" : ""}`;
  article.innerHTML = `
    <span class="template-badge">${plan.credits} credit${plan.credits > 1 ? "s" : ""}</span>
    <h2>${plan.title}</h2>
    <p>${plan.creditType === "PREMIUM" ? "Premium credits can publish Basic or Premium cards." : "Basic credits publish Basic cards only."}</p>
    <div class="plan-price">
      <del>${formatCurrency(price.actual)}</del>
      <strong>${formatCurrency(price.price)}</strong>
      <span>${price.discount}% off</span>
    </div>
    <small>${period.label} validity · ${period.days} days</small>
    <button class="generate-button" type="button">Pay Now</button>
  `;
  article.querySelector("button").addEventListener("click", () => openPayment(plan, price, period));
  return article;
}

async function renderPlansPage() {
  await getPlanCatalog();
  const tabs = document.getElementById("billingTabs");
  tabs.replaceChildren(...Object.entries(planCatalog.periods).map(([id, period]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `text-button ${id === selectedBillingPeriod ? "is-active" : ""}`;
    button.textContent = period.label;
    button.addEventListener("click", () => {
      selectedBillingPeriod = id;
      renderPlansPage();
    });
    return button;
  }));
  const single = document.getElementById("singlePlanGrid");
  const multi = document.getElementById("multiPlanGrid");
  single.replaceChildren(...planCatalog.plans.filter((plan) => !plan.multi).map(renderPlanCard));
  multi.replaceChildren(...planCatalog.plans.filter((plan) => plan.multi).map(renderPlanCard));
}

function openPayment(plan, price, period) {
  selectedPlanForPayment = { planId: plan.id, billingPeriod: selectedBillingPeriod, amount: price.price };
  document.getElementById("paymentSummary").textContent =
    `${plan.title} · ${period.label} · ${plan.credits} credit${plan.credits > 1 ? "s" : ""} · ${formatCurrency(price.price)}`;
  document.getElementById("paymentAmountInput").value = price.price;
  document.getElementById("paymentMessage").textContent = "";
  history.pushState({}, "", "/payments");
  showOnly(elements.paymentPage);
}

function photoUrls(values) {
  if (values.templateType !== "premium") return [];
  return parsePhotoLinks(values.photoLinks);
}

function renderPhotoGallery(container, urls) {
  container.hidden = urls.length === 0;
  container.classList.toggle("photo-carousel", urls.length > 1);
  const track = document.createElement("div");
  track.className = "photo-carousel-track";
  track.replaceChildren(...urls.map((url, index) => {
    const img = document.createElement("img");
    applyPhotoImageFallbacks(img, url);
    img.alt = `Invitation photo ${index + 1}`;
    img.loading = "lazy";
    const slide = document.createElement("figure");
    slide.className = "photo-slide";
    slide.append(img);
    return slide;
  }));
  container.replaceChildren(track);
  setupPhotoCarousel(track);
}

function setupPhotoCarousel(track) {
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

function renderEventCountdown(container, values, label = "Counting down to the event") {
  clearInterval(occasionCountdownTimer);
  const target = values.templateType === "premium" && values.addCountdown === "yes"
    ? eventTarget(values.date, values.time)
    : null;
  container.hidden = !target;
  if (!target) {
    container.replaceChildren();
    return;
  }
  const tick = () => {
    const parts = countdownParts(target);
    container.replaceChildren(
      Object.assign(document.createElement("p"), { className: "countdown-kicker", textContent: label }),
      ...parts.map(([partLabel, value]) => {
        const item = document.createElement("span");
        item.className = "countdown-item";
        item.innerHTML = `<strong>${String(value).padStart(2, "0")}</strong><small>${partLabel}</small>`;
        return item;
      })
    );
    if (target.getTime() <= Date.now()) clearInterval(occasionCountdownTimer);
  };
  tick();
  occasionCountdownTimer = setInterval(tick, 1000);
}

function renderGenericCard(occasion, values = formValues(elements.occasionForm)) {
  const cardData = occasion.build(values, helpers);
  elements.occasionInvitation.dataset.occasion = occasion.id;
  elements.occasionInvitation.dataset.palette = values.palette || occasion.defaultTheme;
  document.getElementById("occasionMark").innerHTML =
    svgMarkup(values.cardIcon || occasion.defaultIcon || "envelope");
  applyInvitationSvgTheme(elements.occasionInvitation);
  document.getElementById("occasionCardKicker").textContent = occasion.kicker;
  document.getElementById("occasionCardTitle").textContent = cardData.title;
  document.getElementById("occasionCardSubtitle").textContent = cardData.subtitle;
  document.getElementById("occasionCardMessage").textContent = cardData.message;
  renderEventCountdown(document.getElementById("occasionCountdown"), values, `Counting down to ${cardData.title}`);
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
  const venueLink = String(values.venueLink || "").trim();
  const directions = document.getElementById("occasionDirections");
  directions.href = venueLink;
  directions.hidden = !/^https?:\/\//i.test(venueLink);
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
  updateSaveButtonLabel();
}

function updateSaveButtonLabel() {
  elements.saveButton.textContent = currentSavedVariants.has(currentTemplateType) ? "Update Card" : "Save Card";
}

function openGeneratedCard(form) {
  const fields = formValues(form);
  const toggle = form.querySelector("[data-premium-toggle]");
  const hasPremiumFeatures = Boolean(
    toggle?.checked || String(fields.photoLinks || "").trim() || fields.addCountdown === "yes" || String(fields.publicHashtag || "").trim()
  );
  currentTemplateType = hasPremiumFeatures ? "premium" : "basic";
  pendingTemplateFields = { ...fields, templateType: currentTemplateType };
  setFormTemplateType(currentTemplateType);
  updateStatusBadge(currentInvitationId ? currentInvitationStatus : "DRAFT");
  if (activeOccasion === "wedding") {
    renderWedding(elements.weddingForm, helpers);
    renderWeddingMotif();
  } else {
    renderGenericCard(activeOccasionConfig || getOccasion(activeOccasion), pendingTemplateFields);
  }
  elements.previewBasicButton?.classList.toggle("is-active", currentTemplateType === "basic");
  elements.previewPremiumButton?.classList.toggle("is-active", currentTemplateType === "premium");
  elements.saveStatus.textContent = `${currentTemplateType === "premium" ? "Premium" : "Basic"} card selected. Save it to your account.`;
  showOnly(selectedInvitation());
}

function renderCurrentTemplatePreview() {
  setFormTemplateType(currentTemplateType);
  pendingTemplateFields = { ...currentFields(), templateType: currentTemplateType };
  if (activeOccasion === "wedding") {
    renderWedding(elements.weddingForm, helpers);
    renderWeddingMotif();
  } else {
    renderGenericCard(activeOccasionConfig || getOccasion(activeOccasion), pendingTemplateFields);
  }
  elements.previewBasicButton?.classList.toggle("is-active", currentTemplateType === "basic");
  elements.previewPremiumButton?.classList.toggle("is-active", currentTemplateType === "premium");
  applyCurrentTemplateShareState();
}

async function refreshShareStates() {
  if (!currentInvitationId) {
    currentShareStates = {};
    applyCurrentTemplateShareState();
    return;
  }
  try {
    const { shareStates } = await api(`/api/invitations/${activeOccasion}/${currentInvitationId}/share-states`);
    currentShareStates = shareStates || {};
  } catch {
    currentShareStates = {};
  }
  applyCurrentTemplateShareState();
}

function renderWeddingMotif() {
  const key = elements.weddingForm.elements.cardIcon?.value || "rings";
  document.getElementById("weddingMotif").innerHTML = svgMarkup(key);
  applyInvitationSvgTheme(elements.weddingInvitation);
}

function fillForm(form, values) {
  initPhotoLinkEditor(form, values?.photoLinks || "");
  Object.entries(values || {}).forEach(([name, value]) => {
    const element = form.elements[name];
    if (!element) return;
    if (element instanceof RadioNodeList) {
      element.value = value;
      return;
    }
    if (element.type === "checkbox") {
      element.checked = ["yes", "true", "on", "1", true].includes(value);
      return;
    }
    element.value = value;
  });
  setPhotoLinkEditorValue(form, values?.photoLinks || "");
  const shouldShowPremium = values?.templateType === "premium" || String(values?.photoLinks || "").trim() || values?.addCountdown === "yes" || String(values?.publicHashtag || "").trim();
  const toggle = form.querySelector("[data-premium-toggle]");
  const fields = form.querySelector(".premium-fields");
  if (toggle && fields) {
    toggle.checked = shouldShowPremium;
    fields.hidden = !shouldShowPremium;
  }
}

async function openOccasion(occasionId, updateUrl = true, createDraft = true) {
  activeOccasion = occasionId;
  activeOccasionConfig = null;
  resetCurrentCard();
  if (updateUrl) history.pushState({}, "", `/${occasionId}`);

  if (occasionId === "wedding") {
    initPhotoLinkEditor(elements.weddingForm);
    elements.weddingInvitation.dataset.theme = elements.weddingForm.elements.theme.value;
    enhanceOptionalClearButtons(elements.weddingForm);
    if (createDraft) await createDraftForCurrentOccasion();
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
  initPhotoLinkEditor(elements.occasionForm);
  enhanceOptionalClearButtons(elements.occasionForm);
  initGenericMotifPreview();
  if (createDraft) await createDraftForCurrentOccasion();
  showOnly(elements.occasionBuilder);
}

async function renderInvitationFromData(invitation, readOnly = false) {
  activeOccasion = invitation.occasion;
  currentInvitationId = readOnly ? null : invitation.id;
  currentShareStates = invitation.shareStates || {};
  currentTemplateType = invitation.fields?.templateType === "premium" || String(invitation.fields?.photoLinks || "").trim() || invitation.fields?.addCountdown === "yes" || String(invitation.fields?.publicHashtag || "").trim()
    ? "premium" : "basic";
  const storedVariants = Array.isArray(invitation.fields?.savedVariants) ? invitation.fields.savedVariants : [];
  currentSavedVariants = new Set([
    ...storedVariants,
    ...Object.keys(currentShareStates),
    ...(!storedVariants.length && !["DRAFT", ""].includes(invitation.status) ? [currentTemplateType] : [])
  ]);
  pendingTemplateFields = invitation.fields || null;
  updateSaveButtonLabel();
  elements.previewBasicButton?.classList.toggle("is-active", currentTemplateType === "basic");
  elements.previewPremiumButton?.classList.toggle("is-active", currentTemplateType === "premium");

  if (invitation.occasion === "wedding") {
    fillForm(elements.weddingForm, invitation.fields);
    renderWedding(elements.weddingForm, helpers);
    renderWeddingMotif();
    showOnly(elements.weddingInvitation);
  } else {
    const occasion = await getHydratedOccasion(invitation.occasion);
    activeOccasionConfig = occasion;
    renderOccasionForm(occasion, elements.occasionFields);
    enhanceOptionalClearButtons(elements.occasionForm);
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
    await refreshShareStates();
  }
}

function currentFields() {
  const form = activeOccasion === "wedding"
    ? elements.weddingForm
    : elements.occasionForm;

  const fields = formValues(form);

  const countdown = form.elements.addCountdown;
  fields.addCountdown = countdown?.checked ? "yes" : "no";

  fields.templateType = pendingTemplateFields?.templateType ||
    currentTemplateType ||
    (String(fields.photoLinks || "").trim() ? "premium" : fields.templateType || "basic");

  return fields;
}

async function saveCurrentCard() {
  const fields = currentFields();
  fields.savedVariants = [...new Set([...currentSavedVariants, currentTemplateType])];
  const url = currentInvitationId
    ? `/api/invitations/${activeOccasion}/${currentInvitationId}`
    : `/api/invitations/${activeOccasion}`;
  const invitation = await api(url, {
    method: currentInvitationId ? "PUT" : "POST",
    body: JSON.stringify(fields)
  });
  currentInvitationId = invitation.id;
  currentShareStates = invitation.shareStates || currentShareStates;
  currentInvitationStatus = invitation.status || "SAVED";
  currentSavedVariants = new Set(invitation.fields?.savedVariants || fields.savedVariants);
  currentTemplateType = invitation.fields?.templateType || currentFields().templateType || "basic";
  pendingTemplateFields = invitation.fields || { ...currentFields(), templateType: currentTemplateType };
  updateSaveButtonLabel();
  history.replaceState({}, "", invitation.url);
  await refreshShareStates();
  return invitation;
}

function updateShareDisplay() {
  clearInterval(shareTimer);
  if (!currentShareUrl || !currentPublicExpiresAt) {
    setShareInfo("");
    elements.shareButton.textContent = "Generate Public Link";
    elements.shareButton.disabled = false;
    elements.shareButton.hidden = false;
    elements.copyShareLinkButton.hidden = true;
    delete elements.shareButton.dataset.action;
    updateStatusBadge(currentInvitationStatus);
    return;
  }
  const link = `${location.origin}${currentShareUrl}`;
  elements.shareButton.hidden = true;
  elements.shareButton.disabled = false;
  delete elements.shareButton.dataset.action;
  elements.copyShareLinkButton.hidden = false;
  elements.copyShareLinkButton.dataset.link = link;
  const tick = () => {
    const remainingMs = new Date(currentPublicExpiresAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      setShareInfo(`Public link expired: ${link}`);
      elements.shareButton.hidden = false;
      elements.shareButton.textContent = "Pay Now";
      elements.shareButton.disabled = false;
      elements.shareButton.dataset.action = "pay";
      elements.copyShareLinkButton.hidden = true;
      updateStatusBadge("EXPIRED");
      clearInterval(shareTimer);
      return;
    }
    setShareInfo(`Public link: ${link} · expires in ${formatRemainingTime(remainingMs)}`);
  };
  tick();
  shareTimer = setInterval(tick, 1000);
}

function formatRemainingTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days) return `${days} day${days > 1 ? "s" : ""}${hours ? ` ${hours} hr${hours > 1 ? "s" : ""}` : ""}`;
  if (hours) return `${hours} hr${hours > 1 ? "s" : ""}${minutes ? ` ${minutes} min${minutes > 1 ? "s" : ""}` : ""}`;
  return `${minutes} min${minutes === 1 ? "" : "s"} ${seconds} sec`;
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
  elements.purchasedInvitations?.replaceChildren();
  elements.expiredInvitations?.replaceChildren();
  if (isGuestUser()) {
    elements.savedLoading.hidden = true;
    elements.savedEmpty.hidden = false;
    elements.savedEmpty.textContent = "Guest cards are not saved and will reset after refresh.";
    if (elements.purchasedInvitationsEmpty) elements.purchasedInvitationsEmpty.hidden = false;
    if (elements.expiredInvitationsEmpty) elements.expiredInvitationsEmpty.hidden = false;
    return;
  }
  elements.savedEmpty.hidden = true;
  elements.savedLoading.hidden = false;
  try {
    const { invitations } = await api("/api/invitations");
    elements.savedLoading.hidden = true;
    dashboardInvitations = invitations;
    renderDashboardInvitations();
  } catch (error) {
    elements.savedLoading.hidden = true;
    elements.savedEmpty.hidden = false;
    elements.savedEmpty.textContent = error.message;
  }
}

function renderDashboardInvitations() {
    elements.savedCards.replaceChildren();
    elements.purchasedInvitations?.replaceChildren();
    elements.expiredInvitations?.replaceChildren();
    const saved = sortDashboardInvitations(dashboardInvitations.filter((invitation) => !["PAID", "EXPIRED"].includes(invitation.status)), document.getElementById("savedInvitationSort")?.value);
    const purchased = sortDashboardInvitations(dashboardInvitations.filter((invitation) => invitation.status === "PAID"), document.getElementById("purchasedInvitationSort")?.value);
    const expired = sortDashboardInvitations(dashboardInvitations.filter((invitation) => invitation.status === "EXPIRED"), document.getElementById("expiredInvitationSort")?.value);
    elements.savedEmpty.hidden = saved.length > 0;
    if (elements.purchasedInvitationsEmpty) elements.purchasedInvitationsEmpty.hidden = purchased.length > 0;
    if (elements.expiredInvitationsEmpty) elements.expiredInvitationsEmpty.hidden = expired.length > 0;
    saved.forEach((invitation) => elements.savedCards.append(savedInvitationCard(invitation)));
    purchased.forEach((invitation) => elements.purchasedInvitations?.append(savedInvitationCard(invitation)));
    expired.forEach((invitation) => elements.expiredInvitations?.append(savedInvitationCard(invitation)));
}

function sortDashboardInvitations(invitations, sortMode = "created-desc") {
  const statusOrder = { DRAFT: 1, SAVED: 2, PUBLISHED: 3, PAID: 4, EXPIRED: 5 };
  return [...invitations].sort((a, b) => {
    if (sortMode === "status") {
      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    const updated = sortMode.startsWith("updated");
    const aDate = new Date(updated ? a.updatedAt || a.createdAt : a.createdAt).getTime();
    const bDate = new Date(updated ? b.updatedAt || b.createdAt : b.createdAt).getTime();
    const diff = aDate - bDate;
    return sortMode.endsWith("asc") ? diff : -diff;
  });
}

function statusLabel(status) {
  return status === "SAVED" ? "Saved" : String(status || "DRAFT").charAt(0) +
    String(status || "DRAFT").slice(1).toLowerCase();
}

function savedInvitationCard(invitation) {
      const card = document.createElement("article");
      card.className = "saved-card";
      const type = document.createElement("span");
      type.className = "saved-card-type";
      type.textContent = invitation.occasion;
      const status = document.createElement("span");
      status.className = `status-badge status-${String(invitation.status || "DRAFT").toLowerCase()}`;
      status.textContent = statusLabel(invitation.status);
      const variants = document.createElement("span");
      variants.className = "saved-card-variant";
      const savedVariants = Array.isArray(invitation.fields?.savedVariants) && invitation.fields.savedVariants.length
        ? invitation.fields.savedVariants
        : [invitation.fields?.templateType || (String(invitation.fields?.photoLinks || "").trim() ? "premium" : "basic")];
      variants.textContent = [...new Set(savedVariants)].map((type) => type === "premium" ? "Premium" : "Basic").join(" + ");
      const title = document.createElement("h3");
      title.textContent = invitation.title;
      const time = document.createElement("time");
      const createdAt = new Date(invitation.createdAt);
      const updatedAt = new Date(invitation.updatedAt || invitation.createdAt);
      const wasUpdated = Number.isFinite(updatedAt.getTime()) && Number.isFinite(createdAt.getTime())
        && updatedAt.getTime() - createdAt.getTime() > 60_000;
      time.textContent = `${wasUpdated ? "Updated" : "Created"} ${new Intl.DateTimeFormat("en-IN", {
        day: "numeric", month: "short", year: "numeric"
      }).format(wasUpdated ? updatedAt : createdAt)}`;
      const note = document.createElement("p");
      note.className = "saved-card-note";
      note.textContent = dashboardInvitationNote(invitation);
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
      meta.append(type, variants, status);
      card.append(meta, title, time);
      if (note.textContent) card.append(note);
      card.append(actions);
      return card;
}

function dashboardInvitationNote(invitation) {
  if (invitation.status === "PAID") {
    const type = invitation.paidCreditType ? `${invitation.paidCreditType} ` : "";
    return `${type}${invitation.paidPlanTitle || "Paid plan"} · expires in ${formatRemainingTime(new Date(invitation.publicExpiresAt).getTime() - Date.now())}`;
  }
  if (invitation.status === "EXPIRED") {
    return `Public link expired · permanently deletes in ${invitation.daysUntilPermanentDelete ?? 365} day${invitation.daysUntilPermanentDelete === 1 ? "" : "s"}`;
  }
  if (invitation.status === "PUBLISHED" && invitation.publicExpiresAt) {
    return `Free public link expires in ${formatRemainingTime(new Date(invitation.publicExpiresAt).getTime() - Date.now())}`;
  }
  return "";
}

async function loadPlanSummary() {
  if (!signedInUser || isGuestUser()) return;
  if (elements.purchasedPlans) {
    elements.purchasedPlans.replaceChildren();
    elements.plansEmpty.hidden = true;
    elements.plansLoading.hidden = false;
  }
  try {
    const { purchases, transactions } = await api("/api/plans/me");
    if (elements.purchasedPlans) {
      elements.plansLoading.hidden = true;
      elements.plansEmpty.hidden = purchases.length > 0;
      elements.purchasedPlans.replaceChildren(...purchases.map((plan) => {
        const card = document.createElement("article");
        card.className = "saved-card";
        card.innerHTML = `
          <div class="saved-card-meta">
            <span class="saved-card-type">${plan.creditType}</span>
            <span class="status-badge status-paid">${plan.availableCredits}/${plan.totalCredits} left</span>
          </div>
          <h3>${plan.planTitle}</h3>
          <time>${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"} left · Active cards: ${plan.totalCredits - plan.availableCredits}</time>
        `;
        return card;
      }));
    }
    const profilePlans = document.getElementById("profilePlanDetails");
    if (profilePlans) {
      profilePlans.innerHTML = purchases.length
        ? purchases.map((plan) => `<p><strong>${plan.planTitle}</strong><br>${plan.availableCredits}/${plan.totalCredits} ${plan.creditType} credits available · ${plan.daysLeft} days left</p>`).join("")
        : "<p><strong>Free tier</strong><br>No paid credits are active. You can still generate the first free public link for each card type.</p>";
    }
    const profileTransactions = document.getElementById("profileTransactions");
    if (profileTransactions) {
      profileTransactions.innerHTML = transactions.length
        ? transactions.map((tx) => `
            <tr>
              <td>${new Date(tx.createdAt).toLocaleDateString("en-IN")}</td>
              <td>
                <strong>
                  ${tx.type === "PURCHASE" ? "Plan purchased" : "Credit used"}
                </strong>
              </td>
              <td>${tx.note || tx.planTitle || tx.invitationTitle || "—"}</td>
              <td>${tx.amount ? formatCurrency(tx.amount) : "—"}</td>
            </tr>
          `).join("")
        : `
            <tr>
              <td colspan="4" class="transaction-empty">
                No transactions yet.
              </td>
            </tr>
          `;
    }
  } catch (error) {
    if (elements.purchasedPlans) {
      elements.plansLoading.hidden = true;
      elements.plansEmpty.hidden = false;
      elements.plansEmpty.textContent = error.message;
    }
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

async function eligibleCreditsForCurrentCard() {
  const { purchases } = await api("/api/plans/me");
  const isPremiumCard = currentFields().templateType === "premium";
  return purchases.filter((plan) => isPremiumCard
    ? plan.creditType === "PREMIUM"
    : ["BASIC", "PREMIUM"].includes(plan.creditType));
}

function publicDurationLabel(periodId) {
  return {
    monthly: "Monthly",
    quarterly: "Quarterly",
    halfyearly: "Half-Yearly",
    yearly: "Yearly"
  }[periodId] || "selected";
}

function updatePublicLinkCreditOptions() {
  const creditButton = document.getElementById("confirmCreditPublicLinkBtn");
  const creditText = document.getElementById("publicLinkCreditText");
  const creditField = document.getElementById("publicLinkCreditField");
  const creditSelect = document.getElementById("publicLinkCreditSelect");
  const duration = document.querySelector("input[name='publicLinkDuration']:checked")?.value || "free";
  selectedPublicLinkDuration = duration;
  if (duration === "free") {
    creditField.hidden = true;
    creditText.hidden = false;
    creditText.textContent = "Free public link will use the limited trial duration for this card type.";
    creditButton.disabled = false;
    return;
  }
  const matchingCredits = pendingCreditPurchases.filter((plan) => plan.billingPeriod === duration);
  creditField.hidden = false;
  creditText.hidden = false;
  creditSelect.replaceChildren();
  if (!matchingCredits.length) {
    const option = document.createElement("option");
    option.textContent = `No ${publicDurationLabel(duration)} credits available`;
    option.disabled = true;
    option.selected = true;
    creditSelect.append(option);
    creditButton.disabled = true;
    creditText.textContent = `No ${publicDurationLabel(duration)} credits are available for this card.`;
    return;
  }
  creditButton.disabled = false;
  creditText.textContent = `Choose one ${publicDurationLabel(duration)} credit for this public link.`;
  creditSelect.replaceChildren(...matchingCredits.map((plan) => {
    const option = document.createElement("option");
    option.value = plan.id;
    option.textContent = `${plan.planTitle} | ${plan.creditType} | ${plan.availableCredits}/${plan.totalCredits} left | ${plan.daysLeft} days`;
    return option;
  }));
}

async function openPublicLinkModal() {
  const duration = currentFields().templateType === "premium" ? 5 : 10;
  const text = document.getElementById("publicLinkDurationText");
  if (text) text.textContent = `Link creation will be allowed once for ${duration} minutes.`;
  pendingCreditPurchases = [];
  try {
    pendingCreditPurchases = await eligibleCreditsForCurrentCard();
  } catch {
    pendingCreditPurchases = [];
  }
  document.getElementById("freeDurationLabel").textContent = `Free ${duration} min link`;
  const freeRadio = document.querySelector("input[name='publicLinkDuration'][value='free']");
  freeRadio.disabled = Boolean(shareStateForCurrentTemplate().shareUrl);
  selectedPublicLinkDuration = freeRadio.disabled ? "monthly" : "free";
  const selectedRadio = document.querySelector(`input[name='publicLinkDuration'][value='${selectedPublicLinkDuration}']`);
  if (selectedRadio) selectedRadio.checked = true;
  updatePublicLinkCreditOptions();
  document.getElementById("publicLinkModal").classList.remove("hidden");
}

function closePublicLinkModal() {
  pendingCreditPurchases = [];
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

  if ((route === "share" && parts[1]) || (/^\d+$/.test(route || "") && parts[1])) {
    try {
      const publicApiPath = route === "share"
        ? `/api/public/${parts[1]}`
        : `/api/public-path/${parts[0]}/${encodeURIComponent(parts[1])}`;
      const invitation = await api(publicApiPath);
      await renderInvitationFromData(invitation, true);
      document.body.classList.add("public-share");
      if (elements.appFooter) elements.appFooter.hidden = true;
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
    elements.appHeader.hidden = !signedInUser;
    showOnly(elements.paymentPage);
    return;
  }

  if (route === "payments") {
    resetPaymentPage();
    elements.appHeader.hidden = !signedInUser;
    showOnly(elements.paymentPage);
    return;
  }

  if (route === "plans") {
    elements.appHeader.hidden = !signedInUser;
    await renderPlansPage();
    showOnly(elements.plansPage);
    return;
  }

  if (publicStaticRoutes.includes(route)) {
    showOnly(staticPageByRoute[route]);
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

  if (route === "monitoring") {
    if (signedInUser?.role !== "ADMIN") {
      history.replaceState({}, "", "/");
      showOnly(elements.dashboard);
      return;
    }
    await loadMonitoringPage();
    showOnly(elements.monitoringPage);
    return;
  }

  if (!route) {
    showOnly(elements.dashboard);
    await Promise.all([loadSavedCards(), loadPlanSummary()]);
    return;
  }

  if (!supportedOccasions.includes(route)) {
    history.replaceState({}, "", "/");
    showOnly(elements.dashboard);
    await Promise.all([loadSavedCards(), loadPlanSummary()]);
    return;
  }

  const invitationId = new URLSearchParams(location.search).get("id");
  await openOccasion(route, false, !invitationId);
  if (!invitationId) return;
  const invitation = await api(`/api/invitations/${route}/${invitationId}`);
  await renderInvitationFromData(invitation, false);
}

async function loadAdminDashboard() {
  const statsData = await api("/api/admin/stats");
  document.getElementById("adminStats").innerHTML = Object.entries(statsData.stats)
    .map(([label, value]) => `<div class="admin-stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
  await Promise.all([loadAdminList("users"), loadAdminList("cards")]);
  try {
    const [{ notifications }, { feedback }] = await Promise.all([
      api("/api/admin/notifications"), api("/api/admin/feedback")
    ]);
    document.getElementById("adminNotificationCount").textContent = `(${notifications.length})`;
    document.getElementById("adminFeedbackCount").textContent = `(${feedback.length})`;
  } catch { /* The notification panel reports its own load failures when opened. */ }
}

function escapeAdminText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function loadAdminList(kind) {
  const state = adminListState[kind];
  const params = new URLSearchParams({ page: state.page, pageSize: 10, q: state.q });
  const isUsers = kind === "users";
  const data = await api(`/api/admin/${isUsers ? "users" : "invitations"}?${params}`);
  state.total = data.total;
  if (isUsers) {
    document.getElementById("adminUsers").innerHTML = data.users.map((user) =>
      `<li class="admin-list-row"><span><strong>${escapeAdminText(user.name)}</strong><br>${escapeAdminText(user.email)}${user.phone ? ` · ${escapeAdminText(user.phone)}` : ""}<br><small>${escapeAdminText(user.role)} · ${user.invitationCount} cards · ${new Date(user.createdAt).toLocaleDateString("en-IN")}</small></span><button type="button" data-admin-reset-id="${escapeAdminText(user.id)}">Send password reset</button></li>`
    ).join("") || "<li>No matching users.</li>";
  } else {
    document.getElementById("adminInvitations").innerHTML = data.invitations.map((card) =>
      `<li class="admin-list-row"><span><strong>${escapeAdminText(card.title)}</strong><br>${escapeAdminText(card.occasion)} · ${escapeAdminText(card.owner.name)} (${escapeAdminText(card.owner.email)})<br><small>Updated ${new Date(card.updatedAt).toLocaleString("en-IN")}</small></span></li>`
    ).join("") || "<li>No matching cards.</li>";
  }
  const pageLabel = document.getElementById(isUsers ? "adminUsersPage" : "adminCardsPage");
  const maxPage = Math.max(1, Math.ceil(state.total / 10));
  pageLabel.textContent = `Page ${state.page} of ${maxPage} · ${state.total} total`;
  document.querySelectorAll(`[data-admin-page="${kind}"]`).forEach((button) => {
    button.disabled = button.dataset.delta === "-1" ? state.page <= 1 : state.page >= maxPage;
  });
}

async function loadAdminNotifications() {
  const { notifications } = await api("/api/admin/notifications");
  adminNotificationRecords = notifications;
  document.getElementById("adminNotificationCount").textContent = `(${notifications.length})`;
  const list = document.getElementById("adminNotifications");
  list.replaceChildren();
  notifications.forEach((record) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-notification-item";
    button.dataset.notificationId = record.id;
    button.textContent = `${record.type} · ${record.user?.name || "Unknown"}${record.user?.email ? ` (${record.user.email})` : ""} · ${new Date(record.createdAt).toLocaleString("en-IN")} · ${record.summary}`;
    item.append(button);
    list.append(item);
  });
  if (!notifications.length) list.innerHTML = "<li>No error notifications.</li>";
}

async function loadAdminFeedback() {
  const { feedback } = await api("/api/admin/feedback");
  adminFeedbackRecords = feedback;
  document.getElementById("adminFeedbackCount").textContent = `(${feedback.length})`;
  const list = document.getElementById("adminFeedback");
  list.replaceChildren();
  feedback.forEach((record) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-notification-item";
    button.dataset.feedbackId = record.id;
    button.textContent = `${record.user.name} (${record.user.email}) · ${new Date(record.createdAt).toLocaleString("en-IN")} · ${record.summary}`;
    item.append(button);
    list.append(item);
  });
  if (!feedback.length) list.innerHTML = "<li>No Contact Us feedback has been submitted.</li>";
}

function showAdminNotification(record) {
  const panel = document.getElementById("adminNotificationDetails");
  panel.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = `${record.type}: ${record.summary}`;
  const byline = document.createElement("p");
  byline.textContent = `${record.user?.name || "Unknown user"}${record.user?.email ? ` · ${record.user.email}` : ""} · ${new Date(record.createdAt).toLocaleString("en-IN")}`;
  const details = document.createElement("pre");
  details.textContent = Object.entries(record.details || {}).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join("\n");
  panel.append(title, byline, details);
  panel.hidden = false;
}

async function loadMonitoringPage() {
  const { logs } = await api("/api/admin/logs");
  const list = document.getElementById("monitoringLogs");
  list.innerHTML = logs.length
    ? logs.map((log) => `<li><strong>${log.level}</strong> · ${new Date(log.createdAt).toLocaleString("en-IN")} · ${log.message}${log.path ? ` · ${log.path}` : ""}</li>`).join("")
    : "<li>No issues logged in this server session.</li>";
}

function enforceAdminVisibility() {
  if (signedInUser?.role === "ADMIN") return;
  if (elements.adminDashboard && !elements.adminDashboard.hidden) elements.adminDashboard.hidden = true;
  if (elements.monitoringPage && !elements.monitoringPage.hidden) elements.monitoringPage.hidden = true;
}

function cleanLogoutUi() {
  resetCurrentCard();
  signedInUser = null;
  applyAppTheme("royal-blue");
  applyWorkspaceMode("light");
  applyFontTheme("default");
  elements.appHeader.hidden = true;
  elements.cardActions.hidden = true;
  elements.publicBanner.hidden = true;
  updateProfileVerifyNotice();
  elements.copyShareLinkButton.hidden = true;
  elements.savedCards.replaceChildren();
  if (elements.purchasedPlans) elements.purchasedPlans.replaceChildren();
  elements.purchasedInvitations?.replaceChildren();
  elements.expiredInvitations?.replaceChildren();
  elements.savedEmpty.textContent = "You have not saved an invitation yet.";
  elements.savedEmpty.hidden = false;
  if (elements.purchasedInvitationsEmpty) elements.purchasedInvitationsEmpty.hidden = false;
  if (elements.expiredInvitationsEmpty) elements.expiredInvitationsEmpty.hidden = false;
  elements.savedLoading.hidden = true;
  if (elements.plansEmpty) elements.plansEmpty.hidden = false;
  if (elements.plansLoading) elements.plansLoading.hidden = true;
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

function openGuestAuthOverlay(action) {
  guestAuthAction = action;
  const shell = elements.authShell;
  shell.hidden = false;
  shell.classList.add("guest-auth-overlay");
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");
  document.body.classList.add("modal-open");
  document.getElementById("guestAuthCloseButton").hidden = false;
  document.getElementById("guestAuthNotice").textContent =
    "Sign in or create an account to continue. Your invitation details will be saved with your account.";
  document.getElementById("guestAuthNotice").hidden = false;
  document.getElementById("guestLoginButton").hidden = true;
  setAuthMode("login");
}

function closeGuestAuthOverlay() {
  guestAuthAction = null;
  elements.authShell.hidden = true;
  elements.authShell.classList.remove("guest-auth-overlay");
  elements.authShell.removeAttribute("role");
  elements.authShell.removeAttribute("aria-modal");
  document.body.classList.remove("modal-open");
  document.getElementById("guestAuthCloseButton").hidden = true;
  document.getElementById("guestAuthNotice").hidden = true;
  document.getElementById("guestLoginButton").hidden = false;
}

async function submitAuth(form, endpoint) {
  const message = form.querySelector("[data-auth-message]");
  message.textContent = "";
  try {
    const { user } = await api(endpoint, { method: "POST", body: JSON.stringify(formValues(form)) });
    signedInUser = user;
    // Admin markup is returned only to an authenticated admin page request.
    if (user.role === "ADMIN") {
      location.replace("/admin");
      return;
    }
    await enterApplication();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function enterApplication() {
  const resumeGuestAction = guestAuthAction;
  guestAuthAction = null;
  applyUserPreferences();
  elements.authShell.hidden = true;
  elements.authShell.classList.remove("guest-auth-overlay");
  elements.authShell.removeAttribute("role");
  elements.authShell.removeAttribute("aria-modal");
  document.body.classList.remove("modal-open");
  document.getElementById("guestAuthCloseButton").hidden = true;
  document.getElementById("guestAuthNotice").hidden = true;
  document.getElementById("guestLoginButton").hidden = false;
  elements.appHeader.hidden = false;
  document.getElementById("userName").textContent = `Hello, ${signedInUser.name}`;
  elements.adminButton.hidden = signedInUser.role !== "ADMIN";
  document.getElementById("accountButton").hidden = isGuestUser();
  document.getElementById("logoutButton").textContent = isGuestUser() ? "Exit Guest" : "Sign out";
  if (isGuestUser()) {
    await loadRoute();
    return;
  }
  document.getElementById("profileName").value = signedInUser.name;
  document.getElementById("profileEmail").value = signedInUser.email;
  document.getElementById("profilePhone").value = signedInUser.phone || "";
  setProfilePreferenceFields();
  updateProfileVerifyNotice();
  if (resumeGuestAction) {
    try {
      const invitation = await saveCurrentCard();
      elements.saveStatus.textContent = "Your guest invitation has been saved to your account.";
      if (resumeGuestAction === "share") await openPublicLinkModal();
      else {
        currentShareStates = invitation.shareStates || currentShareStates;
        applyCurrentTemplateShareState();
      }
      await loadPlanSummary();
    } catch (error) {
      elements.saveStatus.textContent = error.message;
    }
    return;
  }
  await loadRoute();
}

document.querySelectorAll("[data-select-occasion]").forEach((button) => {
  button.addEventListener("click", () => openOccasion(button.dataset.selectOccasion));
});

document.querySelectorAll(".static-page").forEach((page) => {
  if (page.querySelector("[data-close-static]")) return;
  const button = document.createElement("button");
  button.className = "back-button static-close-button";
  button.type = "button";
  button.dataset.closeStatic = "";
  button.textContent = "Close";
  page.prepend(button);
});

document.addEventListener("click", (event) => {
  const staticLink = event.target.closest("a[href]");
  if (staticLink) {
    const url = new URL(staticLink.href, location.origin);
    const route = url.pathname.split("/").filter(Boolean)[0];
    if (url.origin === location.origin && publicStaticRoutes.includes(route)) {
      event.preventDefault();
      if (!document.body.classList.contains("static-view")) {
        openStaticPage(route);
      }
      return;
    }
  }
  if (event.target.closest("[data-back-dashboard]")) {
    event.preventDefault();
    if (document.body.classList.contains("static-view")) {
      closeStaticPage();
      return;
    }
    confirmBeforeHome(() => {
    if (window.history.length > 1 && !location.pathname.startsWith("/login")) {
      history.back();
      return;
    }
    if (signedInUser) {
      history.pushState({}, "", "/");
      showOnly(elements.dashboard);
      loadSavedCards();
      loadPlanSummary();
    } else {
      history.pushState({}, "", "/login");
      elements.appHeader.hidden = true;
      showOnly(elements.authShell);
    }
    });
  }
  if (event.target.closest("[data-close-static]")) {
    event.preventDefault();
    closeStaticPage();
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

function validPhone(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  return /^[0-9]{10}$/.test(text);
}

function validPassword(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(value || ""));
}

function passwordRules(value) {
  const text = String(value || "");
  return {
    length: text.length >= 8,
    upper: /[A-Z]/.test(text),
    lower: /[a-z]/.test(text),
    number: /\d/.test(text)
  };
}

function setRegisterFieldError(id, message = "") {
  const input = document.getElementById(id);
  const field = input?.closest(".field");
  const error = document.getElementById(`${id}Error`);
  field?.classList.toggle("has-error", Boolean(message));
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
  if (error) error.textContent = message;
}

function updatePasswordStrength() {
  const password = document.getElementById("registerPassword").value;
  const rules = passwordRules(password);
  Object.entries(rules).forEach(([key, valid]) => {
    document.querySelector(`[data-password-rule="${key}"]`)?.classList.toggle("is-valid", valid);
  });
  const score = Object.values(rules).filter(Boolean).length;
  const strength = score >= 4 ? "high" : score >= 2 ? "medium" : "low";
  const wrapper = document.querySelector(".password-strength");
  wrapper?.setAttribute("data-strength", strength);
  document.getElementById("passwordStrengthLabel").textContent = strength.charAt(0).toUpperCase() + strength.slice(1);
}

function missingPasswordCriteria(value) {
  const rules = passwordRules(value);
  const missing = [];
  if (!rules.length) missing.push("at least 8 characters");
  if (!rules.upper) missing.push("1 uppercase letter");
  if (!rules.lower) missing.push("1 lowercase letter");
  if (!rules.number) missing.push("1 number");
  return missing;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function validateRegisterForm(showTermsError = false) {
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();
  const password = document.getElementById("registerPassword").value;
  const consent = document.getElementById("registerConsent");
  const termsError = document.getElementById("registerTermsError");
  let valid = true;

  setRegisterFieldError("registerName", name ? "" : "Please enter your name.");
  setRegisterFieldError("registerEmail", validEmail(email) ? "" : "Please enter a valid email address.");
  setRegisterFieldError("registerPhone", phone && validPhone(phone) ? "" : "Phone number must be exactly 10 digits.");
  const missing = missingPasswordCriteria(password);
  setRegisterFieldError("registerPassword", missing.length ? `Missing: ${missing.join(", ")}.` : "");

  valid = Boolean(name) && validEmail(email) && Boolean(phone) && validPhone(phone) && missing.length === 0 && consent.checked;
  consent.closest(".consent-check")?.classList.toggle("has-error", showTermsError && !consent.checked);
  termsError.textContent = showTermsError && !consent.checked ? "Please accept the Terms before Sign Up" : "";
  updatePasswordStrength();
  return valid;
}

function syncRegisterButton() {
  document.getElementById("registerSubmitButton").disabled = false;
  updatePasswordStrength();
}

["registerName", "registerEmail", "registerPhone", "registerPassword", "registerConsent"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    if (id === "registerPassword") updatePasswordStrength();
    const input = document.getElementById(id);
    if (input?.getAttribute("aria-invalid") === "true") validateRegisterForm(false);
  });
  document.getElementById(id).addEventListener("change", () => {
    if (id === "registerConsent") validateRegisterForm(false);
  });
});
syncRegisterButton();

initWeddingSvgPreviews();
enhanceOptionalClearButtons(elements.weddingForm);

elements.weddingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.weddingForm.reportValidity()) return;
  activeOccasion = "wedding";
  openGeneratedCard(elements.weddingForm);
});

elements.occasionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.occasionForm.reportValidity()) return;
  openGeneratedCard(elements.occasionForm);
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
    openGuestAuthOverlay("save");
    return;
  }
  elements.saveButton.disabled = true;
  elements.saveStatus.textContent = "Saving…";
  try {
    const invitation = await saveCurrentCard();
    elements.saveStatus.textContent = "Saved in your account.";
    currentShareStates = invitation.shareStates || currentShareStates;
    applyCurrentTemplateShareState();
    await loadPlanSummary();
  } catch (error) {
    elements.saveStatus.textContent = error.message;
  } finally {
    elements.saveButton.disabled = false;
  }
});

async function createPublicLink(useCredit = false) {
  elements.saveStatus.textContent = "";
  try {
    if (!currentInvitationId) {
      elements.saveStatus.textContent = "Save the card before generating a public link.";
      return;
    }
    const invitation = await api(`/api/invitations/${activeOccasion}/${currentInvitationId}/share`, {
      method: "POST",
      body: JSON.stringify({
        useCredit,
        templateType: currentTemplateType,
        publicHashtag: currentFields().publicHashtag || "",
        purchaseId: useCredit ? document.getElementById("publicLinkCreditSelect")?.value : ""
      })
    });
    currentShareStates = invitation.shareStates || currentShareStates;
    applyCurrentTemplateShareState();
    await loadPlanSummary();
  } catch (error) {
    if (error.status === 402 && error.data?.paymentUrl) {
      history.pushState({}, "", error.data.paymentUrl);
      if (error.data.paymentUrl === "/plans") {
        await renderPlansPage();
        showOnly(elements.plansPage);
      } else {
        showOnly(elements.paymentPage);
      }
      return;
    }
    elements.saveStatus.textContent = error.message;
  }
}

elements.shareButton.addEventListener("click", () => {
  if (elements.shareButton.dataset.action === "pay") {
    openPublicLinkModal();
    return;
  }
  if (isGuestUser()) {
    openGuestAuthOverlay("share");
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
  renderPlansPage().then(() => showOnly(elements.plansPage));
});

document.getElementById("confirmCreditPublicLinkBtn").addEventListener("click", async () => {
  const useCredit = (document.querySelector("input[name='publicLinkDuration']:checked")?.value || "free") !== "free";
  closePublicLinkModal();
  await createPublicLink(useCredit);
});

document.querySelectorAll("input[name='publicLinkDuration']").forEach((radio) => {
  radio.addEventListener("change", updatePublicLinkCreditOptions);
});

elements.copyShareLinkButton.addEventListener("click", async () => {
  const link = elements.copyShareLinkButton.dataset.link;
  if (!link) return;
  try {
    await copyText(link);
  } catch {
    elements.saveStatus.textContent = "Unable to copy automatically. Please copy the public link from above.";
  }
});

document.getElementById("editButton").addEventListener("click", () => {
  showOnly(activeOccasion === "wedding" ? elements.weddingBuilder : elements.occasionBuilder);
});

elements.previewBasicButton.addEventListener("click", () => {
  currentTemplateType = "basic";
  renderCurrentTemplatePreview();
});

elements.previewPremiumButton.addEventListener("click", () => {
  currentTemplateType = "premium";
  renderCurrentTemplatePreview();
});

document.getElementById("newCardButton")?.addEventListener("click", () => confirmBeforeHome());

elements.invitationSorts.forEach((sort) => sort.addEventListener("change", renderDashboardInvitations));

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

document.getElementById("openMonitoringButton")?.addEventListener("click", async () => {
  history.pushState({}, "", "/monitoring");
  await loadRoute();
});

document.querySelectorAll("[data-admin-search]").forEach((button) => {
  button.addEventListener("click", async () => {
    const kind = button.dataset.adminSearch;
    adminListState[kind].q = document.getElementById(kind === "users" ? "adminUsersSearch" : "adminCardsSearch").value.trim();
    adminListState[kind].page = 1;
    await loadAdminList(kind);
  });
});

document.querySelectorAll("[data-admin-page]").forEach((button) => {
  button.addEventListener("click", async () => {
    const state = adminListState[button.dataset.adminPage];
    state.page = Math.max(1, state.page + Number(button.dataset.delta));
    await loadAdminList(button.dataset.adminPage);
  });
});

document.getElementById("adminUsersSearch")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") document.querySelector('[data-admin-search="users"]').click();
});
document.getElementById("adminCardsSearch")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") document.querySelector('[data-admin-search="cards"]').click();
});

document.getElementById("openNotificationsButton")?.addEventListener("click", async () => {
  const panel = document.getElementById("adminNotificationsPanel");
  panel.hidden = !panel.hidden;
  if (panel.hidden) return;
  try { await loadAdminNotifications(); }
  catch (error) { document.getElementById("adminNotifications").textContent = error.message; }
});

document.getElementById("adminNotifications")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-notification-id]");
  const record = adminNotificationRecords.find((item) => item.id === button?.dataset.notificationId);
  if (record) showAdminNotification(record);
});

document.getElementById("openFeedbackButton")?.addEventListener("click", async () => {
  const panel = document.getElementById("adminFeedbackPanel");
  panel.hidden = !panel.hidden;
  if (panel.hidden) return;
  try { await loadAdminFeedback(); }
  catch (error) { document.getElementById("adminFeedback").textContent = error.message; }
});

document.getElementById("adminFeedback")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-feedback-id]");
  const record = adminFeedbackRecords.find((item) => item.id === button?.dataset.feedbackId);
  if (record) {
    const panel = document.getElementById("adminFeedbackDetails");
    panel.replaceChildren();
    const title = document.createElement("h3");
    title.textContent = `Feedback: ${record.summary}`;
    const byline = document.createElement("p");
    byline.textContent = `${record.user.name} · ${record.user.email} · ${new Date(record.createdAt).toLocaleString("en-IN")}`;
    const details = document.createElement("pre");
    details.textContent = Object.entries(record.details).map(([key, value]) => `${key}: ${value}`).join("\n");
    panel.append(title, byline, details);
    panel.hidden = false;
  }
});

document.getElementById("adminUsers")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-reset-id]");
  if (!button) return;
  button.disabled = true;
  try {
    const result = await api(`/api/admin/users/${button.dataset.adminResetId}/reset-password`, { method: "POST" });
    document.getElementById("adminActionStatus").textContent = result.message;
  } catch (error) {
    document.getElementById("adminActionStatus").textContent = error.message;
  } finally { button.disabled = false; }
});

document.getElementById("contactForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("contactStatus");
  const submit = form.querySelector('[type="submit"]');
  status.textContent = "Sending…";
  submit.disabled = true;
  try {
    const result = await api("/api/contact", { method: "POST", body: JSON.stringify(formValues(form)) });
    status.textContent = result.message;
    form.reset();
  } catch (error) {
    status.textContent = error.message;
  } finally { submit.disabled = false; }
});

document.getElementById("monitoringBackButton")?.addEventListener("click", async () => {
  history.pushState({}, "", "/admin");
  await loadRoute();
});

document.getElementById("paymentHomeButton").addEventListener("click", () => {
  history.pushState({}, "", "/");
  showOnly(elements.dashboard);
  loadSavedCards();
  loadPlanSummary();
});

document.getElementById("paymentPlansButton").addEventListener("click", async () => {
  history.pushState({}, "", "/plans");
  await renderPlansPage();
  showOnly(elements.plansPage);
});

document.getElementById("dummyPaymentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("paymentMessage");
  if (!selectedPlanForPayment) {
    message.textContent = "Please select a plan first.";
    return;
  }
  message.textContent = "Processing dummy payment…";
  try {
    await api("/api/plans/purchase", {
      method: "POST",
      body: JSON.stringify({ ...selectedPlanForPayment, amount: Number(document.getElementById("paymentAmountInput").value) })
    });
    message.textContent = "Payment received. Credits added to your account.";
    await loadPlanSummary();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.getElementById("accountButton").addEventListener("click", (event) => {
  event.stopPropagation();
  const menu = document.getElementById("accountMenu");
  const nextHidden = !menu.hidden;
  menu.hidden = nextHidden;
  document.getElementById("accountButton").setAttribute("aria-expanded", String(!nextHidden));
});

document.querySelectorAll("[data-account-section]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById("accountMenu").hidden = true;
    document.getElementById("accountButton").setAttribute("aria-expanded", "false");
    openAccountDialog(button.dataset.accountSection);
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".account-menu-wrap")) {
    document.getElementById("accountMenu").hidden = true;
    document.getElementById("accountButton").setAttribute("aria-expanded", "false");
  }
});

document.getElementById("closeProfileButton").addEventListener("click", () => {
  document.getElementById("profileDialog").close();
});

document.getElementById("profileDialog").addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  if (!profileChangesCommitted && profilePreviewPreferences) {
    applyAppTheme(profilePreviewPreferences.theme);
    applyWorkspaceMode(profilePreviewPreferences.mode);
    applyFontTheme(profilePreviewPreferences.font);
  }
  profilePreviewPreferences = null;
  profileChangesCommitted = false;
});

["profileAppTheme", "profileModeTheme", "profileFontTheme"].forEach((id) => {
  document.getElementById(id).addEventListener("change", applyProfilePreview);
});

document.getElementById("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("profileMessage");
  try {
    if (activeAccountSection === "profile") {
      const { user } = await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify(formValues(event.currentTarget))
      });
      signedInUser = user;
      document.getElementById("userName").textContent = `Hello, ${user.name}`;
      document.getElementById("profileEmail").value = user.email;
      document.getElementById("profilePhone").value = user.phone || "";
      updateProfileVerifyNotice();
    }
    applyAppTheme(document.getElementById("profileAppTheme").value);
    applyWorkspaceMode(document.getElementById("profileModeTheme").value);
    applyFontTheme(document.getElementById("profileFontTheme").value);
    saveUserPreferences();
    message.textContent = activeAccountSection === "settings" ? "Settings updated." : "Profile updated.";
    profileChangesCommitted = true;
    document.getElementById("profileDialog").close();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth(event.currentTarget, "/api/auth/login");
});

document.getElementById("guestAuthCloseButton").addEventListener("click", closeGuestAuthOverlay);

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
  const form = event.currentTarget;
  const message = form.querySelector("[data-auth-message]");
  message.textContent = "Resetting password…";
  try {
    const result = await api("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(formValues(form))
    });
    message.textContent = result.message;
    form.reset();
    window.setTimeout(() => setAuthMode("login"), 900);
  } catch (error) {
    message.textContent = error.message;
  }
});

document.getElementById("registerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateRegisterForm(true)) return;
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
  location.replace("/login");
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

[elements.adminDashboard, elements.monitoringPage].filter(Boolean).forEach((section) => {
  new MutationObserver(enforceAdminVisibility).observe(section, {
    attributes: true,
    attributeFilter: ["hidden", "style", "class"]
  });
});

window.addEventListener("popstate", () => {
  if (document.body.classList.contains("static-view") || staticReturnState) {
    closeStaticPage({ fromHistory: true });
    return;
  }
  const route = location.pathname.split("/").filter(Boolean)[0];
  if (signedInUser || location.pathname.startsWith("/share/") || isCustomPublicPath(location.pathname) || publicStaticRoutes.includes(route)) loadRoute();
});

applyAppTheme("royal-blue");
applyWorkspaceMode("light");
applyFontTheme("default");

(async function bootstrap() {
  const bootRoute = location.pathname.replace(/^\/+/, "");
  if (
    location.pathname.startsWith("/share/") ||
    isCustomPublicPath(location.pathname) ||
    location.pathname === "/payment" ||
    location.pathname === "/payments" ||
    location.pathname === "/plans" ||
    location.pathname === "/verify-email" ||
    location.pathname === "/reset-password" ||
    publicStaticRoutes.includes(bootRoute)
  ) {
    if (
      location.pathname === "/payment" ||
      location.pathname === "/payments" ||
      location.pathname === "/plans"
    ) {
      try {
        const { user } = await api("/api/auth/me");
        signedInUser = user;

        if (signedInUser) {
          applyUserPreferences();
          elements.appHeader.hidden = false;
          document.getElementById("userName").textContent =
            `Hello, ${signedInUser.name}`;
          elements.adminButton.hidden = signedInUser.role !== "ADMIN";
          document.getElementById("accountButton").hidden = isGuestUser();
          document.getElementById("logoutButton").textContent =
            isGuestUser() ? "Exit Guest" : "Sign out";
        } else {
          elements.appHeader.hidden = true;
        }
      } catch {
        signedInUser = null;
        elements.appHeader.hidden = true;
      }
    } else if (publicStaticRoutes.includes(bootRoute)) {
      try {
        const { user } = await api("/api/auth/me");
        signedInUser = user;
        elements.appHeader.hidden = !signedInUser;
        if (signedInUser) {
          applyUserPreferences();
          document.getElementById("userName").textContent =
            `Hello, ${signedInUser.name}`;
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
