
(() => {
  "use strict";

  const STORAGE_KEY = "rivaly.rooms.v3";
  const JOINED_KEY = "rivaly.joined.v2";

  const seedRooms = [
    {
      id: "rv-1001",
      game: "valorant",
      playerName: "Mert#TR1",
      details: "Gold 2 · Duelist · Competitive için takım aranıyor",
      current: 2,
      max: 5,
      region: "TR",
      mic: "required",
      createdAt: Date.now() - 1000 * 60 * 4
    },
    {
      id: "rv-1002",
      game: "efootball",
      playerName: "Fury1905",
      details: "Oda ID: 72819 · 1v1 VS rakibi aranıyor",
      current: 1,
      max: 2,
      region: "TR",
      mic: "optional",
      createdAt: Date.now() - 1000 * 60 * 8
    },
    {
      id: "rv-1003",
      game: "valorant",
      playerName: "Lynx#EU",
      details: "Ascendant 1 · Controller · Duo/Trio",
      current: 3,
      max: 5,
      region: "EU",
      mic: "required",
      createdAt: Date.now() - 1000 * 60 * 12
    },
    {
      id: "rv-1004",
      game: "efootball",
      playerName: "1907Legend",
      details: "Division 2 · Dostluk maçı · Oda ID: 55102",
      current: 2,
      max: 2,
      region: "TR",
      mic: "optional",
      createdAt: Date.now() - 1000 * 60 * 18
    }
  ];

  const state = {
    rooms: loadRooms(),
    joined: new Set(loadJson(JOINED_KEY, [])),
    filter: "all",
    availability: "all",
    search: "",
    createGame: "valorant"
  };

  const el = {
    roomGrid: document.getElementById("roomGrid"),
    emptyState: document.getElementById("emptyState"),
    roomSearch: document.getElementById("roomSearch"),
    availabilityFilter: document.getElementById("availabilityFilter"),
    gameTabs: document.getElementById("gameTabs"),
    createModal: document.getElementById("createModal"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    roomForm: document.getElementById("roomForm"),
    playerName: document.getElementById("playerName"),
    maxPlayers: document.getElementById("maxPlayers"),
    roomDetails: document.getElementById("roomDetails"),
    region: document.getElementById("region"),
    mic: document.getElementById("mic"),
    aiDetectBox: document.getElementById("aiDetectBox"),
    profileDrawer: document.getElementById("profileDrawer"),
    toastRoot: document.getElementById("toastRoot"),
    valorantCount: document.getElementById("valorantCount"),
    efootballCount: document.getElementById("efootballCount"),
    statActiveRooms: document.getElementById("statActiveRooms"),
    statPlayers: document.getElementById("statPlayers"),
    activeNowCount: document.getElementById("activeNowCount")
  };

  init();

  function init() {
    bindStaticEvents();
    render();
    simulateOnlineCount();
  }

  function bindStaticEvents() {
    ["createRoomTopBtn","heroCreateBtn","createRoomInlineBtn","emptyCreateBtn","ctaCreateBtn"]
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .forEach(btn => btn.addEventListener("click", () => openCreateModal()));

    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", closeCreateModal);
    });

    el.modalBackdrop.addEventListener("click", closeAllOverlays);

    document.querySelectorAll("[data-scroll]").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = document.querySelector(btn.dataset.scroll);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    document.querySelectorAll("[data-game-filter]").forEach(card => {
      card.addEventListener("click", () => {
        state.filter = card.dataset.gameFilter;
        syncTabs();
        document.getElementById("discover").scrollIntoView({ behavior: "smooth" });
        renderRooms();
      });
    });

    el.gameTabs.addEventListener("click", e => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      state.filter = btn.dataset.filter;
      syncTabs();
      renderRooms();
    });

    el.roomSearch.addEventListener("input", () => {
      state.search = el.roomSearch.value.trim().toLowerCase();
      renderRooms();
    });

    el.availabilityFilter.addEventListener("change", () => {
      state.availability = el.availabilityFilter.value;
      renderRooms();
    });

    document.querySelectorAll(".game-switch__item").forEach(btn => {
      btn.addEventListener("click", () => {
        state.createGame = btn.dataset.game;
        syncCreateGameSwitch();
        updateAiBox();
      });
    });

    el.roomDetails.addEventListener("input", updateAiBox);

    el.roomForm.addEventListener("submit", handleCreateRoom);

    el.roomGrid.addEventListener("click", e => {
      const join = e.target.closest("[data-join]");
      const leave = e.target.closest("[data-leave]");
      const report = e.target.closest("[data-report]");
      if (join) joinRoom(join.dataset.join);
      if (leave) leaveRoom(leave.dataset.leave);
      if (report) reportRoom(report.dataset.report);
    });

    document.getElementById("profileBtn").addEventListener("click", toggleProfile);
    document.getElementById("closeProfileBtn").addEventListener("click", closeProfile);

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeAllOverlays();
    });
  }

  function loadRooms() {
    const saved = loadJson(STORAGE_KEY, null);
    if (!Array.isArray(saved) || !saved.length) return structuredCloneSafe(seedRooms);
    return saved.map(normalizeRoom).filter(Boolean);
  }

  function normalizeRoom(room) {
    if (!room || typeof room !== "object") return null;
    const max = clamp(Number(room.max) || 5, 2, 10);
    const current = clamp(Number(room.current) || 1, 1, max);
    return {
      id: String(room.id || cryptoSafeId()),
      game: room.game === "efootball" ? "efootball" : "valorant",
      playerName: sanitizeText(room.playerName || "Oyuncu", 40),
      details: sanitizeText(room.details || "Oda açıklaması", 240),
      current,
      max,
      region: sanitizeText(room.region || "TR", 12),
      mic: ["required","optional","no"].includes(room.mic) ? room.mic : "optional",
      createdAt: Number(room.createdAt) || Date.now()
    };
  }

  function saveRooms() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rooms));
      localStorage.setItem(JOINED_KEY, JSON.stringify([...state.joined]));
    } catch (_) {}
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function render() {
    renderRooms();
    renderStats();
    syncTabs();
    syncCreateGameSwitch();
  }

  function renderStats() {
    const valorant = state.rooms.filter(r => r.game === "valorant").length;
    const efootball = state.rooms.filter(r => r.game === "efootball").length;
    const players = state.rooms.reduce((sum, room) => sum + room.current, 0);

    el.valorantCount.textContent = valorant;
    el.efootballCount.textContent = efootball;
    el.statActiveRooms.textContent = state.rooms.length;
    el.statPlayers.textContent = Math.max(128, players + 110);
  }

  function filteredRooms() {
    return state.rooms
      .filter(room => state.filter === "all" || room.game === state.filter)
      .filter(room => {
        if (state.availability === "open") return room.current < room.max;
        if (state.availability === "full") return room.current >= room.max;
        return true;
      })
      .filter(room => {
        if (!state.search) return true;
        const haystack = `${room.playerName} ${room.details} ${room.region} ${room.game}`.toLowerCase();
        return haystack.includes(state.search);
      })
      .sort((a,b) => b.createdAt - a.createdAt);
  }

  function renderRooms() {
    const rooms = filteredRooms();
    el.roomGrid.innerHTML = "";
    el.emptyState.classList.toggle("hidden", rooms.length !== 0);

    rooms.forEach(room => {
      const full = room.current >= room.max;
      const joined = state.joined.has(room.id);
      const card = document.createElement("article");
      card.className = `room-card${full ? " is-full" : ""}`;
      card.style.setProperty("--game-color", room.game === "valorant" ? "var(--valorant)" : "var(--efootball)");

      const title = escapeHtml(room.playerName);
      const details = escapeHtml(room.details);
      const region = escapeHtml(room.region);
      const gameLabel = room.game === "valorant" ? "Valorant" : "eFootball";
      const micLabel = room.mic === "required" ? "🎙 Mikrofon gerekli" : room.mic === "no" ? "🔇 Mikrofonsuz" : "🎙 Mikrofon fark etmez";
      const age = timeAgo(room.createdAt);
      const pct = Math.round((room.current / room.max) * 100);

      card.innerHTML = `
        <div class="room-card__top">
          <div>
            <div class="room-game">${gameLabel}</div>
            <h3 class="room-card__title">${title}</h3>
            <p class="room-card__desc">${details}</p>
          </div>
          <div class="room-count">
            <strong>${room.current}/${room.max}</strong>
            <span>${full ? "ODA DOLU" : "oyuncu"}</span>
          </div>
        </div>

        <div class="room-meta">
          <span class="meta-chip">🌍 ${region}</span>
          <span class="meta-chip">${micLabel}</span>
          <span class="meta-chip">⏱ ${age}</span>
          <span class="meta-chip">🤖 Kontrol edildi</span>
        </div>

        <div class="progress" aria-label="${room.current}/${room.max} doluluk">
          <div class="progress__bar" style="width:${pct}%"></div>
        </div>

        <div class="room-card__footer">
          <button class="btn ${full && !joined ? "btn--ghost" : "btn--primary"}"
            data-join="${room.id}"
            ${full && !joined ? "disabled" : ""}>
            ${joined ? "✓ Katıldın" : full ? "Oda Dolu" : "Katıl"}
          </button>
          <button class="btn btn--ghost" data-leave="${room.id}" ${!joined ? "disabled" : ""}>Ayrıl</button>
          <button class="btn btn--ghost" data-report="${room.id}" aria-label="Odayı raporla">⋯</button>
        </div>
      `;

      el.roomGrid.appendChild(card);
    });

    renderStats();
  }

  function handleCreateRoom(e) {
    e.preventDefault();

    const name = sanitizeText(el.playerName.value, 40);
    const details = sanitizeText(el.roomDetails.value, 240);
    const max = clamp(Number(el.maxPlayers.value) || 5, 2, 10);
    const region = sanitizeText(el.region.value, 12);
    const mic = el.mic.value;

    if (name.length < 2) {
      toast("Oyun adını biraz daha uzun yaz.", "warning");
      el.playerName.focus();
      return;
    }

    if (details.length < 4) {
      toast("Oda bilgisine biraz daha detay ekle.", "warning");
      el.roomDetails.focus();
      return;
    }

    const detected = detectGame(details, state.createGame);
    const moved = detected !== state.createGame;

    const room = {
      id: cryptoSafeId(),
      game: detected,
      playerName: name,
      details: beautifyDetails(details, detected),
      current: 1,
      max,
      region,
      mic,
      createdAt: Date.now()
    };

    state.rooms.unshift(room);
    state.joined.add(room.id);
    saveRooms();
    closeCreateModal();

    el.roomForm.reset();
    el.maxPlayers.value = "5";
    state.createGame = detected;
    syncCreateGameSwitch();
    state.filter = detected;
    syncTabs();
    render();

    document.getElementById("discover").scrollIntoView({ behavior: "smooth", block: "start" });

    if (moved) {
      toast(`AI metni ${detected === "valorant" ? "Valorant" : "eFootball"} olarak algıladı ve doğru bölüme taşıdı.`, "success");
    } else {
      toast("Odan yayınlandı.", "success");
    }
  }

  function detectGame(text, selected) {
    const t = text.toLocaleLowerCase("tr-TR");

    const valorantSignals = [
      "valorant","riot","duelist","sentinel","controller","initiator",
      "iron","bronze","silver","gold","platinum","plat","diamond",
      "ascendant","immortal","radiant","competitive","premier","swiftplay",
      "vandal","phantom","rank","elo"
    ];

    const efootballSignals = [
      "pes","efootball","e-football","oda id","oda kod","vs","division",
      "dream team","myclub","1v1","2v2","friendly","dostluk maçı"
    ];

    const valScore = scoreSignals(t, valorantSignals);
    const efScore = scoreSignals(t, efootballSignals);

    if (valScore === efScore) return selected;
    return valScore > efScore ? "valorant" : "efootball";
  }

  function scoreSignals(text, signals) {
    return signals.reduce((score, signal) => {
      if (!text.includes(signal)) return score;
      return score + (signal.length > 7 ? 2 : 1);
    }, 0);
  }

  function beautifyDetails(text, game) {
    let cleaned = text.replace(/\s+/g, " ").trim();
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (!/[.!?]$/.test(cleaned)) cleaned += ".";
    if (game === "valorant") return cleaned;
    return cleaned.replace(/\bpes\b/ig, "eFootball");
  }

  function updateAiBox() {
    const text = el.roomDetails.value.trim();
    if (text.length < 3) {
      el.aiDetectBox.innerHTML = `
        <div class="ai-box__icon">AI</div>
        <div>
          <strong>Akıllı kategori</strong>
          <span>Metnini kontrol edip doğru oyuna yönlendireceğiz.</span>
        </div>`;
      return;
    }

    const detected = detectGame(text, state.createGame);
    const changed = detected !== state.createGame;
    el.aiDetectBox.innerHTML = `
      <div class="ai-box__icon">AI</div>
      <div>
        <strong>${changed ? "Kategori düzeltmesi bulundu" : "Kategori doğru görünüyor"}</strong>
        <span>${changed
          ? `Bu metin ${detected === "valorant" ? "Valorant" : "eFootball"} gibi görünüyor. Yayınlanırken otomatik taşınacak.`
          : `${detected === "valorant" ? "Valorant" : "eFootball"} kategorisinde yayınlanacak.`}</span>
      </div>`;
  }

  function joinRoom(id) {
    const room = state.rooms.find(r => r.id === id);
    if (!room) return;

    if (state.joined.has(id)) {
      toast("Bu odaya zaten katıldın.", "warning");
      return;
    }

    if (room.current >= room.max) {
      toast("Bu oda dolu.", "warning");
      return;
    }

    room.current += 1;
    state.joined.add(id);
    saveRooms();
    renderRooms();

    if (room.current >= room.max) {
      toast("Oda doldu! Takım tamamlandı.", "success");
    } else {
      toast(`Katıldın: ${room.current}/${room.max}`, "success");
    }
  }

  function leaveRoom(id) {
    const room = state.rooms.find(r => r.id === id);
    if (!room || !state.joined.has(id)) return;

    if (room.current > 1) room.current -= 1;
    state.joined.delete(id);
    saveRooms();
    renderRooms();
    toast("Odadan ayrıldın.");
  }

  function reportRoom(id) {
    const room = state.rooms.find(r => r.id === id);
    if (!room) return;
    toast(`${room.playerName} odası rapor menüsü sonraki backend aşamasında bağlanacak.`, "warning");
  }

  function openCreateModal(game) {
    if (game === "valorant" || game === "efootball") state.createGame = game;
    syncCreateGameSwitch();
    updateAiBox();
    el.createModal.classList.remove("hidden");
    el.modalBackdrop.classList.remove("hidden");
    el.createModal.setAttribute("aria-hidden","false");
    el.modalBackdrop.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
    setTimeout(() => el.playerName.focus(), 30);
  }

  function closeCreateModal() {
    el.createModal.classList.add("hidden");
    el.modalBackdrop.classList.add("hidden");
    el.createModal.setAttribute("aria-hidden","true");
    el.modalBackdrop.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
  }

  function toggleProfile() {
    const hidden = el.profileDrawer.classList.contains("hidden");
    if (hidden) openProfile();
    else closeProfile();
  }

  function openProfile() {
    el.profileDrawer.classList.remove("hidden");
    el.profileDrawer.setAttribute("aria-hidden","false");
  }

  function closeProfile() {
    el.profileDrawer.classList.add("hidden");
    el.profileDrawer.setAttribute("aria-hidden","true");
  }

  function closeAllOverlays() {
    closeCreateModal();
    closeProfile();
  }

  function syncTabs() {
    document.querySelectorAll("[data-filter]").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.filter === state.filter);
    });
  }

  function syncCreateGameSwitch() {
    document.querySelectorAll(".game-switch__item").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.game === state.createGame);
    });
  }

  function toast(message, type = "default") {
    const node = document.createElement("div");
    node.className = `toast ${type !== "default" ? `toast--${type}` : ""}`;
    node.textContent = message;
    el.toastRoot.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function simulateOnlineCount() {
    let count = 128;
    setInterval(() => {
      const delta = Math.random() > .5 ? 1 : -1;
      count = clamp(count + delta, 118, 148);
      el.activeNowCount.textContent = count;
    }, 5000);
  }

  function timeAgo(timestamp) {
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return "az önce";
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} dk`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} sa`;
    const days = Math.floor(hours / 24);
    return `${days} gün`;
  }

  function sanitizeText(value, maxLength) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cryptoSafeId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `rv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
})();
