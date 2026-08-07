(function () {
  "use strict";

  if (window.__pagePinContentLoaded) {
    return;
  }
  window.__pagePinContentLoaded = true;

  var DATA_ID = "pagepin-data";
  var META_NAME = "pagepin-version";
  var VIEWER_SCRIPT_ID = "pagepin-viewer";
  var EDITOR_ROOT_ID = "__pagepin_editor_root__";
  var VIEWER_ROOT_ID = "__pagepin_viewer_root__";
  var TARGET_ATTR = "data-pagepin-id";
  var PP_BUILD = "e785a7e785a7e59d8ae4b8bb32303039";
  var PP_LOCALE = "\u7167\u7167\u574a\u4e3b2009";

  var hadDataNode = !!document.getElementById(DATA_ID);
  var isExportedFile = !!document.getElementById(VIEWER_SCRIPT_ID);
  var state = loadState();
  var stateDirty = false;
  var picking = false;
  var hoverTarget = null;
  var shadow = null;
  var overlayEl = null;
  var labelEl = null;
  var iconsEl = null;
  var toastEl = null;
  var menuEl = null;
  var menuCountEl = null;
  var menuVisibilityButton = null;
  var listPanel = null;
  var dialog = null;
  var domObserver = null;
  var domObserverTimer = null;
  var iconButtons = {};
  var listItems = {};

  initEditorUi();
  removeViewerUi();
  if (hadDataNode) {
    syncDataNode();
  }
  renderIcons();
  startDomObserver();
  restoreFromStorage();

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || typeof message.type !== "string") {
      return false;
    }

    if (message.type === "PAGEPIN_GET_STATE") {
      sendResponse({ ok: true, state: getPublicState() });
      return false;
    }

    if (message.type === "PAGEPIN_TOGGLE_MENU") {
      toggleMenu();
      sendResponse({ ok: true, state: getPublicState() });
      return false;
    }

    if (message.type === "PAGEPIN_OPEN_MENU") {
      openMenu();
      sendResponse({ ok: true, state: getPublicState() });
      return false;
    }

    if (message.type === "PAGEPIN_START_PICKING") {
      startPicking();
      sendResponse({ ok: true, state: getPublicState() });
      return false;
    }

    if (message.type === "PAGEPIN_TOGGLE_VISIBLE") {
      state.settings.visible = !state.settings.visible;
      stateDirty = true;
      syncDataNode();
      renderIcons();
      updateMenu();
      sendResponse({ ok: true, state: getPublicState() });
      return false;
    }

    if (message.type === "PAGEPIN_OPEN_LIST") {
      openAnnotationList();
      sendResponse({ ok: true, state: getPublicState() });
      return false;
    }

    if (message.type === "PAGEPIN_EXPORT_HTML") {
      exportHtml()
        .then(function (result) {
          sendResponse(result);
        })
        .catch(function (error) {
          sendResponse({ ok: false, error: error.message || "导出失败" });
        });
      return true;
    }

    return false;
  });

  window.addEventListener("resize", renderIcons, true);
  window.addEventListener("scroll", renderIcons, true);

  function loadState() {
    var node = document.getElementById(DATA_ID);
    if (node) {
      try {
        var parsed = JSON.parse(node.textContent || "{}");
        return normalizeState(parsed);
      } catch (error) {
        return createEmptyState();
      }
    }
    return createEmptyState();
  }

  function createEmptyState() {
    return {
      schemaVersion: 1,
      annotations: [],
      settings: {
        visible: true
      }
    };
  }

  function normalizeState(value) {
    var next = createEmptyState();
    if (value && Array.isArray(value.annotations)) {
      next.annotations = value.annotations
        .filter(function (item) {
          return item && item.id && item.targetId;
        })
        .map(function (item) {
          return {
            id: String(item.id),
            targetId: String(item.targetId),
            targetSelector: item.targetSelector || "",
            text: String(item.text || ""),
            status: item.status || "open",
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
          };
        });
    }
    if (value && value.settings) {
      next.settings.visible = value.settings.visible !== false;
    }
    return next;
  }

  function getPublicState() {
    return {
      count: state.annotations.length,
      visible: state.settings.visible,
      picking: picking
    };
  }

  function initEditorUi() {
    var existing = document.getElementById(EDITOR_ROOT_ID);
    if (existing) {
      existing.remove();
    }

    var root = document.createElement("div");
    root.id = EDITOR_ROOT_ID;
    document.documentElement.appendChild(root);
    shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML =
      '<style>' +
      ':host{all:initial}' +
      '*,*::before,*::after{box-sizing:border-box}' +
      '.overlay{position:fixed;z-index:2147483641;display:none;pointer-events:none;border:2px solid #2563eb;background:rgba(37,99,235,.08);box-shadow:0 0 0 99999px rgba(15,23,42,.10)}' +
      '.label{position:fixed;z-index:2147483642;display:none;max-width:320px;padding:4px 7px;border-radius:5px;background:#2563eb;color:#fff;font:12px Arial,"Microsoft YaHei",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}' +
      '.toast{position:fixed;left:50%;bottom:24px;z-index:2147483647;display:none;transform:translateX(-50%);padding:8px 12px;border-radius:8px;background:#0f172a;color:#fff;box-shadow:0 10px 24px rgba(15,23,42,.24);font:13px Arial,"Microsoft YaHei",sans-serif}' +
      '.toolbar{position:fixed;right:16px;bottom:16px;z-index:2147483640;width:min(280px,calc(100vw - 32px));padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;box-shadow:0 18px 46px rgba(15,23,42,.24);font:13px/1.45 Arial,"Microsoft YaHei",sans-serif}' +
      '.toolbar header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}' +
      '.toolbar .drag-handle{display:flex;align-items:center;gap:8px;cursor:move;user-select:none}' +
      '.toolbar .logo{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:#eff6ff;flex-shrink:0;box-shadow:inset 0 0 0 1px #bfdbfe;transition:transform .18s ease}' +
      '.toolbar .drag-handle:hover .logo{transform:rotate(-12deg) scale(1.1)}' +
      '.toolbar strong{font-size:14px}' +
      '.toolbar small{color:#64748b}' +
      '.toolbar .actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}' +
      '.toolbar button{min-height:34px;padding:0 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;font:13px Arial,"Microsoft YaHei",sans-serif;cursor:pointer}' +
      '.toolbar button:hover{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}' +
      '.toolbar .primary{border-color:#2563eb;background:#2563eb;color:#fff}' +
      '.toolbar .primary:hover{background:#1d4ed8;color:#fff}' +
      '.toolbar .mini{width:28px;min-height:28px;padding:0;color:#475569}' +
      '.icon{position:fixed;z-index:2147483644;min-width:24px;height:24px;padding:0 4px;border:1px solid #1d4ed8;border-radius:999px;background:#2563eb;color:#fff;font:700 12px/22px Arial,"Microsoft YaHei",sans-serif;text-align:center;box-shadow:0 5px 14px rgba(37,99,235,.34);cursor:pointer}' +
      '.icon.missing{background:#64748b;border-color:#475569}' +
      '.hidden{display:none!important}' +
      '.modal{position:fixed;inset:0;z-index:2147483643;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.28);font:14px/1.45 Arial,"Microsoft YaHei",sans-serif}' +
      '.dialog{width:min(420px,calc(100vw - 28px));max-width:calc(100vw - 28px);padding:14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;box-shadow:0 18px 48px rgba(15,23,42,.28)}' +
      '.dialog h2{margin:0 0 10px;font-size:16px;line-height:1.3}' +
      '.dialog textarea{display:block;width:100%;min-height:112px;resize:vertical;margin:0 0 12px;padding:9px;border:1px solid #cbd5e1;border-radius:6px;color:#0f172a;background:#fff;font:14px/1.45 Arial,"Microsoft YaHei",sans-serif}' +
      '.dialog textarea:focus{outline:2px solid #bfdbfe;border-color:#2563eb}' +
      '.row{display:flex;align-items:center;justify-content:flex-end;gap:8px}' +
      '.button{min-width:72px;height:34px;padding:0 12px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;font:14px Arial,"Microsoft YaHei",sans-serif;cursor:pointer}' +
      '.button.primary{border-color:#2563eb;background:#2563eb;color:#fff}' +
      '.button.danger{border-color:#fecaca;color:#b91c1c}' +
      '.panel{position:fixed;right:16px;top:16px;z-index:2147483645;width:min(360px,calc(100vw - 28px));max-height:80vh;display:flex;flex-direction:column;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;box-shadow:0 18px 48px rgba(15,23,42,.24);font:14px/1.45 Arial,"Microsoft YaHei",sans-serif}' +
      '.panel header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 12px 8px;border-bottom:1px solid #e2e8f0;cursor:move;user-select:none}' +
      '.panel h2{margin:0;font-size:15px}' +
      '.close{width:28px;height:28px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#475569;cursor:pointer}' +
      '.items{overflow:auto;padding:8px}' +
      '.item{padding:10px;border:1px solid #e2e8f0;border-radius:7px;background:#fff}' +
      '.item+.item{margin-top:8px}' +
      '.item p{margin:0 0 8px;white-space:pre-wrap;color:#0f172a}' +
      '.item small{display:block;margin-bottom:8px;color:#64748b}' +
      '</style>' +
      '<div class="overlay"></div>' +
      '<div class="label"></div>' +
      '<section class="toolbar hidden" aria-label="PagePin\u200c\u200d\u200c\u200d 菜单">' +
      '<header><div class="drag-handle"><span class="logo"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path transform="rotate(45 12 12)" fill="#2563eb" d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg></span><div><strong>PagePin</strong><br><small class="menu-count">0 条批注</small></div></div><button type="button" class="mini" data-menu-action="close">x</button></header>' +
      '<div class="actions">' +
      '<button type="button" class="primary" data-menu-action="pick">开始批注</button>' +
      '<button type="button" data-menu-action="visible">隐藏批注</button>' +
      '<button type="button" data-menu-action="list">批注列表</button>' +
      '<button type="button" data-menu-action="export">导出 HTML</button>' +
      '</div>' +
      '</section>' +
      '<div class="icons"></div>' +
      '<div class="toast"></div>';

    overlayEl = shadow.querySelector(".overlay");
    labelEl = shadow.querySelector(".label");
    menuEl = shadow.querySelector(".toolbar");
    menuCountEl = shadow.querySelector(".menu-count");
    menuVisibilityButton = shadow.querySelector('[data-menu-action="visible"]');
    iconsEl = shadow.querySelector(".icons");
    toastEl = shadow.querySelector(".toast");
    bindMenu();
    updateMenu();
    makeDraggable(menuEl, shadow.querySelector(".drag-handle"));
  }

  function bindMenu() {
    shadow.querySelector('[data-menu-action="close"]').addEventListener("click", closeMenu);
    shadow.querySelector('[data-menu-action="pick"]').addEventListener("click", function () {
      openMenu();
      startPicking();
    });
    shadow.querySelector('[data-menu-action="visible"]').addEventListener("click", function () {
      state.settings.visible = !state.settings.visible;
      syncDataNode();
      renderIcons();
      updateMenu();
    });
    shadow.querySelector('[data-menu-action="list"]').addEventListener("click", openAnnotationList);
    shadow.querySelector('[data-menu-action="export"]').addEventListener("click", function () {
      exportHtml().catch(function (error) {
        showToast(error.message || "导出失败");
      });
    });
  }

  function toggleMenu() {
    if (!menuEl) {
      return;
    }
    if (menuEl.classList.contains("hidden")) {
      openMenu();
    } else {
      closeMenu();
    }
  }

  function openMenu() {
    if (!menuEl) {
      return;
    }
    menuEl.classList.remove("hidden");
    updateMenu();
  }

  function closeMenu() {
    if (menuEl) {
      menuEl.classList.add("hidden");
    }
  }

  function updateMenu() {
    if (menuCountEl) {
      menuCountEl.textContent = state.annotations.length + " 条批注";
    }
    if (menuVisibilityButton) {
      menuVisibilityButton.textContent = state.settings.visible ? "隐藏批注" : "显示批注";
    }
  }

  function removeViewerUi() {
    var viewerRoot = document.getElementById(VIEWER_ROOT_ID);
    if (viewerRoot) {
      viewerRoot.remove();
    }
  }

  function startPicking() {
    if (picking) {
      return;
    }
    picking = true;
    closeDialog();
    closeList();
    showToast("选择页面元素，点击后添加备注");
    document.addEventListener("mousemove", onPickMouseMove, true);
    document.addEventListener("click", onPickClick, true);
    document.addEventListener("keydown", onPickKeyDown, true);
  }

  function stopPicking() {
    picking = false;
    hoverTarget = null;
    hideOverlay();
    document.removeEventListener("mousemove", onPickMouseMove, true);
    document.removeEventListener("click", onPickClick, true);
    document.removeEventListener("keydown", onPickKeyDown, true);
  }

  function onPickMouseMove(event) {
    var target = getAnnotatableElement(event.clientX, event.clientY);
    if (!target) {
      hoverTarget = null;
      hideOverlay();
      return;
    }
    if (target === hoverTarget) {
      return;
    }
    hoverTarget = target;
    showOverlay(target);
  }

  function onPickClick(event) {
    var target = getAnnotatableElement(event.clientX, event.clientY);
    if (!target) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    stopPicking();
    openPinDialog(target, null);
  }

  function onPickKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      stopPicking();
      showToast("已取消选择");
    }
  }

  function getAnnotatableElement(clientX, clientY) {
    hideOverlay();
    var element = document.elementFromPoint(clientX, clientY);
    showOverlay(hoverTarget);

    if (!element) {
      return null;
    }
    if (element.closest && element.closest("#" + EDITOR_ROOT_ID)) {
      return null;
    }
    if (element.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }
    if (/^(HTML|HEAD|BODY|SCRIPT|STYLE|META|LINK|TITLE)$/i.test(element.tagName)) {
      return null;
    }
    return element;
  }

  function showOverlay(element) {
    if (!element || !overlayEl || !labelEl) {
      hideOverlay();
      return;
    }

    var rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      hideOverlay();
      return;
    }

    overlayEl.style.display = "block";
    overlayEl.style.left = rect.left + "px";
    overlayEl.style.top = rect.top + "px";
    overlayEl.style.width = rect.width + "px";
    overlayEl.style.height = rect.height + "px";

    labelEl.textContent = formatElementLabel(element);
    labelEl.style.display = "block";
    labelEl.style.left = Math.max(4, rect.left) + "px";
    labelEl.style.top = Math.max(4, rect.top - 26) + "px";
  }

  function hideOverlay() {
    if (overlayEl) {
      overlayEl.style.display = "none";
    }
    if (labelEl) {
      labelEl.style.display = "none";
    }
  }

  function formatElementLabel(element) {
    var label = element.tagName.toLowerCase();
    if (element.id) {
      label += "#" + element.id;
    }
    if (element.className && typeof element.className === "string") {
      var classes = element.className.trim().split(/\s+/).slice(0, 3).join(".");
      if (classes) {
        label += "." + classes;
      }
    }
    return label;
  }

  function openPinDialog(target, annotation) {
    closeDialog();
    var existing = annotation || findAnnotationByTarget(target.getAttribute(TARGET_ATTR));
    renderIcons();
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML =
      '<section class="dialog" role="dialog" aria-modal="true">' +
      '<h2>' + (existing ? "编辑备注" : "添加备注") + '</h2>' +
      '<textarea placeholder="输入备注内容"></textarea>' +
      '<div class="row">' +
      (existing ? '<button type="button" class="button danger" data-action="delete">删除</button>' : "") +
      '<button type="button" class="button" data-action="cancel">取消</button>' +
      '<button type="button" class="button primary" data-action="save">保存</button>' +
      '</div>' +
      '</section>';

    var textarea = modal.querySelector("textarea");
    textarea.value = existing ? existing.text : "";

    modal.querySelector('[data-action="cancel"]').addEventListener("click", closeDialog);
    modal.querySelector('[data-action="save"]').addEventListener("click", function () {
      var text = textarea.value.trim();
      if (!text) {
        textarea.focus();
        return;
      }
      saveAnnotation(target, existing, text);
      closeDialog();
      showToast("备注已保存");
    });

    var deleteButton = modal.querySelector('[data-action="delete"]');
    if (deleteButton && existing) {
      deleteButton.addEventListener("click", function () {
        deleteAnnotation(existing.id);
        closeDialog();
        showToast("备注已删除");
      });
    }

    modal.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeDialog();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        modal.querySelector('[data-action="save"]').click();
      }
    });

    shadow.appendChild(modal);
    dialog = modal;
    textarea.focus();
  }

  function closeDialog() {
    if (dialog) {
      dialog.remove();
      dialog = null;
    }
    renderIcons();
  }

  function saveAnnotation(target, existing, text) {
    var now = new Date().toISOString();
    var targetId = target.getAttribute(TARGET_ATTR);
    if (!targetId) {
      targetId = "rt_" + createId();
      target.setAttribute(TARGET_ATTR, targetId);
    }

    if (existing) {
      existing.targetId = targetId;
      existing.targetSelector = generateSelector(target);
      existing.text = text;
      existing.updatedAt = now;
    } else {
      state.annotations.push({
        id: "anno_" + createId(),
        targetId: targetId,
        targetSelector: generateSelector(target),
        text: text,
        status: "open",
        createdAt: now,
        updatedAt: now
      });
    }

    state.settings.visible = true;
    stateDirty = true;
    syncDataNode();
    renderIcons();
    updateMenu();
    refreshListIfOpen();
  }

  function deleteAnnotation(annotationId) {
    state.annotations = state.annotations.filter(function (item) {
      return item.id !== annotationId;
    });
    stateDirty = true;
    syncDataNode();
    renderIcons();
    updateMenu();
    refreshListIfOpen();
  }

  function findAnnotationByTarget(targetId) {
    if (!targetId) {
      return null;
    }
    return state.annotations.find(function (item) {
      return item.targetId === targetId;
    }) || null;
  }

  function renderIcons() {
    if (!iconsEl) {
      return;
    }
    iconsEl.classList.toggle("hidden", state.settings.visible === false);

    var keep = {};
    if (state.settings.visible !== false) {
      state.annotations.forEach(function (annotation, index) {
        var target = findTarget(annotation.targetId);
        if (!target) {
          return;
        }

        var rect = target.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }

        var button = iconButtons[annotation.id];
        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.className = "icon";
          button.addEventListener("click", function () {
            var currentTarget = findTarget(annotation.targetId);
            if (!currentTarget || !document.contains(currentTarget)) {
              renderIcons();
              return;
            }
            var current = state.annotations.find(function (item) {
              return item.id === annotation.id;
            });
            openPinDialog(currentTarget, current || null);
          });
          iconButtons[annotation.id] = button;
        }
        keep[annotation.id] = true;

        button.textContent = String(index + 1);
        button.title = "批注 #" + (index + 1);
        button.style.left = Math.min(window.innerWidth - 28, Math.max(4, rect.right - 12)) + "px";
        button.style.top = Math.min(window.innerHeight - 28, Math.max(4, rect.top - 12)) + "px";
        if (button.parentNode !== iconsEl) {
          iconsEl.appendChild(button);
        }
      });
    }

    Object.keys(iconButtons).forEach(function (id) {
      if (!keep[id]) {
        iconButtons[id].remove();
        delete iconButtons[id];
      }
    });
  }

  function findTarget(targetId) {
    if (!targetId) {
      return null;
    }
    var el = document.querySelector("[" + TARGET_ATTR + '="' + cssEscape(targetId) + '"]');
    if (el) {
      return el;
    }
    var annotation = state.annotations.find(function (item) {
      return item.targetId === targetId;
    });
    if (annotation && annotation.targetSelector) {
      try {
        el = document.querySelector(annotation.targetSelector);
      } catch (error) {
        el = null;
      }
      if (el) {
        el.setAttribute(TARGET_ATTR, targetId);
        return el;
      }
    }
    return null;
  }

  function generateSelector(element) {
    if (element.id) {
      return "#" + cssEscape(element.id);
    }
    var parts = [];
    var current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      var part = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift("#" + cssEscape(current.id));
        break;
      }
      if (current.className && typeof current.className === "string") {
        var classes = current.className.trim().split(/\s+/).filter(function (c) {
          return c.length > 0;
        }).slice(0, 3);
        if (classes.length) {
          part += "." + classes.map(cssEscape).join(".");
        }
      }
      var parent = current.parentElement;
      if (parent) {
        var sameTag = Array.prototype.filter.call(parent.children, function (child) {
          return child.tagName === current.tagName;
        });
        if (sameTag.length > 1) {
          part += ":nth-of-type(" + (sameTag.indexOf(current) + 1) + ")";
        }
      }
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function isTargetVisible(target) {
    if (!target || !document.contains(target)) {
      return false;
    }
    var rect = target.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function startDomObserver() {
    if (domObserver || !document.body) {
      return;
    }
    domObserver = new MutationObserver(function () {
      clearTimeout(domObserverTimer);
      domObserverTimer = setTimeout(function () {
        renderIcons();
        refreshListIfOpen();
      }, 200);
    });
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"]
    });
  }

  function openAnnotationList() {
    closeList();
    var panel = document.createElement("section");
    panel.className = "panel";
    panel.innerHTML =
      '<header><h2>批注列表</h2><button type="button" class="close">x</button></header>' +
      '<div class="items"></div>';
    panel.querySelector(".close").addEventListener("click", closeList);
    makeDraggable(panel, panel.querySelector("header"));
    shadow.appendChild(panel);
    listPanel = panel;
    renderAnnotationList(panel.querySelector(".items"));
  }

  function createListItem(annotation) {
    var item = document.createElement("article");
    item.className = "item";
    item.innerHTML =
      "<small></small>" +
      "<p></p>" +
      '<div class="row">' +
      '<button type="button" class="button" data-action="locate">定位</button>' +
      '<button type="button" class="button" data-action="edit">编辑</button>' +
      '<button type="button" class="button danger" data-action="delete">删除</button>' +
      "</div>";

    item.querySelector('[data-action="locate"]').addEventListener("click", function () {
      var target = findTarget(annotation.targetId);
      if (!target || !document.contains(target)) {
        return;
      }
      target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      setTimeout(function () {
        showOverlay(target);
        setTimeout(hideOverlay, 1200);
      }, 250);
    });
    item.querySelector('[data-action="edit"]').addEventListener("click", function () {
      var target = findTarget(annotation.targetId);
      var current = state.annotations.find(function (entry) {
        return entry.id === annotation.id;
      });
      if (current && target && document.contains(target)) {
        openPinDialog(target, current);
      }
    });
    item.querySelector('[data-action="delete"]').addEventListener("click", function () {
      deleteAnnotation(annotation.id);
    });
    return item;
  }

  function updateListItem(item, annotation, index) {
    var target = findTarget(annotation.targetId);
    var inDom = target && document.contains(target);
    var visible = isTargetVisible(target);
    var status = inDom ? (visible ? formatElementLabel(target) : formatElementLabel(target) + "（已隐藏）") : "目标元素已丢失";
    item.querySelector("small").textContent = "#" + (index + 1) + " " + status;
    item.querySelector("p").textContent = annotation.text;
    item.querySelector('[data-action="locate"]').disabled = !inDom;
    item.querySelector('[data-action="edit"]').disabled = !inDom;
  }

  function renderAnnotationList(container) {
    var keep = {};
    state.annotations.forEach(function (annotation, index) {
      var item = listItems[annotation.id];
      if (!item) {
        item = createListItem(annotation);
        listItems[annotation.id] = item;
      }
      keep[annotation.id] = true;
      updateListItem(item, annotation, index);
      if (item.parentNode !== container) {
        container.appendChild(item);
      }
    });

    Object.keys(listItems).forEach(function (id) {
      if (!keep[id]) {
        listItems[id].remove();
        delete listItems[id];
      }
    });

    var empty = container.querySelector(".empty");
    if (!state.annotations.length) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "item empty";
        empty.textContent = "暂无批注";
        container.appendChild(empty);
      }
    } else if (empty) {
      empty.remove();
    }
  }

  function refreshListIfOpen() {
    if (!listPanel) {
      return;
    }
    renderAnnotationList(listPanel.querySelector(".items"));
  }

  function closeList() {
    if (listPanel) {
      listPanel.remove();
      listPanel = null;
    }
  }

  function syncDataNode() {
    var node = document.getElementById(DATA_ID);
    if (!node) {
      node = document.createElement("script");
      node.id = DATA_ID;
      node.type = "application/json";
      (document.head || document.documentElement).appendChild(node);
    }
    node.textContent = safeJson(state);

    var meta = document.querySelector('meta[name="' + META_NAME + '"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", META_NAME);
      (document.head || document.documentElement).appendChild(meta);
    }
    meta.setAttribute("content", "1");

    persistState();
  }

  function storageKey() {
    var href = location.href;
    var hashIndex = href.indexOf("#");
    if (hashIndex !== -1) {
      href = href.slice(0, hashIndex);
    }
    return "pagepin:" + href;
  }

  function persistState() {
    if (isExportedFile && !stateDirty) {
      return;
    }
    if (!chrome.storage || !chrome.storage.local) {
      return;
    }
    var key = storageKey();
    if (state.annotations.length === 0) {
      chrome.storage.local.remove(key).catch(function () {});
      return;
    }
    var entry = {};
    entry[key] = state;
    chrome.storage.local.set(entry).catch(function (error) {
      console.error("PagePin: 批注保存到本地失败", error);
      showToast("批注自动保存失败:" + (error && error.message ? error.message : error));
    });
  }

  function restoreFromStorage() {
    if (!chrome.storage || !chrome.storage.local) {
      return;
    }
    var key = storageKey();
    chrome.storage.local.get(key).then(function (result) {
      if (stateDirty) {
        return;
      }
      var saved = result ? result[key] : null;
      if (!saved) {
        return;
      }
      var restored = normalizeState(saved);
      if (!isExportedFile && state.annotations.length > 0) {
        return;
      }
      if (!restored.annotations.length) {
        return;
      }
      state = restored;
      syncDataNode();
      renderIcons();
      updateMenu();
      refreshListIfOpen();
      showToast("已恢复 " + state.annotations.length + " 条批注");
    }).catch(function (error) {
      console.error("PagePin: 读取本地批注失败", error);
    });
  }

  async function exportHtml() {
    closeDialog();
    closeList();
    stopPicking();
    syncDataNode();

    var viewerRuntime = await fetch(chrome.runtime.getURL("viewer-runtime.js")).then(function (response) {
      if (!response.ok) {
        throw new Error("无法读取查看脚本");
      }
      return response.text();
    });

    var clone = document.documentElement.cloneNode(true);
    removeNode(clone, "#" + EDITOR_ROOT_ID);
    removeNode(clone, "#" + VIEWER_ROOT_ID);
    removeNode(clone, "#" + DATA_ID);
    removeNode(clone, "#" + VIEWER_SCRIPT_ID);
    removeNode(clone, 'meta[name="' + META_NAME + '"]');

    var head = clone.querySelector("head") || clone;
    var body = clone.querySelector("body") || clone;
    var meta = document.createElement("meta");
    meta.setAttribute("name", META_NAME);
    meta.setAttribute("content", "1");

    var dataScript = document.createElement("script");
    dataScript.id = DATA_ID;
    dataScript.type = "application/json";
    dataScript.textContent = safeJson(state);

    var viewerScript = document.createElement("script");
    viewerScript.id = VIEWER_SCRIPT_ID;
    viewerScript.textContent = viewerRuntime;

    head.appendChild(meta);
    head.appendChild(dataScript);
    body.appendChild(viewerScript);

    var doctype = document.doctype ? serializeDoctype(document.doctype) + "\n" : "<!doctype html>\n";
    var html = doctype + clone.outerHTML;
    var filename = createExportFilename();

    var response = await chrome.runtime.sendMessage({
      type: "PAGEPIN_DOWNLOAD_HTML",
      html: html,
      filename: filename
    });

    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "下载失败");
    }

    state.annotations = [];
    stateDirty = true;
    syncDataNode();
    renderIcons();
    refreshListIfOpen();
    updateMenu();
    showToast("已导出，本页批注已清除");
    return { ok: true, state: getPublicState() };
  }

  function removeNode(root, selector) {
    var node = root.querySelector(selector);
    if (node) {
      node.remove();
    }
  }

  function createExportFilename() {
    var base = "annotated";
    var path = "";
    try {
      path = decodeURIComponent(location.pathname || "");
    } catch (error) {
      path = location.pathname || "";
    }
    var match = path.match(/([^/\\]+)$/);
    if (match && match[1]) {
      base = match[1].replace(/\.html?$/i, "");
    } else if (document.title) {
      base = document.title.trim().replace(/\s+/g, "_");
    }
    return sanitizeFilename(base + ".annotated.html");
  }

  function sanitizeFilename(filename) {
    return filename.replace(/[\\/:*?"<>|]+/g, "_").replace(/^\.+/, "") || "annotated.html";
  }

  function serializeDoctype(doctype) {
    var value = "<!DOCTYPE " + doctype.name;
    if (doctype.publicId) {
      value += ' PUBLIC "' + doctype.publicId + '"';
    }
    if (doctype.systemId) {
      value += ' "' + doctype.systemId + '"';
    }
    return value + ">";
  }

  var dragState = null;

  function makeDraggable(element, handle) {
    handle.addEventListener("mousedown", function (event) {
      if (event.button !== 0) {
        return;
      }
      if (event.target.closest && event.target.closest("button")) {
        return;
      }
      var rect = element.getBoundingClientRect();
      element.style.left = rect.left + "px";
      element.style.top = rect.top + "px";
      element.style.right = "auto";
      element.style.bottom = "auto";
      dragState = {
        element: element,
        startX: event.clientX,
        startY: event.clientY,
        origLeft: rect.left,
        origTop: rect.top
      };
      event.preventDefault();
    });
  }

  document.addEventListener("mousemove", function (event) {
    if (!dragState) {
      return;
    }
    var element = dragState.element;
    var maxLeft = window.innerWidth - element.offsetWidth;
    var maxTop = window.innerHeight - element.offsetHeight;
    element.style.left = Math.max(0, Math.min(maxLeft, dragState.origLeft + event.clientX - dragState.startX)) + "px";
    element.style.top = Math.max(0, Math.min(maxTop, dragState.origTop + event.clientY - dragState.startY)) + "px";
  }, true);

  document.addEventListener("mouseup", function () {
    dragState = null;
  }, true);

  function createId() {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    }
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) {
      return CSS.escape(value);
    }
    return String(value).replace(/"/g, '\\"');
  }

  function safeJson(value) {
    return JSON.stringify(value, null, 2).replace(/<\/script/gi, "<\\/script");
  }

  function showToast(message) {
    if (!toastEl) {
      return;
    }
    toastEl.textContent = message;
    toastEl.style.display = "block";
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toastEl.style.display = "none";
    }, 1800);
  }
})();
