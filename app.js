/* ============================================================
   조직도 편집기 (Organization Chart Editor)
   Pure vanilla JS. State persists in localStorage.
   ============================================================ */

(() => {
  "use strict";

  const STORAGE_KEY = "org-chart-map:v1";
  const COLORS = ["#3b6ef6", "#e5484d", "#f5a623", "#35a563", "#8b5cf6", "#0ea5b7", "#64748b"];

  /** @typedef {{id:string,name:string,title:string,dept:string,email:string,color:string,collapsed:boolean,children:Node[]}} Node */

  /** @type {Node[]} */
  let roots = [];
  let zoom = 1;
  let editingId = null;      // id being edited, or null when adding
  let pendingParentId = null; // parent for a new node
  let selectedColor = COLORS[0];

  // ---------- DOM refs ----------
  const $ = (sel) => document.querySelector(sel);
  const chartInner = $("#chartInner");
  const emptyState = $("#emptyState");
  const statCount = $("#statCount");
  const statSaved = $("#statSaved");
  const searchInput = $("#searchInput");

  // ---------- Utilities ----------
  const uid = () =>
    "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function makeNode(partial = {}) {
    return {
      id: uid(),
      name: partial.name || "새 구성원",
      title: partial.title || "",
      dept: partial.dept || "",
      email: partial.email || "",
      color: partial.color || COLORS[0],
      collapsed: false,
      children: [],
    };
  }

  // Walk every node; cb(node, parentArray, index)
  function walk(nodes, cb, parent = null) {
    nodes.forEach((n, i) => {
      cb(n, nodes, i, parent);
      walk(n.children, cb, n);
    });
  }

  function findNode(id) {
    let found = null;
    walk(roots, (n) => { if (n.id === id) found = n; });
    return found;
  }

  // Remove node by id, return the detached node (or null)
  function detachNode(id) {
    let detached = null;
    const removeFrom = (arr) => {
      const idx = arr.findIndex((n) => n.id === id);
      if (idx !== -1) { detached = arr.splice(idx, 1)[0]; return true; }
      return arr.some((n) => removeFrom(n.children));
    };
    removeFrom(roots);
    return detached;
  }

  // Is `maybeAncestor` an ancestor of (or equal to) `id`?
  function isAncestor(maybeAncestorId, id) {
    const anc = findNode(maybeAncestorId);
    if (!anc) return false;
    let hit = false;
    walk(anc.children, (n) => { if (n.id === id) hit = true; });
    return maybeAncestorId === id || hit;
  }

  function countNodes() {
    let c = 0;
    walk(roots, () => c++);
    return c;
  }

  // ---------- Persistence ----------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(roots));
      flashSaved();
    } catch (e) {
      console.error("저장 실패", e);
    }
  }

  let savedTimer = null;
  function flashSaved() {
    statSaved.textContent = "✓ 저장됨";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (statSaved.textContent = ""), 1500);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) roots = normalize(JSON.parse(raw));
    } catch (e) {
      console.error("불러오기 실패", e);
      roots = [];
    }
  }

  // Ensure loaded/imported data has all required fields
  function normalize(nodes) {
    if (!Array.isArray(nodes)) return [];
    return nodes.map((n) => ({
      id: n.id || uid(),
      name: String(n.name || "이름 없음"),
      title: String(n.title || ""),
      dept: String(n.dept || ""),
      email: String(n.email || ""),
      color: COLORS.includes(n.color) ? n.color : COLORS[0],
      collapsed: !!n.collapsed,
      children: normalize(n.children || []),
    }));
  }

  // ---------- Rendering ----------
  function render() {
    chartInner.innerHTML = "";
    if (roots.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      const ul = document.createElement("ul");
      ul.className = "tree";
      roots.forEach((n) => ul.appendChild(renderNode(n)));
      chartInner.appendChild(ul);
    }
    statCount.textContent = `구성원 ${countNodes()}명`;
    applyZoom();
    applySearchFilter();
  }

  function renderNode(node) {
    const li = document.createElement("li");
    li.className = "node";

    const card = document.createElement("div");
    card.className = "card";
    card.style.setProperty("--card-color", node.color);
    card.dataset.id = node.id;
    card.draggable = true;
    if (node.collapsed) card.classList.add("collapsed");

    const childCount = node.children.length;
    card.innerHTML = `
      <div class="card__actions">
        <button class="card__btn card__btn--add" title="하위 추가" data-act="add">＋</button>
        <button class="card__btn card__btn--edit" title="편집" data-act="edit">✎</button>
        <button class="card__btn card__btn--del" title="삭제" data-act="del">🗑</button>
      </div>
      <div class="card__name">${esc(node.name)}</div>
      ${node.title ? `<div class="card__title">${esc(node.title)}</div>` : ""}
      ${node.dept ? `<div class="card__dept">${esc(node.dept)}</div>` : ""}
      ${node.email ? `<a class="card__email" href="mailto:${esc(node.email)}">${esc(node.email)}</a>` : ""}
      ${childCount ? `<span class="card__count" data-act="toggle">${childCount}</span>` : ""}
    `;
    li.appendChild(card);

    if (childCount && !node.collapsed) {
      const sub = document.createElement("ul");
      sub.className = "subtree";
      node.children.forEach((c) => sub.appendChild(renderNode(c)));
      li.appendChild(sub);
    }
    return li;
  }

  // ---------- Zoom ----------
  function applyZoom() {
    chartInner.style.transform = `scale(${zoom})`;
    $("#zoomLevel").textContent = Math.round(zoom * 100) + "%";
  }
  function setZoom(z) { zoom = Math.min(2, Math.max(0.4, z)); applyZoom(); }

  // ---------- Search ----------
  function applySearchFilter() {
    const q = searchInput.value.trim().toLowerCase();
    const cards = chartInner.querySelectorAll(".card");
    if (!q) {
      cards.forEach((c) => c.classList.remove("dim", "match"));
      return;
    }
    let first = null;
    cards.forEach((c) => {
      const node = findNode(c.dataset.id);
      const hay = `${node.name} ${node.title} ${node.dept} ${node.email}`.toLowerCase();
      const hit = hay.includes(q);
      c.classList.toggle("dim", !hit);
      c.classList.toggle("match", hit);
      if (hit && !first) first = c;
    });
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }

  // ---------- Dialog ----------
  const dialog = $("#editDialog");
  const editForm = $("#editForm");
  const swatches = $("#swatches");

  function buildSwatches() {
    swatches.innerHTML = "";
    COLORS.forEach((col) => {
      const s = document.createElement("span");
      s.className = "swatch";
      s.style.background = col;
      s.dataset.color = col;
      s.addEventListener("click", () => {
        selectedColor = col;
        swatches.querySelectorAll(".swatch").forEach((x) =>
          x.classList.toggle("selected", x.dataset.color === col));
      });
      swatches.appendChild(s);
    });
  }

  function openDialog({ node = null, parentId = null }) {
    editingId = node ? node.id : null;
    pendingParentId = parentId;
    $("#dialogTitle").textContent = node ? "구성원 편집" : "구성원 추가";
    $("#fName").value = node ? node.name : "";
    $("#fTitle").value = node ? node.title : "";
    $("#fDept").value = node ? node.dept : "";
    $("#fEmail").value = node ? node.email : "";
    selectedColor = node ? node.color : COLORS[0];
    swatches.querySelectorAll(".swatch").forEach((x) =>
      x.classList.toggle("selected", x.dataset.color === selectedColor));
    dialog.showModal();
    setTimeout(() => $("#fName").focus(), 30);
  }

  editForm.addEventListener("submit", (e) => {
    // default dialog form submit closes dialog; we handle data first
    const data = {
      name: $("#fName").value.trim() || "이름 없음",
      title: $("#fTitle").value.trim(),
      dept: $("#fDept").value.trim(),
      email: $("#fEmail").value.trim(),
      color: selectedColor,
    };
    if (editingId) {
      Object.assign(findNode(editingId), data);
    } else {
      const node = makeNode(data);
      if (pendingParentId) {
        const parent = findNode(pendingParentId);
        parent.collapsed = false;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    save();
    render();
  });

  $("#dialogCancel").addEventListener("click", () => dialog.close());

  // ---------- Card interactions (event delegation) ----------
  chartInner.addEventListener("click", (e) => {
    const actEl = e.target.closest("[data-act]");
    if (!actEl) return;
    const card = e.target.closest(".card");
    const id = card.dataset.id;
    const act = actEl.dataset.act;

    if (act === "add") openDialog({ parentId: id });
    else if (act === "edit") openDialog({ node: findNode(id) });
    else if (act === "del") deleteNode(id);
    else if (act === "toggle") {
      const n = findNode(id);
      n.collapsed = !n.collapsed;
      save();
      render();
    }
  });

  function deleteNode(id) {
    const node = findNode(id);
    let sub = 0;
    walk(node.children, () => sub++);
    const msg = sub
      ? `"${node.name}" 및 하위 구성원 ${sub}명을 삭제할까요?`
      : `"${node.name}"을(를) 삭제할까요?`;
    if (!confirm(msg)) return;
    detachNode(id);
    save();
    render();
  }

  // ---------- Drag & drop reparenting ----------
  let dragId = null;

  chartInner.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    dragId = card.dataset.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });

  chartInner.addEventListener("dragend", (e) => {
    const card = e.target.closest(".card");
    if (card) card.classList.remove("dragging");
    chartInner.querySelectorAll(".drop-target").forEach((c) =>
      c.classList.remove("drop-target"));
    dragId = null;
  });

  chartInner.addEventListener("dragover", (e) => {
    const card = e.target.closest(".card");
    if (!card || !dragId) return;
    const targetId = card.dataset.id;
    // can't drop onto itself or its own descendant
    if (isAncestor(dragId, targetId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    chartInner.querySelectorAll(".drop-target").forEach((c) =>
      c.classList.remove("drop-target"));
    card.classList.add("drop-target");
  });

  chartInner.addEventListener("drop", (e) => {
    const card = e.target.closest(".card");
    if (!card || !dragId) return;
    const targetId = card.dataset.id;
    if (isAncestor(dragId, targetId)) return;
    e.preventDefault();
    const moving = detachNode(dragId);
    if (moving) {
      const target = findNode(targetId);
      target.collapsed = false;
      target.children.push(moving);
      save();
      render();
    }
  });

  // ---------- Toolbar ----------
  $("#addRootBtn").addEventListener("click", () => openDialog({ parentId: null }));
  $("#expandAllBtn").addEventListener("click", () => {
    walk(roots, (n) => (n.collapsed = false)); save(); render();
  });
  $("#collapseAllBtn").addEventListener("click", () => {
    walk(roots, (n) => { if (n.children.length) n.collapsed = true; }); save(); render();
  });
  searchInput.addEventListener("input", applySearchFilter);

  $("#zoomIn").addEventListener("click", () => setZoom(zoom + 0.1));
  $("#zoomOut").addEventListener("click", () => setZoom(zoom - 0.1));
  $("#zoomReset").addEventListener("click", () => setZoom(1));

  // ---------- Data menu ----------
  const dataMenu = $("#dataMenu");
  $("#dataMenuBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    dataMenu.hidden = !dataMenu.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu")) dataMenu.hidden = true;
  });

  $("#exportBtn").addEventListener("click", () => {
    dataMenu.hidden = true;
    const blob = new Blob([JSON.stringify(roots, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `조직도-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFile = $("#importFile");
  $("#importBtn").addEventListener("click", () => { dataMenu.hidden = true; importFile.click(); });
  importFile.addEventListener("change", () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = normalize(JSON.parse(reader.result));
        if (!Array.isArray(data)) throw new Error("배열 형식이 아닙니다");
        if (roots.length && !confirm("현재 조직도를 가져온 데이터로 교체할까요?")) return;
        roots = data;
        save();
        render();
      } catch (err) {
        alert("가져오기 실패: 올바른 조직도 JSON 파일이 아닙니다.\n" + err.message);
      } finally {
        importFile.value = "";
      }
    };
    reader.readAsText(file);
  });

  $("#printBtn").addEventListener("click", () => { dataMenu.hidden = true; window.print(); });

  $("#clearBtn").addEventListener("click", () => {
    dataMenu.hidden = true;
    if (confirm("전체 조직도를 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) {
      roots = []; save(); render();
    }
  });

  function loadSample() {
    roots = normalize(SAMPLE);
    save();
    render();
  }
  $("#sampleBtn").addEventListener("click", () => { dataMenu.hidden = true; loadSample(); });
  $("#emptySampleBtn").addEventListener("click", loadSample);

  // ---------- Keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput && !dialog.open) {
      e.preventDefault(); searchInput.focus();
    }
    if (e.key === "Escape" && document.activeElement === searchInput) {
      searchInput.value = ""; applySearchFilter(); searchInput.blur();
    }
  });

  // ---------- Sample data ----------
  const SAMPLE = [
    {
      name: "김대표", title: "대표이사 (CEO)", dept: "경영", color: "#3b6ef6",
      children: [
        {
          name: "이본부", title: "엔지니어링 본부장 (CTO)", dept: "엔지니어링", color: "#0ea5b7",
          children: [
            { name: "박팀장", title: "백엔드 팀장", dept: "백엔드", color: "#0ea5b7",
              children: [
                { name: "최개발", title: "시니어 엔지니어", dept: "백엔드", color: "#0ea5b7" },
                { name: "정개발", title: "주니어 엔지니어", dept: "백엔드", color: "#0ea5b7" },
              ]},
            { name: "한팀장", title: "프론트엔드 팀장", dept: "프론트엔드", color: "#8b5cf6",
              children: [
                { name: "윤개발", title: "엔지니어", dept: "프론트엔드", color: "#8b5cf6" },
              ]},
          ],
        },
        {
          name: "장이사", title: "사업 총괄 (COO)", dept: "사업", color: "#35a563",
          children: [
            { name: "오팀장", title: "마케팅 팀장", dept: "마케팅", color: "#f5a623" },
            { name: "서팀장", title: "영업 팀장", dept: "영업", color: "#e5484d" },
          ],
        },
      ],
    },
  ];

  // ---------- Init ----------
  buildSwatches();
  load();
  render();
})();
