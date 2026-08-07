const RT_BUILD = "e785a7e785a7e59d8ae4b8bb32303039";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) {
    return;
  }

  syncRestoreScript();

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    await chrome.tabs.sendMessage(tab.id, { type: "PAGEPIN_TOGGLE_MENU" });
  } catch (error) {
    // Chrome blocks injection on internal pages and on file URLs without user permission.
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "PAGEPIN_DOWNLOAD_HTML") {
    return false;
  }

  const html = typeof message.html === "string" ? message.html : "";
  const filename = sanitizeFilename(message.filename || "annotated.html");
  const url = "data:text/html;charset=utf-8," + encodeURIComponent(html);

  chrome.downloads.download(
    {
      url,
      filename,
      saveAs: true
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true, downloadId });
    }
  );

  return true;
});

function sanitizeFilename(filename) {
  return filename.replace(/[\\/:*?"<>|]+/g, "_").replace(/^\.+/, "") || "annotated.html";
}

const RESTORE_SCRIPT_ID = "pagepin-restore";
const RESTORE_STORAGE_PREFIX = "pagepin:";

chrome.runtime.onInstalled.addListener(() => {
  syncRestoreScript();
});

chrome.runtime.onStartup.addListener(() => {
  syncRestoreScript();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    syncRestoreScript();
  }
});

async function syncRestoreScript() {
  let patterns = [];
  try {
    const saved = await chrome.storage.local.get(null);
    const unique = new Set();
    Object.keys(saved).forEach((key) => {
      if (!key.startsWith(RESTORE_STORAGE_PREFIX)) {
        return;
      }
      const entry = saved[key];
      if (!entry || !Array.isArray(entry.annotations) || entry.annotations.length === 0) {
        return;
      }
      const pattern = toMatchPattern(key.slice(RESTORE_STORAGE_PREFIX.length));
      if (pattern) {
        unique.add(pattern);
      }
    });
    patterns = Array.from(unique);
  } catch (error) {
    return;
  }

  let registered = null;
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [RESTORE_SCRIPT_ID] });
    registered = existing.length > 0 ? existing[0] : null;
  } catch (error) {
    registered = null;
  }

  if (registered) {
    const current = registered.matches || [];
    if (current.length === patterns.length && patterns.every((pattern) => current.includes(pattern))) {
      return;
    }
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [RESTORE_SCRIPT_ID] });
    } catch (error) {
      // Already unregistered.
    }
  }

  if (patterns.length === 0) {
    return;
  }

  const script = {
    id: RESTORE_SCRIPT_ID,
    matches: patterns,
    js: ["content.js"],
    runAt: "document_idle"
  };

  try {
    await chrome.scripting.registerContentScripts([script]);
  } catch (error) {
    // URLs outside the extension's host permissions (http/https pages) cannot be
    // auto-registered; those pages fall back to restoring via the toolbar icon.
    const filePatterns = patterns.filter((pattern) => pattern.startsWith("file:"));
    if (filePatterns.length === 0) {
      return;
    }
    try {
      await chrome.scripting.registerContentScripts([{ ...script, matches: filePatterns }]);
    } catch (retryError) {
      // File URL access is disabled in the extension settings.
    }
  }
}

function toMatchPattern(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") {
      return "file://" + parsed.pathname;
    }
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin + parsed.pathname;
    }
  } catch (error) {
    // Unparseable URLs cannot be auto-restored.
  }
  return null;
}
