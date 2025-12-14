import * as vscode from "vscode";
import { buildViewModel, Precision } from "./application/ieee754Usecase";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("ieee754-viewer.open", () => {
    const panel = vscode.window.createWebviewPanel(
      "ieee754Viewer",
      "IEEE754 Viewer",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = getWebviewHtml(panel.webview);

    // Initial render
    postRender(panel.webview, "float", "");
    postRender(panel.webview, "double", "");

    panel.webview.onDidReceiveMessage((msg) => {
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "update") {
        const precision = msg.precision as Precision;
        const text = typeof msg.text === "string" ? msg.text : "";
        if (precision !== "float" && precision !== "double") return;

        postRender(panel.webview, precision, text);
      }
    });
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}

function postRender(webview: vscode.Webview, precision: Precision, text: string) {
  const vm = buildViewModel(text, precision);
  webview.postMessage({ type: "render", precision, vm });
}

function getWebviewHtml(webview: vscode.Webview): string {
  const nonce = getNonce();

  return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
  />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IEEE754 Viewer</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 1px solid rgba(127,127,127,0.35); border-radius: 10px; padding: 12px; }
    .row { display: grid; grid-template-columns: 110px 1fr; gap: 10px; align-items: center; margin: 6px 0; }
    input { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.35); background: transparent; color: inherit; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; white-space: pre-wrap; word-break: break-all; }
    .muted { opacity: 0.75; }
    .err { color: var(--vscode-errorForeground); }
    .kv { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin-top: 8px; }
    .kv > div { padding: 4px 0; border-bottom: 1px dashed rgba(127,127,127,0.25); }
    .kv .k { opacity: 0.8; }
    .sectionTitle { font-weight: 600; margin-bottom: 8px; }
    .hint { font-size: 12px; opacity: 0.8; margin-top: 6px; }
  </style>
</head>

