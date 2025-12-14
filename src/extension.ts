// src/extension.ts
// VSCode拡張機能のエントリーポイント
// Webviewを使用してIEEE 754ビューワーのUIを提供

import * as vscode from "vscode";
import { buildViewModel, Precision } from "./application/ieee754Usecase";

/**
 * 拡張機能のアクティベーション関数
 *
 * VSCodeが拡張機能をロードする際に呼ばれる
 * コマンド "ieee754-viewer.open" を登録し、Webviewパネルを作成
 *
 * @param context 拡張機能のコンテキスト（subscriptionsなどを管理）
 */
export function activate(context: vscode.ExtensionContext) {
  // コマンド "ieee754-viewer.open" を登録
  const disposable = vscode.commands.registerCommand("ieee754-viewer.open", () => {
    // Webviewパネルを作成
    // - viewType: 内部識別子
    // - title: パネルのタイトル
    // - column: 表示位置（ViewColumn.One = 最初のカラム）
    const panel = vscode.window.createWebviewPanel(
      "ieee754Viewer",
      "IEEE754 Viewer",
      vscode.ViewColumn.One,
      {
        enableScripts: true,              // Webview内でJavaScriptを実行可能にする
        retainContextWhenHidden: true,    // パネルが隠れても状態を保持
      }
    );

    // WebviewのHTMLコンテンツを設定
    panel.webview.html = getWebviewHtml(panel.webview);

    // 初期描画: float と double の両方を空の入力で初期化
    postRender(panel.webview, "float", "");
    postRender(panel.webview, "double", "");

    // Webviewからのメッセージを受信（ユーザーが入力した時）
    panel.webview.onDidReceiveMessage((msg) => {
      // メッセージの型チェック
      if (!msg || typeof msg !== "object") return;

      // "update" メッセージ: ユーザーが入力フィールドを変更した
      if (msg.type === "update") {
        const precision = msg.precision as Precision;
        const text = typeof msg.text === "string" ? msg.text : "";

        // 精度が有効な値かチェック
        if (precision !== "float" && precision !== "double") return;

        // ビューモデルを構築してWebviewに送信
        postRender(panel.webview, precision, text);
      }
    });
  });

  // 拡張機能が無効化される際にコマンドを破棄
  context.subscriptions.push(disposable);
}

/**
 * 拡張機能の非アクティベーション関数
 *
 * VSCodeが拡張機能をアンロードする際に呼ばれる
 * 現在は特にクリーンアップ処理は不要
 */
export function deactivate() {}

/**
 * ビューモデルを構築してWebviewに送信
 *
 * Application層のbuildViewModel関数を呼び出し、
 * 結果をpostMessageでWebviewに送る
 *
 * @param webview VSCodeのWebviewインスタンス
 * @param precision 精度（"float" または "double"）
 * @param text ユーザーが入力したテキスト
 */
function postRender(webview: vscode.Webview, precision: Precision, text: string) {
  // ビューモデルを構築
  const vm = buildViewModel(text, precision);
  // Webviewに送信（Webview側でrenderVm関数が処理）
  webview.postMessage({ type: "render", precision, vm });
}

/**
 * WebviewのHTMLコンテンツを生成
 *
 * セキュリティ:
 * - CSP（Content Security Policy）を設定してXSS攻撃を防止
 * - nonceを使用してインラインスクリプトを許可
 *
 * UI構成:
 * - 左側: float（binary32）用の入力・表示
 * - 右側: double（binary64）用の入力・表示
 * - 各カードに入力フィールドとビット情報の表示エリア
 *
 * @param webview VSCodeのWebviewインスタンス
 * @returns HTML文字列
 */
