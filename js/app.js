import { getOccasion } from "./occasions/registry.js";
import { renderWedding } from "./occasions/wedding.js";
import { renderOccasionForm } from "./ui/form-renderer.js";

const elements = {
  authShell: document.getElementById("authShell"),
  appHeader: document.getElementById("appHeader"),
  dashboard: document.getElementById("dashboard"),
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
  saveButton: document.getElementById("saveCardButton"),
  saveStatus: document.getElementById("saveStatus")
};

let activeOccasion = "wedding";
let currentInvitationId = null;
let signedInUser = null;

const cardIcons = {
  birthday: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><path d="M14 54H58V64H14Z"/><path d="M20 37H52V54H20Z"/><path d="M27 23H45V37H27Z"/><path d="M36 6Q27 16 36 23Q45 16 36 6Z" fill="var(--occasion-accent)"/><path d="M20 45Q27 39 34 45T48 45T52 45"/></g></svg>`,
  engagement: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="3"><circle cx="28" cy="43" r="18"/><circle cx="44" cy="43" r="18"/><path d="M37 18L45 8L53 18L45 28Z" fill="var(--occasion-accent)"/></g></svg>`,
  office: `<svg viewBox="0 0 72 72"><g fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 63H61M18 63V21H54V63M27 29H33M40 29H46M27 39H33M40 39H46M27 49H33M40 49H46"/><path d="M29 21V11H43V21" stroke="var(--occasion-accent)"/></g></svg>`
};

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
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric", month: "long", year: "numeric"
    }).format(localDate(value));
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

function showOnly(section) {
  [
    elements.dashboard,
    elements.weddingBuilder,
    elements.occasionBuilder,
    elements.weddingInvitation,
    elements.occasionInvitation
  ].forEach((element) => element.hidden = element !== section);
  elements.cardActions.hidden = ![
    elements.weddingInvitation,
    elements.occasionInvitation
  ].includes(section);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "Request failed.");
  return data;
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function addDetail(label, value) {
  if (!value) return;
  const item = document.createElement("div");
  item.className = "occasion-detail";
  const caption = document.createElement("span");
  const content = document.createElement("strong");
  caption.textContent = label;
  content.textContent = value;
  item.append(caption, content);
  document.getElementById("occasionDetails").append(item);
}

function renderGenericCard(occasion) {
  const values = formValues(elements.occasionForm);
  const cardData = occasion.build(values, helpers);
  elements.occasionInvitation.dataset.occasion = occasion.id;
  elements.occasionInvitation.dataset.palette = values.palette || occasion.defaultTheme;
  document.getElementById("occasionMark").innerHTML = cardIcons[occasion.id];
  document.getElementById("occasionCardKicker").textContent = occasion.kicker;
  document.getElementById("occasionCardTitle").textContent = cardData.title;
  document.getElementById("occasionCardSubtitle").textContent = cardData.subtitle;
  document.getElementById("occasionCardMessage").textContent = cardData.message;
  document.getElementById("occasionCardRsvp").textContent =
    cardData.rsvp ? `RSVP · ${cardData.rsvp}` : "";

  const details = document.getElementById("occasionDetails");
  details.replaceChildren();
  cardData.details.forEach(([label, value]) => addDetail(label, value));
  document.title = cardData.documentTitle;
}

function fillForm(form, values) {
  Object.entries(values).forEach(([name, value]) => {
    if (form.elements[name]) form.elements[name].value = value;
  });
}

function openOccasion(occasionId, updateUrl = true) {
  activeOccasion = occasionId;
  currentInvitationId = null;
  elements.saveButton.textContent = "Save Card";
  elements.saveStatus.textContent = "";
  if (updateUrl) history.pushState({}, "", `/${occasionId}`);

  if (occasionId === "wedding") {
    document.body.dataset.theme = elements.weddingForm.elements.theme.value;
    showOnly(elements.weddingBuilder);
    return;
  }

  const occasion = getOccasion(occasionId);
  document.getElementById("occasionFormTitle").textContent = occasion.formTitle;
  document.getElementById("occasionFormIntro").textContent = occasion.intro;
  document.getElementById("occasionFormKicker").textContent =
    `Create your ${occasion.name.toLowerCase()} card`;
  renderOccasionForm(occasion, elements.occasionFields);
  showOnly(elements.occasionBuilder);
}

document.querySelectorAll("[data-select-occasion]").forEach((button) => {
  button.addEventListener("click", () => openOccasion(button.dataset.selectOccasion));
});

