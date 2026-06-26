# Adding an occasion

1. Copy one of the occasion modules in this folder.
2. Give it a unique `id`, dashboard name, themes, field sections, and `build()` function.
3. Export it from the new file.
4. Import and register it in `registry.js`.
5. Add one dashboard button in `index.html` with `data-select-occasion` set to the new ID.
6. Add the card icon and optional occasion-specific CSS variables in `js/app.js` and `index.html`.

The shared form renderer automatically creates the themed, sectioned form from the occasion's field schema.