function getWebviewHtml(webview: vscode.Webview): string {
  // セキュリティ用のnonce（使い捨てトークン）を生成
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
    // VSCode APIを取得（Webview → Extension通信用）
    const vscode = acquireVsCodeApi();

    // DOM要素の取得
    const floatInput = document.getElementById("floatInput");
    const doubleInput = document.getElementById("doubleInput");
    const floatOut = document.getElementById("floatOut");
    const doubleOut = document.getElementById("doubleOut");

    // UI側での簡易的な入力フィルタ
    // 数値、NaN、Infinity関連の文字のみ許可
    // 最終的な検証はDomain層で実施
    const allowedChar = /^[0-9eE+\\-\\.aAiInNfFtTyY]$/;

    /**
     * 入力フィールドに入力制限とイベントリスナーを設定
     *
     * - beforeinput: 不正な文字の入力を防止
     * - paste: ペースト時に不正な文字をフィルタリング
     * - input: 入力のたびにExtensionに更新を要求
     *
     * @param inputEl 入力要素
     * @param precision 精度（"float" または "double"）
     */
    function attachGuards(inputEl, precision) {
      // 文字入力前のイベント（入力防止に使用）
      inputEl.addEventListener("beforeinput", (ev) => {
        if (typeof ev.data === "string" && ev.data.length > 0) {
          // 入力される各文字をチェック
          for (const ch of ev.data) {
            if (!allowedChar.test(ch)) {
              ev.preventDefault();  // 不正な文字の入力を阻止
              return;
            }
          }
        }
      });

      // ペーストイベント（不正な文字をフィルタリング）
      inputEl.addEventListener("paste", (ev) => {
        const text = (ev.clipboardData || window.clipboardData)?.getData("text") || "";
        const filtered = [...text].filter(ch => allowedChar.test(ch)).join("");
        // ペースト内容に不正な文字が含まれていた場合
        if (filtered !== text) {
          ev.preventDefault();
          // フィルタリング後のテキストを手動で挿入
          const start = inputEl.selectionStart ?? inputEl.value.length;
          const end = inputEl.selectionEnd ?? inputEl.value.length;
          const next = inputEl.value.slice(0, start) + filtered + inputEl.value.slice(end);
          inputEl.value = next;
          requestUpdate(precision, next);
        }
      });

      // 入力イベント（入力のたびに発火）
      inputEl.addEventListener("input", () => {
        requestUpdate(precision, inputEl.value);
      });
    }

    /**
     * Extensionに更新を要求
     *
     * postMessageでExtension側にメッセージを送信
     * Extension側でbuildViewModelが呼ばれ、結果が返ってくる
     *
     * @param precision 精度（"float" または "double"）
     * @param text 入力テキスト
     */
    function requestUpdate(precision, text) {
      vscode.postMessage({ type: "update", precision, text });
    }

    /**
     * ビューモデルをHTMLにレンダリング
     *
     * 状態に応じて表示内容を切り替え:
     * - Incomplete: 途中入力メッセージ（グレー表示）
     * - Invalid: エラーメッセージ（赤表示）
     * - Valid: ビット情報の詳細表示
     *
     * @param vm ビューモデル
     * @returns HTML文字列
     */
    function renderVm(vm) {
      if (!vm) return "<div class='muted'>No data</div>";

      // 途中入力の場合
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

      // 有効な数値の場合: ビット情報を詳細に表示
      const b = vm.bits;

      // 基本情報（state, kind, hex, bits, s/e/m, exponent）
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

      // 仮数部の詳細情報（精度によって表示内容が異なる）
      let mantissaExtra = "";
      if (vm.precision === "float") {
        // float32: 23ビットを1つの整数値として表示
        mantissaExtra = \`
          <div class="kv mono" style="margin-top:8px;">
            <div class="k">mantissa (uint)</div><div class="v">\${b.mantissaBits}</div>
          </div>
        \`;
      } else {
        // float64: 52ビットを上位20ビット+下位32ビットに分けて表示
        mantissaExtra = \`
          <div class="kv mono" style="margin-top:8px;">
            <div class="k">mantissaHigh(20)</div><div class="v">\${b.mantissaHigh}</div>
            <div class="k">mantissaLow(32)</div><div class="v">\${b.mantissaLow}</div>
          </div>
        \`;
      }

      // NaNの場合のみペイロード情報を表示
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

    /**
     * HTMLエスケープ処理
     *
     * XSS攻撃を防ぐために特殊文字をエスケープ
     *
     * @param s エスケープする文字列
     * @returns エスケープされた文字列
     */
    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    // Extensionからのメッセージを受信（ビューモデルの更新）
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg || msg.type !== "render") return;

      // 精度に応じて適切な出力エリアに描画
      if (msg.precision === "float") {
        floatOut.innerHTML = renderVm(msg.vm);
      } else if (msg.precision === "double") {
        doubleOut.innerHTML = renderVm(msg.vm);
      }
    });

    // 入力フィールドにイベントリスナーを設定
    attachGuards(floatInput, "float");
    attachGuards(doubleInput, "double");

    // 初期描画を要求（空の入力で開始）
    requestUpdate("float", floatInput.value || "");
    requestUpdate("double", doubleInput.value || "");
  </script>
</body>
</html>`;
}

/**
 * セキュリティ用のnonce（使い捨トークン）を生成
 *
 * CSPでインラインスクリプトを許可するために使用
 * ランダムな32文字の英数字文字列を生成
 *
 * @returns nonce文字列
 */
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
