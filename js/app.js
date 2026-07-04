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
  saveButton: document.getElementById("saveCardButton"),
  shareButton: document.getElementById("shareCardButton"),
  copyShareLinkButton: document.getElementById("copyShareLinkButton"),
  saveStatus: document.getElementById("saveStatus"),
  publicBanner: document.getElementById("publicBanner"),
  verifyEmailNotice: document.getElementById("verifyEmailNotice"),
  shareInfo: document.getElementById("shareInfo"),
  adminButton: document.getElementById("adminButton")
};

let activeOccasion = "wedding";
let currentInvitationId = null;
let currentShareUrl = null;
let currentPublicExpiresAt = null;
let signedInUser = null;
let pendingDelete = null;
let shareTimer = null;
let activeOccasionConfig = null;

const supportedOccasions = ["wedding", "birthday", "engagement", "office"];
const occasionSchemaCache = new Map();

const cardIcons = {
  birthday: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M14 54H58V64H14Z"/><path d="M20 37H52V54H20Z"/><path d="M27 23H45V37H27Z"/><path d="M36 6Q27 16 36 23Q45 16 36 6Z" fill="var(--occasion-accent)"/><path d="M20 45Q27 39 34 45T48 45T52 45"/></g></svg>`,
  engagement: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="3"><circle cx="28" cy="43" r="18"/><circle cx="44" cy="43" r="18"/><path d="M37 18L45 8L53 18L45 28Z" fill="var(--occasion-accent)"/></g></svg>`,
  office: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 63H61M18 63V21H54V63M27 29H33M40 29H46M27 39H33M40 39H46M27 49H33M40 49H46"/><path d="M29 21V11H43V21" stroke="var(--occasion-accent)"/></g></svg>`
};

const hideableSections = [
  elements.authShell,
  elements.dashboard,
  elements.adminDashboard,
  elements.paymentPage,
  elements.weddingBuilder,
  elements.occasionBuilder,
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
  hideableSections.forEach((element) => element.hidden = element !== section);
  elements.cardActions.hidden = ![elements.weddingInvitation, elements.occasionInvitation].includes(section);
  elements.publicBanner.hidden = true;
  if (elements.verifyEmailNotice) {
    elements.verifyEmailNotice.hidden = !signedInUser || signedInUser.emailVerified;
  }
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
  clearInterval(shareTimer);
}

function applyWorkspaceMode(mode) {
  document.body.dataset.mode = mode;
  localStorage.setItem("invitation_studio_mode", mode);
  document.getElementById("themeModeButton").textContent = mode === "dark" ? "Light mode" : "Dark mode";
}

function renderGenericCard(occasion, values = formValues(elements.occasionForm)) {
  const cardData = occasion.build(values, helpers);
  elements.occasionInvitation.dataset.occasion = occasion.id;
  elements.occasionInvitation.dataset.palette = values.palette || occasion.defaultTheme;
  document.getElementById("occasionMark").innerHTML = cardIcons[occasion.id] || "";
  document.getElementById("occasionCardKicker").textContent = occasion.kicker;
  document.getElementById("occasionCardTitle").textContent = cardData.title;
  document.getElementById("occasionCardSubtitle").textContent = cardData.subtitle;
  document.getElementById("occasionCardMessage").textContent = cardData.message;
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
    document.body.dataset.theme = elements.weddingForm.elements.theme.value;
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
  showOnly(elements.occasionBuilder);
}