document.querySelectorAll("[data-back-dashboard]").forEach((button) => {
  button.addEventListener("click", () => {
    document.body.dataset.theme = "maroon";
    document.title = "Invitation Atelier";
    currentInvitationId = null;
    history.pushState({}, "", "/");
    showOnly(elements.dashboard);
    loadSavedCards();
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
  renderGenericCard(getOccasion(activeOccasion));
  elements.saveStatus.textContent = currentInvitationId ? "Changes are ready to save." : "Card created. Save it to your account.";
  showOnly(elements.occasionInvitation);
});

document.getElementById("editButton").addEventListener("click", () => {
  showOnly(activeOccasion === "wedding" ? elements.weddingBuilder : elements.occasionBuilder);
});

document.getElementById("newCardButton").addEventListener("click", () => {
  document.body.dataset.theme = "maroon";
  document.title = "Invitation Atelier";
  currentInvitationId = null;
  history.pushState({}, "", "/");
  showOnly(elements.dashboard);
  loadSavedCards();
});

async function loadRoute() {
  const occasionId = location.pathname.split("/").filter(Boolean)[0];
  if (!occasionId) {
    showOnly(elements.dashboard);
    loadSavedCards();
    return;
  }

  const supported = ["wedding", "birthday", "engagement", "office"];
  if (!supported.includes(occasionId)) {
    history.replaceState({}, "", "/");
    showOnly(elements.dashboard);
    return;
  }

  openOccasion(occasionId, false);
  const invitationId = new URLSearchParams(location.search).get("id");
  if (!invitationId) return;

  try {
    const response = await fetch(`/api/invitations/${occasionId}/${invitationId}`);
    if (!response.ok) throw new Error("Invitation could not be loaded.");
    const invitation = await response.json();
    currentInvitationId = invitation.id;
    elements.saveButton.textContent = "Update Card";

    if (occasionId === "wedding") {
      fillForm(elements.weddingForm, invitation.fields);
      renderWedding(elements.weddingForm, helpers);
      showOnly(elements.weddingInvitation);
    } else {
      fillForm(elements.occasionForm, invitation.fields);
      renderGenericCard(getOccasion(occasionId));
      showOnly(elements.occasionInvitation);
    }
    elements.saveStatus.textContent = "Saved in your account.";
  } catch (error) {
    document.getElementById("occasionFormIntro").textContent = error.message;
  }
}

function currentFields() {
  return formValues(activeOccasion === "wedding" ? elements.weddingForm : elements.occasionForm);
}

elements.saveButton.addEventListener("click", async () => {
  elements.saveButton.disabled = true;
  elements.saveStatus.textContent = "Saving…";
  try {
    const url = currentInvitationId
      ? `/api/invitations/${activeOccasion}/${currentInvitationId}`
      : `/api/invitations/${activeOccasion}`;
    const invitation = await api(url, {
      method: currentInvitationId ? "PUT" : "POST",
      body: JSON.stringify(currentFields())
    });
    currentInvitationId = invitation.id;
    elements.saveButton.textContent = "Update Card";
    elements.saveStatus.textContent = "Saved in your account.";
    history.replaceState({}, "", invitation.url);
  } catch (error) {
    elements.saveStatus.textContent = error.message;
  } finally {
    elements.saveButton.disabled = false;
  }
});

async function loadSavedCards() {
  if (!signedInUser) return;
  try {
    const { invitations } = await api("/api/invitations");
    elements.savedCards.replaceChildren();
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
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Delete “${invitation.title}”?`)) return;
        await api(`/api/invitations/${invitation.occasion}/${invitation.id}`, { method: "DELETE" });
        loadSavedCards();
      });
      actions.append(open, remove);
      card.append(type, title, time, actions);
      elements.savedCards.append(card);
    });
  } catch (error) {
    elements.savedEmpty.hidden = false;
    elements.savedEmpty.textContent = error.message;
  }
}

function setAuthMode(mode) {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  document.getElementById("loginForm").hidden = mode !== "login";
  document.getElementById("registerForm").hidden = mode !== "register";
  document.querySelectorAll("[data-auth-message]").forEach((message) => message.textContent = "");
}

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

async function submitAuth(form, endpoint) {
  const message = form.querySelector("[data-auth-message]");
  message.textContent = "";
  try {
    const { user } = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(formValues(form))
    });
    signedInUser = user;
    await enterApplication();
  } catch (error) {
    message.textContent = error.message;
  }
}

document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth(event.currentTarget, "/api/auth/login");
});

document.getElementById("registerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth(event.currentTarget, "/api/auth/register");
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  signedInUser = null;
  currentInvitationId = null;
  elements.appHeader.hidden = true;
  [elements.dashboard, elements.weddingBuilder, elements.occasionBuilder,
    elements.weddingInvitation, elements.occasionInvitation, elements.cardActions]
    .forEach((element) => element.hidden = true);
  elements.authShell.hidden = false;
  history.replaceState({}, "", "/login");
});

async function enterApplication() {
  elements.authShell.hidden = true;
  elements.appHeader.hidden = false;
  document.getElementById("userName").textContent = `Hello, ${signedInUser.name}`;
  await loadRoute();
}

async function bootstrap() {
  try {
    const { user } = await api("/api/auth/me");
    signedInUser = user;
  } catch {
    signedInUser = null;
  }

  if (!signedInUser) {
    elements.authShell.hidden = false;
    elements.appHeader.hidden = true;
    history.replaceState({}, "", "/login");
    return;
  }
  await enterApplication();
}

window.addEventListener("popstate", () => {
  if (signedInUser) loadRoute();
});
bootstrap();
