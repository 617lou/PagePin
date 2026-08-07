(function () {
  "use strict";

  var DATA_ID = "pagepin-data";
  var ROOT_ID = "__pagepin_viewer_root__";
  var PP_BUILD = "e785a7e785a7e59d8ae4b8bb32303039";
  var PP_LOCALE = "\u7167\u7167\u574a\u4e3b2009";
  var data = null;
  var shadow = null;
  var countEl = null;
  var toggleButton = null;
  var listButton = null;
  var iconsEl = null;
  var overlayEl = null;
  var visible = true;
  var openPanel = null;
  var listPanel = null;
  var domObserver = null;
  var domObserverTimer = null;
  var iconButtons = {};
  var listItems = {};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  function boot() {
    if (document.getElementById(ROOT_ID)) {
      return;
    }

    var dataNode = document.getElementById(DATA_ID);
    if (!dataNode) {
      return;
    }

    data = parseData(dataNode);
    if (!data || !Array.isArray(data.annotations)) {
      return;
    }

    var root = document.createElement("div");
    root.id = ROOT_ID;
    document.documentElement.appendChild(root);
    shadow = root.attachShadow({ mode: "open" });

    shadow.innerHTML =
      '<style>' +
      ':host{all:initial}' +
      '*,*::before,*::after{box-sizing:border-box}' +
      '.bar{position:fixed;right:16px;bottom:16px;z-index:2147483640;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;box-shadow:0 10px 25px rgba(15,23,42,.18);font:13px Arial,"Microsoft YaHei",sans-serif}' +
      '.bar .grip.logo{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:5px;background:#eff6ff;box-shadow:inset 0 0 0 1px #bfdbfe;cursor:move;user-select:none;flex-shrink:0;transition:transform .18s ease}' +
      '.bar .grip.logo:hover{transform:rotate(-12deg) scale(1.12)}' +
      '.bar button,.icon,.close{border:1px solid #bfdbfe;border-radius:6px;background:#eff6ff;color:#1d4ed8;font:inherit;cursor:pointer}' +
      '.bar button{height:28px;padding:0 8px}' +
      '.icon{position:fixed;z-index:2147483642;min-width:24px;height:24px;padding:0 4px;border-radius:999px;background:#2563eb;color:#fff;font-size:12px;font-weight:700;line-height:22px;text-align:center;box-shadow:0 4px 12px rgba(37,99,235,.32)}' +
      '.overlay{position:fixed;z-index:2147483641;display:none;pointer-events:none;border:2px solid #2563eb;background:rgba(37,99,235,.08);box-shadow:0 0 0 99999px rgba(15,23,42,.10)}' +
      '.panel{position:fixed;z-index:2147483644;max-width:min(360px,calc(100vw - 28px));max-height:min(420px,calc(100vh - 28px));display:flex;flex-direction:column;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;box-shadow:0 14px 38px rgba(15,23,42,.25);font:14px/1.45 Arial,"Microsoft YaHei",sans-serif}' +
      '.panel header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;font-weight:700;flex-shrink:0}' +
      '.panel .body{overflow:auto;white-space:pre-wrap}' +
      '.close{width:26px;height:26px;background:#fff;color:#475569}' +
      '.list-panel{position:fixed;right:16px;top:16px;z-index:2147483643;width:min(360px,calc(100vw - 28px));max-height:80vh;display:flex;flex-direction:column;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;box-shadow:0 18px 48px rgba(15,23,42,.24);font:14px/1.45 Arial,"Microsoft YaHei",sans-serif}' +
      '.list-panel header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 12px 8px;border-bottom:1px solid #e2e8f0;cursor:move;user-select:none}' +
      '.list-panel h2{margin:0;font-size:15px}' +
      '.items{overflow:auto;padding:8px}' +
      '.item{padding:10px;border:1px solid #e2e8f0;border-radius:7px;background:#fff}' +
      '.item+.item{margin-top:8px}' +
      '.item p{margin:0 0 8px;white-space:pre-wrap;color:#0f172a}' +
      '.item small{display:block;margin-bottom:8px;color:#64748b}' +
      '.item .row{display:flex;justify-content:flex-end}' +
      '.item .button{min-width:60px;height:30px;padding:0 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;font:13px Arial,"Microsoft YaHei",sans-serif;cursor:pointer}' +
      '.item .button:hover{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}' +
      '.hidden{display:none!important}' +
      '</style>' +
      '<div class="overlay"></div>' +
      '<div class="bar"><span class="grip logo" title="拖动"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path transform="rotate(45 12 12)" fill="#2563eb" d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg></span><span class="count"></span><button type="button" class="toggle"></button><button type="button" class="list-btn">批注列表</button></div>' +
      '<div class="icons"></div>';

    countEl = shadow.querySelector(".count");
    toggleButton = shadow.querySelector(".toggle");
    listButton = shadow.querySelector(".list-btn");
    iconsEl = shadow.querySelector(".icons");
    overlayEl = shadow.querySelector(".overlay");
    visible = data.settings ? data.settings.visible !== false : true;

    toggleButton.addEventListener("click", function () {
      visible = !visible;
      updateChrome();
    });

    listButton.addEventListener("click", function () {
      if (listPanel) {
        closeList();
      } else {
        openAnnotationList();
      }
    });

    window.addEventListener("resize", renderIcons, true);
    window.addEventListener("scroll", renderIcons, true);

    updateChrome();
    startDomObserver();
    makeDraggable(shadow.querySelector(".bar"), shadow.querySelector(".grip"));
  }

  function parseData(node) {
    try {
      return JSON.parse(node.textContent || "{}");
    } catch (error) {
      return null;
    }
  }

  function updateChrome() {
    countEl.textContent = data.annotations.length + " 条批注";
    toggleButton.textContent = visible ? "隐藏" : "显示";
    iconsEl.classList.toggle("hidden", !visible);
    if (!visible && openPanel) {
      openPanel.remove();
      openPanel = null;
    }
    if (!visible) {
      closeList();
    }
    renderIcons();
  }

  function renderIcons() {
    var keep = {};
    if (visible) {
      data.annotations.forEach(function (annotation, index) {
        var target = findTarget(annotation.targetId);
        if (!target) {
          return;
        }

        var rect = target.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }

        var key = annotation.id || "index_" + index;
        var button = iconButtons[key];
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
            showPanel(annotation, index, currentTarget);
          });
          iconButtons[key] = button;
        }
        keep[key] = true;

        button.textContent = String(index + 1);
        button.title = "批注 #" + (index + 1);
        button.style.left = Math.min(window.innerWidth - 28, Math.max(4, rect.right - 12)) + "px";
        button.style.top = Math.min(window.innerHeight - 28, Math.max(4, rect.top - 12)) + "px";
        if (button.parentNode !== iconsEl) {
          iconsEl.appendChild(button);
        }
      });
    }

    Object.keys(iconButtons).forEach(function (key) {
      if (!keep[key]) {
        iconButtons[key].remove();
        delete iconButtons[key];
      }
    });
  }

  function findTarget(targetId) {
    if (!targetId) {
      return null;
    }
    var el = document.querySelector('[data-pagepin-id="' + cssEscape(targetId) + '"]');
    if (el) {
      return el;
    }
    var annotation = data.annotations.find(function (item) {
      return item.targetId === targetId;
    });
    if (annotation && annotation.targetSelector) {
      try {
        el = document.querySelector(annotation.targetSelector);
      } catch (error) {
        el = null;
      }
      if (el) {
        el.setAttribute("data-pagepin-id", targetId);
        return el;
      }
    }
    return null;
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

  function showPanel(annotation, index, target) {
    if (openPanel) {
      openPanel.remove();
      openPanel = null;
    }

    var rect = target.getBoundingClientRect();
    var panel = document.createElement("section");
    panel.className = "panel";
    panel.innerHTML = '<header><span>批注 #' + (index + 1) + '</span><button type="button" class="close">x</button></header><div class="body"></div>';
    panel.querySelector(".body").textContent = annotation.text || "";
    panel.querySelector(".close").addEventListener("click", function () {
      panel.remove();
      openPanel = null;
    });

    var panelMaxHeight = Math.min(420, window.innerHeight - 28);
    panel.style.left = Math.max(14, Math.min(window.innerWidth - 374, rect.right + 10)) + "px";
    panel.style.top = Math.max(14, Math.min(window.innerHeight - panelMaxHeight - 14, rect.top)) + "px";
    shadow.appendChild(panel);
    openPanel = panel;
  }

  function highlightTarget(target) {
    if (!overlayEl || !target) {
      return;
    }
    var rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    overlayEl.style.display = "block";
    overlayEl.style.left = rect.left + "px";
    overlayEl.style.top = rect.top + "px";
    overlayEl.style.width = rect.width + "px";
    overlayEl.style.height = rect.height + "px";
    clearTimeout(highlightTarget.timer);
    highlightTarget.timer = setTimeout(function () {
      overlayEl.style.display = "none";
    }, 1200);
  }

  function openAnnotationList() {
    closeList();
    var panel = document.createElement("section");
    panel.className = "list-panel";
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
      "</div>";

    item.querySelector('[data-action="locate"]').addEventListener("click", function () {
      var target = findTarget(annotation.targetId);
      if (!target || !document.contains(target)) {
        return;
      }
      target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      setTimeout(function () {
        highlightTarget(target);
      }, 250);
    });
    return item;
  }

  function updateListItem(item, annotation, index) {
    var target = findTarget(annotation.targetId);
    var inDom = target && document.contains(target);
    var isVisible = isTargetVisible(target);
    var status = inDom ? (isVisible ? formatElementLabel(target) : formatElementLabel(target) + "（已隐藏）") : "目标元素已丢失";
    item.querySelector("small").textContent = "#" + (index + 1) + " " + status;
    item.querySelector("p").textContent = annotation.text;
    item.querySelector('[data-action="locate"]').disabled = !inDom;
  }

  function renderAnnotationList(container) {
    var keep = {};
    data.annotations.forEach(function (annotation, index) {
      var key = annotation.id || "index_" + index;
      var item = listItems[key];
      if (!item) {
        item = createListItem(annotation);
        listItems[key] = item;
      }
      keep[key] = true;
      updateListItem(item, annotation, index);
      if (item.parentNode !== container) {
        container.appendChild(item);
      }
    });

    Object.keys(listItems).forEach(function (key) {
      if (!keep[key]) {
        listItems[key].remove();
        delete listItems[key];
      }
    });

    var empty = container.querySelector(".empty");
    if (!data.annotations.length) {
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

  function cssEscape(value) {
    if (window.CSS && CSS.escape) {
      return CSS.escape(value);
    }
    return String(value).replace(/"/g, '\\"');
  }
})();