// ==UserScript==
// @name         Quebec Capture - DuProprio
// @namespace    https://localhost:3000
// @version      0.1
// @description  Browser-assisted DuProprio capture for the local Quebec ingest pipeline.
// @match        https://duproprio.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function () {
  "use strict";

  const SOURCE = "duproprio_ca";
  const LOCAL_BASE = "http://localhost:3000";
  const INGEST_URL = `${LOCAL_BASE}/api/scrape/duproprio/ingest`;
  const MANIFEST_URL = `${LOCAL_BASE}/api/ingest/quebec-manifest`;

  let lastPayload = null;
  let lastPayloadType = "search_results";
  let activeTask = null;

  function looksLikeListingPayload(payload) {
    if (!payload) return false;
    if (Array.isArray(payload)) return payload.length > 0;
    return Boolean(payload.results || payload.items || payload.listings || payload.data || payload.property);
  }

  function request(method, url, data) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers: data ? { "Content-Type": "application/json" } : undefined,
        data: data ? JSON.stringify(data) : undefined,
        onload: (response) => {
          try {
            resolve(JSON.parse(response.responseText));
          } catch (error) {
            reject(error);
          }
        },
        onerror: reject,
      });
    });
  }

  function captureJson(payload) {
    if (!looksLikeListingPayload(payload)) return;
    lastPayload = payload;
    lastPayloadType = Array.isArray(payload) ? "search_results" : (payload.results || payload.items || payload.listings || payload.data) ? "search_results" : "listing_detail";
    updateStatus("Captured JSON payload.");
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        captureJson(await response.clone().json());
      }
    } catch (_) {}
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__captureUrl = url;
    return originalOpen.apply(this, arguments);
  };
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      try {
        const contentType = this.getResponseHeader("content-type") || "";
        if (!contentType.includes("application/json")) return;
        captureJson(JSON.parse(this.responseText));
      } catch (_) {}
    });
    return originalSend.apply(this, arguments);
  };

  const panel = document.createElement("div");
  panel.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:999999;width:320px;padding:12px;background:#0f172a;color:#e2e8f0;border-radius:14px;box-shadow:0 12px 40px rgba(15,23,42,.35);font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
  panel.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px">DuProprio capture</div>
    <div id="qc-capture-status" style="margin-bottom:8px;color:#94a3b8">Waiting for capture…</div>
    <div style="display:grid;gap:8px">
      <button id="qc-next-task" style="padding:8px;border:0;border-radius:10px;background:#1d4ed8;color:#fff">Next task</button>
      <input id="qc-segment-key" placeholder="segment key" style="padding:8px;border-radius:10px;border:1px solid #334155;background:#111827;color:#fff" />
      <input id="qc-page-number" type="number" min="1" value="1" style="padding:8px;border-radius:10px;border:1px solid #334155;background:#111827;color:#fff" />
      <label style="display:flex;align-items:center;gap:8px"><input id="qc-terminal-page" type="checkbox" /> Terminal page</label>
      <button id="qc-send-json" style="padding:8px;border:0;border-radius:10px;background:#059669;color:#fff">Send latest JSON</button>
      <button id="qc-send-html" style="padding:8px;border:0;border-radius:10px;background:#475569;color:#fff">Send page HTML</button>
      <div id="qc-task-hint" style="color:#cbd5e1"></div>
    </div>
  `;
  document.body.appendChild(panel);

  const statusEl = panel.querySelector("#qc-capture-status");
  const segmentKeyEl = panel.querySelector("#qc-segment-key");
  const pageNumberEl = panel.querySelector("#qc-page-number");
  const terminalEl = panel.querySelector("#qc-terminal-page");
  const taskHintEl = panel.querySelector("#qc-task-hint");

  function updateStatus(text) {
    statusEl.textContent = text;
  }

  async function loadNextTask() {
    updateStatus("Loading next task…");
    const response = await request("GET", `${MANIFEST_URL}?source=${SOURCE}&next=1&dueOnly=1`);
    activeTask = response.item || null;
    if (!activeTask) {
      updateStatus("No due tasks.");
      return;
    }
    segmentKeyEl.value = activeTask.segmentKey;
    pageNumberEl.value = String(activeTask.resumePageNumber || 1);
    taskHintEl.textContent = activeTask.operatorHint || "";
    updateStatus(`Loaded task ${activeTask.segmentKey}`);
  }

  async function sendCapture(payloadFormat, payload) {
    const segmentKey = segmentKeyEl.value.trim();
    if (!segmentKey) {
      updateStatus("Segment key is required.");
      return;
    }
    const pageNumber = Math.max(1, Number(pageNumberEl.value || 1));
    updateStatus("Sending capture…");
    const response = await request("POST", INGEST_URL, {
      source: SOURCE,
      captureType: payloadFormat === "json" ? lastPayloadType : "listing_detail",
      payloadFormat,
      pageUrl: location.href,
      capturedAt: new Date().toISOString(),
      segmentKey,
      pageNumber,
      market: activeTask?.market || null,
      region: activeTask?.regionLabel || activeTask?.region || null,
      lane: activeTask?.lane || null,
      isTerminalPage: Boolean(terminalEl.checked),
      payload,
    });
    updateStatus(`received=${response.received} created=${response.created} updated=${response.updated} deduped=${response.deduped} skipped=${response.skipped}`);
    if (response.browserCapture?.nextPageNumber) {
      pageNumberEl.value = String(response.browserCapture.nextPageNumber);
    }
  }

  panel.querySelector("#qc-next-task").addEventListener("click", () => loadNextTask().catch((error) => updateStatus(String(error))));
  panel.querySelector("#qc-send-json").addEventListener("click", () => {
    if (!lastPayload) {
      updateStatus("No JSON payload captured yet.");
      return;
    }
    sendCapture("json", lastPayload).catch((error) => updateStatus(String(error)));
  });
  panel.querySelector("#qc-send-html").addEventListener("click", () => {
    sendCapture("html", document.documentElement.outerHTML).catch((error) => updateStatus(String(error)));
  });
})();