async function renderInvitationFromData(invitation, readOnly = false) {
  activeOccasion = invitation.occasion;
  currentInvitationId = readOnly ? null : invitation.id;
  currentShareUrl = invitation.shareUrl;
  currentPublicExpiresAt = invitation.publicExpiresAt;
  elements.saveButton.textContent = currentInvitationId ? "Update Card" : "Save Card";

  if (invitation.occasion === "wedding") {
    fillForm(elements.weddingForm, invitation.fields);
    renderWedding(elements.weddingForm, helpers);
    showOnly(elements.weddingInvitation);
  } else {
    const occasion = await getHydratedOccasion(invitation.occasion);
    activeOccasionConfig = occasion;
    renderOccasionForm(occasion, elements.occasionFields);
    fillForm(elements.occasionForm, invitation.fields);
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
  return formValues(activeOccasion === "wedding" ? elements.weddingForm : elements.occasionForm);
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
      card.append(type, title, time, actions);
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

async function loadRoute() {
  const parts = location.pathname.split("/").filter(Boolean);
  const route = parts[0];

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
    showOnly(elements.paymentPage);
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
    loadSavedCards();
    return;
  }

  if (!supportedOccasions.includes(route)) {
    history.replaceState({}, "", "/");
    showOnly(elements.dashboard);
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
  elements.appHeader.hidden = true;
  elements.cardActions.hidden = true;
  elements.publicBanner.hidden = true;
  elements.verifyEmailNotice.hidden = true;
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
  elements.authShell.hidden = true;
  elements.appHeader.hidden = false;
  document.getElementById("userName").textContent = `Hello, ${signedInUser.name}`;
  elements.adminButton.hidden = signedInUser.role !== "ADMIN";
  document.getElementById("profileName").value = signedInUser.name;
  document.getElementById("profileEmail").value = signedInUser.email;
  document.getElementById("profilePhone").value = signedInUser.phone || "";
  elements.verifyEmailNotice.hidden = signedInUser.emailVerified;
  await loadRoute();
}

document.querySelectorAll("[data-select-occasion]").forEach((button) => {
  button.addEventListener("click", () => openOccasion(button.dataset.selectOccasion));
});

document.querySelectorAll("[data-back-dashboard]").forEach((button) => {
  button.addEventListener("click", () => {
    resetCurrentCard();
    history.pushState({}, "", "/");
    showOnly(elements.dashboard);
    loadSavedCards();
  });
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

elements.weddingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.weddingForm.reportValidity()) return;
  activeOccasion = "wedding";
  renderWedding(elements.weddingForm, helpers);
  elements.saveStatus.textContent = currentInvitationId ? "Changes are ready to save." : "Card created. Save it to your account.";
  showOnly(elements.weddingInvitation);
});

elements.occasionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.occasionForm.reportValidity()) return;
  renderGenericCard(activeOccasionConfig || getOccasion(activeOccasion));
  elements.saveStatus.textContent = currentInvitationId ? "Changes are ready to save." : "Card created. Save it to your account.";
  showOnly(elements.occasionInvitation);
});

elements.saveButton.addEventListener("click", async () => {
  elements.saveButton.disabled = true;
  elements.saveStatus.textContent = "Saving…";
  try {
    const invitation = await saveCurrentCard();
    elements.saveStatus.textContent = "Saved in your account.";
    currentShareUrl = invitation.shareUrl;
    currentPublicExpiresAt = invitation.publicExpiresAt;
    updateShareDisplay();
  } catch (error) {
    elements.saveStatus.textContent = error.message;
  } finally {
    elements.saveButton.disabled = false;
  }
});

elements.shareButton.addEventListener("click", async () => {
  elements.saveStatus.textContent = "";
  try {
    if (!currentInvitationId) {
      elements.saveStatus.textContent = "Save the card before generating a public link.";
      return;
    }
    const invitation = await api(`/api/invitations/${activeOccasion}/${currentInvitationId}/share`, { method: "POST" });
    currentShareUrl = invitation.shareUrl;
    currentPublicExpiresAt = invitation.publicExpiresAt;
    updateShareDisplay();
  } catch (error) {
    if (error.status === 402 && error.data?.paymentUrl) {
      history.pushState({}, "", error.data.paymentUrl);
      showOnly(elements.paymentPage);
      return;
    }
    elements.saveStatus.textContent = error.message;
  }
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
  resetCurrentCard();
  history.pushState({}, "", "/");
  showOnly(elements.dashboard);
  loadSavedCards();
});

document.getElementById("homeButton").addEventListener("click", () => {
  resetCurrentCard();
  history.pushState({}, "", "/");
  showOnly(elements.dashboard);
  loadSavedCards();
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

document.getElementById("themeModeButton").addEventListener("click", () => {
  applyWorkspaceMode(document.body.dataset.mode === "dark" ? "light" : "dark");
});

document.getElementById("profileButton").addEventListener("click", () => {
  document.getElementById("profileMessage").textContent = "";
  document.getElementById("profileName").value = signedInUser.name;
  document.getElementById("profileEmail").value = signedInUser.email;
  document.getElementById("profilePhone").value = signedInUser.phone || "";
  document.getElementById("profileDialog").showModal();
});

document.getElementById("closeProfileButton").addEventListener("click", () => {
  document.getElementById("profileDialog").close();
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
    document.getElementById("userName").textContent = `Hello, ${user.name}`;
    document.getElementById("profileEmail").value = user.email;
    document.getElementById("profilePhone").value = user.phone || "";
    message.textContent = "Profile updated.";
  } catch (error) {
    message.textContent = error.message;
  }
});

document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth(event.currentTarget, "/api/auth/login");
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

document.getElementById("logoutButton").addEventListener("click", async () => {
  if (!window.confirm("Are you sure you want to sign out?")) return;
  await api("/api/auth/logout", { method: "POST" });
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
  if (signedInUser || location.pathname.startsWith("/share/")) loadRoute();
});

applyWorkspaceMode(localStorage.getItem("invitation_studio_mode") || "light");

(async function bootstrap() {
  if (
    location.pathname.startsWith("/share/") ||
    location.pathname === "/payment" ||
    location.pathname === "/verify-email" ||
    location.pathname === "/reset-password"
  ) {
    elements.appHeader.hidden = true;
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