<body>
  <div class="grid">
    <div class="card">
      <div class="sectionTitle">float (IEEE754 binary32)</div>
      <div class="row">
        <div class="muted">Input</div>
        <input id="floatInput" spellcheck="false" placeholder='e.g. -1.25, 1e-3, NaN, Inf' />
      </div>
      <div class="hint mono muted">Allowed: digits . + - e E NaN Inf Infinity (case-insensitive)</div>
      <hr style="border:none;border-top:1px solid rgba(127,127,127,0.25); margin:12px 0;" />
      <div id="floatOut"></div>
    </div>

    <div class="card">
      <div class="sectionTitle">double (IEEE754 binary64)</div>
      <div class="row">
        <div class="muted">Input</div>
        <input id="doubleInput" spellcheck="false" placeholder='e.g. -1.25, 1e-3, NaN, Inf' />
      </div>
      <div class="hint mono muted">Allowed: digits . + - e E NaN Inf Infinity (case-insensitive)</div>
      <hr style="border:none;border-top:1px solid rgba(127,127,127,0.25); margin:12px 0;" />
      <div id="doubleOut"></div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const floatInput = document.getElementById("floatInput");
    const doubleInput = document.getElementById("doubleInput");
    const floatOut = document.getElementById("floatOut");
    const doubleOut = document.getElementById("doubleOut");

    // UI filter: allow only characters that could be part of numeric / NaN / Inf / Infinity.
    // Final validation is in Domain.
    const allowedChar = /^[0-9eE+\\-\\.aAiInNfFtTyY]$/;

    function attachGuards(inputEl, precision) {
      inputEl.addEventListener("beforeinput", (ev) => {
        if (typeof ev.data === "string" && ev.data.length > 0) {
          for (const ch of ev.data) {
            if (!allowedChar.test(ch)) {
              ev.preventDefault();
              return;
            }
          }
        }
      });

      inputEl.addEventListener("paste", (ev) => {
        const text = (ev.clipboardData || window.clipboardData)?.getData("text") || "";
        const filtered = [...text].filter(ch => allowedChar.test(ch)).join("");
        if (filtered !== text) {
          ev.preventDefault();
          const start = inputEl.selectionStart ?? inputEl.value.length;
          const end = inputEl.selectionEnd ?? inputEl.value.length;
          const next = inputEl.value.slice(0, start) + filtered + inputEl.value.slice(end);
          inputEl.value = next;
          requestUpdate(precision, next);
        }
      });

      inputEl.addEventListener("input", () => {
        requestUpdate(precision, inputEl.value);
      });
    }

    function requestUpdate(precision, text) {
      vscode.postMessage({ type: "update", precision, text });
    }

    function renderVm(vm) {
      if (!vm) return "<div class='muted'>No data</div>";

      if (vm.state === "Incomplete") {
        return \`
          <div class="mono">
            <div class="muted">State: Incomplete</div>
            <div class="muted">Reason: \${escapeHtml(vm.message || "")}</div>
          </div>
        \`;
      }

      if (vm.state === "Invalid") {
        return \`
          <div class="mono err">
            <div>State: Invalid</div>
            <div>Reason: \${escapeHtml(vm.message || "")}</div>
          </div>
        \`;
      }

      // Valid
      const b = vm.bits;

      const base = \`
        <div class="kv mono">
          <div class="k">state</div><div class="v">Valid</div>
          <div class="k">normalized</div><div class="v">\${escapeHtml(vm.normalizedText)}</div>
          <div class="k">kind</div><div class="v">\${escapeHtml(b.kind)}</div>

          <div class="k">hex (bytes)</div><div class="v">\${escapeHtml(b.hexGrouped)}</div>
          <div class="k">bits (bytes)</div><div class="v">\${escapeHtml(b.bitsGrouped8)}</div>

          <div class="k">s</div><div class="v">\${escapeHtml(b.signBitsStr)}</div>
          <div class="k">e</div><div class="v">\${escapeHtml(b.exponentGrouped4)}</div>
          <div class="k">m</div><div class="v">\${escapeHtml(b.mantissaGrouped4)}</div>

          <div class="k">exponent(bits)</div><div class="v">\${b.exponentBits}</div>
          <div class="k">exponent(unbiased)</div><div class="v">\${b.exponentUnbiased === null ? "-" : b.exponentUnbiased}</div>
        </div>
      \`;

      let mantissaExtra = "";
      if (vm.precision === "float") {
        mantissaExtra = \`
          <div class="kv mono" style="margin-top:8px;">
            <div class="k">mantissa (uint)</div><div class="v">\${b.mantissaBits}</div>
          </div>
        \`;
      } else {
        mantissaExtra = \`
          <div class="kv mono" style="margin-top:8px;">
            <div class="k">mantissaHigh(20)</div><div class="v">\${b.mantissaHigh}</div>
            <div class="k">mantissaLow(32)</div><div class="v">\${b.mantissaLow}</div>
          </div>
        \`;
      }

      let nanPayload = "";
      if (b.kind === "NaN") {
        nanPayload = \`
          <div class="kv mono" style="margin-top:8px;">
            <div class="k">NaN payload (bits)</div><div class="v">\${escapeHtml(b.payloadGrouped4)}</div>
            <div class="k">NaN payload (hex)</div><div class="v">\${escapeHtml(b.payloadHexPadded)}</div>
          </div>
        \`;
      }

      return base + mantissaExtra + nanPayload;
    }

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg || msg.type !== "render") return;

      if (msg.precision === "float") {
        floatOut.innerHTML = renderVm(msg.vm);
      } else if (msg.precision === "double") {
        doubleOut.innerHTML = renderVm(msg.vm);
      }
    });

    attachGuards(floatInput, "float");
    attachGuards(doubleInput, "double");

    // initial
    requestUpdate("float", floatInput.value || "");
    requestUpdate("double", doubleInput.value || "");
  </script>
</body>
</html>`;
}

function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
