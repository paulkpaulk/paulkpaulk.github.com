(function () {
  const STORAGE_KEY = "campaignBrainV2";
  const PAGE_SIZE = 20;
  const categories = [
    "Weather",
    "Location",
    "Campaign Points / Quests",
    "Travel Events",
    "City Encounters",
    "Dungeon Complications",
    "Loot Quirks"
  ];

  const toneSelect = document.getElementById("tone-select");
  const toneFreeText = document.getElementById("tone-free-text");
  const tableCategory = document.getElementById("table-category");
  const rollResult = document.getElementById("roll-result");
  const entryEditor = document.getElementById("entry-editor");
  const entryRange = document.getElementById("entry-range");
  const saveStatus = document.getElementById("save-status");

  let page = 0;

  function escapeHTML(input) {
    return String(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function selectedTones() {
    return Array.from(toneSelect.selectedOptions).map(function (o) { return o.value; });
  }

  function buildDefaults(category) {
    const tones = selectedTones();
    const toneText = tones.length ? " Tone: " + tones.join(", ") + "." : "";
    const freeText = toneFreeText.value.trim();
    const noteText = freeText ? " Note: " + freeText + "." : "";

    const prompts = {
      "Weather": ["sky shifts", "wind carries", "rain reveals", "mist hides", "air pressure changes"],
      "Location": ["ancient marker", "strange shrine", "local custom", "hidden path", "ruined memory"],
      "Campaign Points / Quests": ["urgent plea", "moral dilemma", "faction move", "old debt", "prophetic clue"],
      "Travel Events": ["roadside encounter", "supply complication", "campfire discovery", "animal omen", "guide warning"],
      "City Encounters": ["market incident", "guard intervention", "festival rumor", "alley secret", "guild conflict"],
      "Dungeon Complications": ["trap evolution", "echoing whisper", "resource pressure", "map contradiction", "creature adaptation"],
      "Loot Quirks": ["emotional resonance", "minor curse", "historical signature", "unusual material", "social consequence"]
    };

    const seeds = prompts[category] || ["event", "choice", "twist"];
    return Array.from({ length: 100 }, function (_, i) {
      const n = i + 1;
      const seed = seeds[i % seeds.length];
      return category + " " + n + ": " + seed + " that drives a player-facing choice." + toneText + noteText;
    });
  }

  function emptyNotes() {
    return {
      rules: "",
      session: "",
      arcs: "",
      world: "",
      villains: "",
      pcs: ""
    };
  }

  function initialState() {
    const tables = {};
    categories.forEach(function (cat) {
      tables[cat] = buildDefaults(cat);
    });
    return { tables: tables, wiki: [], notes: emptyNotes() };
  }

  function normalizeState(raw) {
    const baseline = initialState();
    const next = {
      tables: {},
      wiki: Array.isArray(raw && raw.wiki) ? raw.wiki : [],
      notes: Object.assign(emptyNotes(), raw && raw.notes ? raw.notes : {})
    };

    categories.forEach(function (cat) {
      const arr = raw && raw.tables ? raw.tables[cat] : null;
      next.tables[cat] = Array.isArray(arr) && arr.length === 100 ? arr : baseline.tables[cat];
    });

    next.wiki = next.wiki
      .filter(function (item) {
        return item && typeof item.name === "string" && typeof item.content === "string";
      })
      .map(function (item, index) {
        return {
          id: item.id || ("imported-" + index + "-" + Date.now()),
          type: item.type || "Custom",
          name: item.name,
          tags: item.tags || "",
          content: item.content,
          createdAt: Number(item.createdAt) || Date.now()
        };
      });

    return next;
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return normalizeState(parsed || {});
    } catch (_e) {
      return initialState();
    }
  }

  let state = loadState();

  function saveState(message) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.textContent = message || "Saved";
    window.setTimeout(function () {
      saveStatus.textContent = "";
    }, 1200);
  }

  function populateCategories() {
    categories.forEach(function (cat) {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      tableCategory.appendChild(option);
    });
  }

  function renderEntryEditor() {
    const cat = tableCategory.value;
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, 100);
    entryRange.textContent = (start + 1) + "-" + end;
    entryEditor.innerHTML = "";

    for (let i = start; i < end; i += 1) {
      const row = document.createElement("div");
      row.className = "entry-row";

      const label = document.createElement("strong");
      label.textContent = String(i + 1);

      const text = document.createElement("textarea");
      text.value = state.tables[cat][i] || "";
      text.addEventListener("input", function () {
        state.tables[cat][i] = text.value;
        saveState("Entry updated");
      });

      row.appendChild(label);
      row.appendChild(text);
      entryEditor.appendChild(row);
    }
  }

  function rollD100() {
    const cat = tableCategory.value;
    const roll = Math.floor(Math.random() * 100) + 1;
    const result = state.tables[cat][roll - 1] || "(empty entry)";
    rollResult.innerHTML = "<strong>" + escapeHTML(cat) + " · Roll " + roll + "</strong><br>" + escapeHTML(result);
  }

  function renderWiki() {
    const query = (document.getElementById("wiki-search").value || "").toLowerCase().trim();
    const list = document.getElementById("wiki-list");
    list.innerHTML = "";

    const filtered = state.wiki.filter(function (item) {
      if (!query) return true;
      return [item.type, item.name, item.tags, item.content].join(" ").toLowerCase().includes(query);
    });

    filtered.sort(function (a, b) { return b.createdAt - a.createdAt; }).forEach(function (item) {
      const el = document.createElement("div");
      el.className = "wiki-item";

      const header = document.createElement("strong");
      header.textContent = item.name;
      el.appendChild(header);

      const meta = document.createElement("div");
      meta.className = "wiki-meta";
      meta.textContent = item.type + " · Tags: " + (item.tags || "none");
      el.appendChild(meta);

      const body = document.createElement("p");
      body.textContent = item.content;
      el.appendChild(body);

      const del = document.createElement("button");
      del.className = "btn btn-mini btn-danger";
      del.textContent = "Delete";
      del.addEventListener("click", function () {
        state.wiki = state.wiki.filter(function (x) { return x.id !== item.id; });
        saveState("Wiki entry deleted");
        renderWiki();
      });
      el.appendChild(del);
      list.appendChild(el);
    });
  }

  function rerenderFromState() {
    page = 0;
    renderEntryEditor();
    renderWiki();
    const noteMap = {
      "rules-notes": "rules",
      "session-notes": "session",
      "story-arcs": "arcs",
      "world-structure": "world",
      "villains-notes": "villains",
      "player-characters": "pcs"
    };

    Object.keys(noteMap).forEach(function (id) {
      const key = noteMap[id];
      document.getElementById(id).value = state.notes[key] || "";
    });
  }

  function wireButtons() {
    document.getElementById("roll-d100").addEventListener("click", rollD100);
    document.getElementById("reroll-d100").addEventListener("click", rollD100);

    tableCategory.addEventListener("change", function () {
      page = 0;
      renderEntryEditor();
    });

    document.getElementById("prev-page").addEventListener("click", function () {
      page = Math.max(0, page - 1);
      renderEntryEditor();
    });

    document.getElementById("next-page").addEventListener("click", function () {
      page = Math.min(4, page + 1);
      renderEntryEditor();
    });

    document.getElementById("fill-defaults").addEventListener("click", function () {
      const cat = tableCategory.value;
      state.tables[cat] = buildDefaults(cat);
      saveState("Category defaults rebuilt");
      renderEntryEditor();
    });

    document.getElementById("add-wiki").addEventListener("click", function () {
      const type = document.getElementById("wiki-type").value;
      const name = document.getElementById("wiki-name").value.trim();
      const tags = document.getElementById("wiki-tags").value.trim();
      const content = document.getElementById("wiki-content").value.trim();
      if (!name || !content) return;

      state.wiki.push({
        id: Date.now() + "-" + Math.random(),
        type: type,
        name: name,
        tags: tags,
        content: content,
        createdAt: Date.now()
      });

      document.getElementById("wiki-name").value = "";
      document.getElementById("wiki-tags").value = "";
      document.getElementById("wiki-content").value = "";
      saveState("Wiki entry saved");
      renderWiki();
    });

    document.getElementById("wiki-search").addEventListener("input", renderWiki);

    const noteMap = {
      "rules-notes": "rules",
      "session-notes": "session",
      "story-arcs": "arcs",
      "world-structure": "world",
      "villains-notes": "villains",
      "player-characters": "pcs"
    };

    Object.keys(noteMap).forEach(function (id) {
      const key = noteMap[id];
      const el = document.getElementById(id);
      el.addEventListener("input", function () {
        state.notes[key] = el.value;
        saveState("Notes saved");
      });
    });

    document.getElementById("export-data").addEventListener("click", function () {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "campaign-brain-data.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    document.getElementById("import-data").addEventListener("change", function (evt) {
      const file = evt.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const imported = JSON.parse(String(reader.result));
          state = normalizeState(imported);
          saveState("Data imported");
          rerenderFromState();
          rollResult.textContent = "Imported data loaded.";
        } catch (_e) {
          window.alert("Invalid JSON file.");
        }
      };
      reader.readAsText(file);
      evt.target.value = "";
    });

    document.getElementById("reset-data").addEventListener("click", function () {
      if (!window.confirm("Reset all campaign brain data?")) return;
      state = initialState();
      saveState("All data reset");
      rerenderFromState();
      rollResult.textContent = "Roll to get an entry.";
    });
  }

  populateCategories();
  tableCategory.value = categories[0];
  wireButtons();
  rerenderFromState();
})();
