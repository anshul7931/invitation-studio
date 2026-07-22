function fieldControl(field) {
  const id = `occasion-${field.name}`;
  const value = field.value || "";
  const attributes = [
    `id="${id}"`,
    `name="${field.name}"`,
    field.required ? "required" : ""
  ].filter(Boolean).join(" ");

  if (field.type === "textarea") {
    return `<textarea ${attributes}>${value}</textarea>`;
  }

  if (field.type === "select") {
    const options = (field.options || [])
      .map(([optionValue, label]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${label}</option>`)
      .join("");
    return `<select ${attributes}>${options}</select>`;
  }

  return `<input type="${field.type || "text"}" value="${value}" ${attributes}>`;
}

export function renderOccasionForm(occasion, container) {
  const themeOptions = occasion.themes
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  const iconOptions = (occasion.icons || [])
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");

  const sections = occasion.sections.map((section, index) => {
    const fields = section.fields.map((field) => `
      <div class="field ${field.wide ? "full" : ""}">
        <label for="occasion-${field.name}">
          ${field.label}
          ${field.optional ? '<span class="optional-label">Optional</span>' : ""}
        </label>
        ${fieldControl(field)}
      </div>
    `).join("");

    return `
      <section class="form-chapter">
        <div class="chapter-heading">
          <span class="chapter-number">${String(index + 1).padStart(2, "0")}</span>
          <div>
            <h2>${section.title}</h2>
            <p>${section.hint}</p>
          </div>
        </div>
        <div class="form-grid">${fields}</div>
      </section>
    `;
  }).join("");

  container.innerHTML = `
    <input type="hidden" name="templateType" value="basic">
    <section class="form-chapter theme-chapter">
      <div class="chapter-heading">
        <span class="chapter-number">✦</span>
        <div>
          <h2>Choose the mood</h2>
          <p>The palette adjusts the card's colour story and accents.</p>
        </div>
      </div>
      <div class="field full theme-field">
        <label for="occasion-palette">Colour theme</label>
        <select id="occasion-palette" name="palette">${themeOptions}</select>
      </div>
      ${iconOptions ? `
      <div class="field full theme-field">
        <label for="occasion-cardIcon">Card motif</label>
        <select id="occasion-cardIcon" name="cardIcon">${iconOptions}</select>
      </div>` : ""}
    </section>
    ${sections}
    <section class="form-chapter premium-options">
      <label class="switch-row">
        <input type="checkbox" data-premium-toggle>
        <span>Go Premium</span>
      </label>
      <div class="premium-fields" hidden>
        <div class="field full">
          <label for="occasion-photoLinks">Google Drive photo links <span class="optional-label">Premium · up to 10</span></label>
          <textarea id="occasion-photoLinks" name="photoLinks" placeholder="Paste one public Google Drive image link per line, up to 10"></textarea>
        </div>
      </div>
    </section>
  `;
}
