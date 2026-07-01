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

  return `<input type="${field.type || "text"}" value="${value}" ${attributes}>`;
}

/**
 * Builds the occasion-specific form from presentation metadata. Field default
 * values are injected by app.js from the backend occasion schema before render.
 */
export function renderOccasionForm(occasion, container) {
  const themeOptions = occasion.themes
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
    </section>
    ${sections}
  `;
}
