(() => {
  const form = document.querySelector("#writeups-controls");
  if (!form) return;

  const status = document.querySelector("#writeups-status");
  const entries = [...document.querySelectorAll(".writeup-entry")];
  const fields = [
    "difficulty", "os", "approach", "vulnerability", "technology"
  ];
  const normalize = value => String(value).trim().toLowerCase();

  const items = entries.map(element => {
    const data = element.dataset;

    return {
      element,
      title: data.title,
      published: Number(data.published),
      released: data.released ? Number(data.released) : -Infinity,
      difficulty: data.difficulty ? [data.difficulty] : [],
      os: data.os ? [data.os] : [],
      approach: data.approach ? [data.approach] : [],
      vulnerability: JSON.parse(data.vulnerability),
      technology: JSON.parse(data.technology)
    };
  });

  fields.forEach(field => {
    const select = form.elements.namedItem(field);
    const values = [...new Set(items.flatMap(item => item[field]))]
      .sort((a, b) => a.localeCompare(b, "en"));

    values.forEach(value => select.add(new Option(value, value)));
  });

  function readLocation() {
    const params = new URLSearchParams(location.search);
    fields.forEach(field => {
      const select = form.elements.namedItem(field);
      const requested = params.get(field) || "";
      const option = [...select.options].find(option =>
        normalize(option.value) === normalize(requested));
      select.value = option ? option.value : "";
    });
    form.elements.namedItem("query").value = params.get("q") || "";
    const sort = params.get("sort");
    form.elements.namedItem("sort").value =
      ["published", "released", "title"].includes(sort) ? sort : "published";
  }

  function update(syncUrl = true) {
    const terms = normalize(form.elements.namedItem("query").value)
      .split(/\s+/)
      .filter(Boolean);

    const sort = form.elements.namedItem("sort").value;
    if (syncUrl) {
      const url = new URL(location.href);
      fields.forEach(field => {
        const value = form.elements.namedItem(field).value;
        if (value) url.searchParams.set(field, value);
        else url.searchParams.delete(field);
      });
      const query = form.elements.namedItem("query").value.trim();
      if (query) url.searchParams.set("q", query);
      else url.searchParams.delete("q");
      if (sort !== "published") url.searchParams.set("sort", sort);
      else url.searchParams.delete("sort");
      if (url.href !== location.href) history.replaceState(null, "", url);
    }
    let visible = 0;

    const sorted = [...items].sort((a, b) => {
      if (sort === "title") {
        return a.title.localeCompare(b.title, "en");
      }

      const key = sort === "released" ? "released" : "published";
      if (a[key] === b[key]) {
        return a.title.localeCompare(b.title, "en");
      }
      return a[key] > b[key] ? -1 : 1;
    });

    sorted.forEach(item => {
      const searchable = normalize([
        item.title,
        ...fields.flatMap(field => item[field])
      ].join(" "));

      const matchesSearch = terms.every(term => searchable.includes(term));
      const matchesFilters = fields.every(field => {
        const selected = form.elements.namedItem(field).value;
        return !selected || item[field].includes(selected);
      });

      item.element.hidden = !(matchesSearch && matchesFilters);
      if (!item.element.hidden) visible++;

      item.element.parentNode.appendChild(item.element);
    });

    status.textContent = visible
      ? `${visible} of ${items.length} writeups`
      : "No writeups match your filters.";
  }

  form.addEventListener("submit", event => event.preventDefault());
  form.addEventListener("input", () => update());
  form.addEventListener("change", () => update());
  form.addEventListener("reset", () => setTimeout(update, 0));

  window.addEventListener("popstate", () => {
    readLocation();
    update(false);
  });
  readLocation();
  form.hidden = false;
  update();
})();