const MAX_PHOTOS = 10;

export function cleanPhotoLink(value) {
  const text = String(value || "").trim().replace(/\\([&_=])/g, "$1");
  return text.match(/\((https?:\/\/[^)]+)\)/)?.[1] || text.replace(/^<|>$/g, "");
}

export function parsePhotoLinks(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .split(/[\n,]+/)
    .map(cleanPhotoLink)
    .filter(Boolean)
    .slice(0, MAX_PHOTOS);
}

export function photoImageCandidates(value) {
  const original = cleanPhotoLink(value);
  if (!original) return [];
  let url;
  try { url = new URL(original); } catch { return [original]; }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!/(^|\.)drive\.google\.com$|(^|\.)googleusercontent\.com$/.test(host)) return [original];

  const id = url.searchParams.get("id") ||
    url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ||
    url.pathname.match(/\/d\/([^/]+)/)?.[1];
  if (!id) return [original];

  const resourceKey = url.searchParams.get("resourcekey");
  const query = new URLSearchParams({ id });
  if (resourceKey) query.set("resourcekey", resourceKey);
  const queryText = query.toString();
  const encodedId = encodeURIComponent(id);
  const resourceQuery = resourceKey ? `?resourcekey=${encodeURIComponent(resourceKey)}` : "";
  return [...new Set([
    `https://drive.google.com/thumbnail?${queryText}&sz=w2000`,
    `https://drive.google.com/thumbnail?${queryText}&sz=w1000`,
    `https://lh3.googleusercontent.com/d/${encodedId}${resourceQuery}`,
    `https://drive.google.com/uc?export=view&${queryText}`,
    `https://drive.google.com/uc?export=download&${queryText}`,
    `https://drive.google.com/uc?${queryText}&export=view`,
    original
  ])];
}

export function applyPhotoImageFallbacks(img, link) {
  const candidates = photoImageCandidates(link);
  let nextIndex = 0;
  img.onerror = () => {
    if (nextIndex < candidates.length) img.src = candidates[nextIndex++];
    else {
      img.onerror = null;
      img.dataset.loadFailed = "true";
      img.dispatchEvent(new Event("photo-link-error"));
    }
  };
  img.dataset.loadFailed = "false";
  if (candidates.length) img.src = candidates[nextIndex++];
}

function makeButton(className, label, text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.textContent = text;
  return button;
}

export function initPhotoLinkEditor(form, value = "") {
  const editor = form?.querySelector("[data-photo-link-editor]");
  if (!editor || editor.dataset.ready) return;
  editor.dataset.ready = "true";
  const hidden = editor.querySelector('[name="photoLinks"]');
  const rows = editor.querySelector("[data-photo-link-rows]");
  const addButton = editor.querySelector("[data-add-photo-link]");

  const sync = () => {
    hidden.value = [...rows.querySelectorAll("[data-photo-link]")]
      .map((input) => input.value.trim()).filter(Boolean).slice(0, MAX_PHOTOS).join("\n");
    addButton.hidden = rows.children.length >= MAX_PHOTOS;
  };

  const appendRow = (link = "") => {
    if (rows.children.length >= MAX_PHOTOS) return;
    const row = document.createElement("div");
    row.className = "photo-link-row";
    const label = document.createElement("span");
    label.className = "photo-link-label";
    label.textContent = `Image Link ${rows.children.length + 1}`;
    const input = document.createElement("input");
    input.type = "url";
    input.inputMode = "url";
    input.placeholder = "Paste a public Google Drive image link";
    input.setAttribute("aria-label", `Image Link ${rows.children.length + 1}`);
    input.dataset.photoLink = "";
    input.value = link;
    const controls = document.createElement("div");
    controls.className = "photo-link-controls";
    const previewButton = makeButton("photo-preview-button", "Preview image", "◉ Preview");
    const removeButton = makeButton("photo-remove-button", "Remove image link", "Remove");
    const preview = document.createElement("div");
    preview.className = "photo-link-preview";
    preview.hidden = true;
    const image = document.createElement("img");
    image.alt = "Preview of the linked photo";
    image.hidden = true;
    const error = document.createElement("span");
    error.className = "photo-preview-error";
    error.textContent = "Image could not load. Check that Drive sharing is set to anyone with the link.";
    error.hidden = true;
    preview.append(image, error);
    previewButton.addEventListener("click", () => {
      const linkValue = input.value.trim();
      preview.hidden = !preview.hidden;
      if (preview.hidden) return;
      image.hidden = true;
      error.hidden = true;
      if (!linkValue) {
        error.textContent = "Add an image link to preview it.";
        error.hidden = false;
        return;
      }
      applyPhotoImageFallbacks(image, linkValue);
    });
    image.addEventListener("load", () => { image.hidden = false; error.hidden = true; });
    image.addEventListener("photo-link-error", () => { image.hidden = true; error.hidden = false; });
    input.addEventListener("input", () => {
      sync();
      preview.hidden = true;
      image.removeAttribute("src");
    });
    removeButton.addEventListener("click", () => {
      if (rows.children.length === 1) input.value = "";
      else row.remove();
      sync();
      [...rows.querySelectorAll(".photo-link-row")].forEach((photoRow, index) => {
        photoRow.querySelector(".photo-link-label").textContent = `Image Link ${index + 1}`;
        photoRow.querySelector("[data-photo-link]").setAttribute("aria-label", `Image Link ${index + 1}`);
      });
    });
    controls.append(previewButton, removeButton);
    row.append(label, input, controls, preview);
    rows.append(row);
  };

  addButton.addEventListener("click", () => {
    appendRow();
    sync();
    rows.lastElementChild?.querySelector("input")?.focus();
  });
  editor.setPhotoLinks = (links) => {
    rows.replaceChildren();
    const linksToShow = parsePhotoLinks(links);
    (linksToShow.length ? linksToShow : [""]).forEach(appendRow);
    sync();
  };
  editor.setPhotoLinks(value);
}

export function setPhotoLinkEditorValue(form, value) {
  const editor = form?.querySelector("[data-photo-link-editor]");
  if (editor?.setPhotoLinks) editor.setPhotoLinks(value);
  else {
    const hidden = editor?.querySelector('[name="photoLinks"]');
    if (hidden) hidden.value = parsePhotoLinks(value).join("\n");
  }
}
