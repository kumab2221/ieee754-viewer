// src/domain/parseFloatingInput.ts
// Domain: 入力文字列を「Valid / Incomplete / Invalid」に分類し、Validなら数値に変換する。
// - UIの途中入力を壊さないために Incomplete を明確に返す。
// - ここでは四則演算は扱わない（将来ここを ExpressionParser に差し替える）。

export type ParseKind = "Valid" | "Incomplete" | "Invalid";

export type ParseResult =
  | {
      kind: "Valid";
      value: number;            // JS number (double)
      normalizedText: string;   // 正規化後テキスト（Infinity表記など）
    }
  | {
      kind: "Incomplete";
      reason: string;
      normalizedText: string;   // 入力を軽く正規化したもの（trim等）
    }
  | {
      kind: "Invalid";
      reason: string;
      normalizedText: string;
    };

export type ParseOptions = {
  allowLeadingPlus?: boolean;   // default true
  allowInfinitySynonyms?: boolean; // default true: Inf / Infinity
  allowNaN?: boolean;           // default true
  caseInsensitiveSpecials?: boolean; // default true
};

const defaultOptions: Required<ParseOptions> = {
  allowLeadingPlus: true,
  allowInfinitySynonyms: true,
  allowNaN: true,
  caseInsensitiveSpecials: true,
};

/**
 * 入力を float/double 用としてパース可能か判定する。
 * - Valid: Numberとして解釈でき、Infinity/NaN等も許容
 * - Incomplete: 途中入力として許容（例: "-", "1e", "1e+", ".", "-."）
 * - Invalid: 明確に不正
 */
export function ParseFloatingInput(input: string, opts: ParseOptions = {}): ParseResult {
  const o = { ...defaultOptions, ...opts };

  const raw = input;
  const text = raw.trim();

  // 空は途中入力扱い（UIで何も入ってない状態）
  if (text.length === 0) {
    return { kind: "Incomplete", reason: "empty", normalizedText: "" };
  }

  // 先頭に + を許可しない設定の場合
  if (!o.allowLeadingPlus && text.startsWith("+")) {
    return { kind: "Invalid", reason: "leading plus is not allowed", normalizedText: text };
  }

  // まずは特殊値（NaN / Inf / Infinity）を処理
  const special = parseSpecial(text, o);
  if (special) {return special;}

  // 途中入力（符号だけ、小数点だけ、指数の途中）を先に判定
  const incomplete = isIncompleteNumberToken(text, o);
  if (incomplete) {
    return { kind: "Incomplete", reason: incomplete, normalizedText: text };
  }

  // 数値として妥当な構文か（十進 + 指数）
  if (!isValidDecimalNumberSyntax(text, o)) {
    return { kind: "Invalid", reason: "invalid numeric syntax", normalizedText: text };
  }

  // JS の Number でパース（ここで 1e309 は Infinity になる等）
  const value = Number(text);

  // Number() が NaN を返すのは構文は通っても数値化できないケースだが、上の構文チェックで基本排除される。
  if (Number.isNaN(value)) {
    // "NaN" は special で捕まえるので、ここに来たら基本 invalid
    return { kind: "Invalid", reason: "parsed to NaN", normalizedText: text };
  }

  // Infinity を許可しないなら弾く
  if (!o.allowInfinitySynonyms && !Number.isFinite(value)) {
    return { kind: "Invalid", reason: "infinity is not allowed", normalizedText: text };
  }

  return { kind: "Valid", value, normalizedText: normalizeNumericText(text, o) };
}

/* -------------------- helpers -------------------- */

function normalizeNumericText(text: string, o: Required<ParseOptions>): string {
  // ここでは過度な正規化はしない（表示はUI層で整える）
  // 例: "+1" を "1" にする程度はOK
  if (o.allowLeadingPlus && text.startsWith("+")) return text.slice(1);
  return text;
}

function parseSpecial(text: string, o: Required<ParseOptions>): ParseResult | null {
  // 符号を分離
  const m = text.match(/^([+-])?(.*)$/);
  if (!m) {return null;}

  const sign = m[1] ?? "";
  const body = m[2];

  const cmp = o.caseInsensitiveSpecials ? body.toLowerCase() : body;

  // NaN
  if (o.allowNaN) {
    if (cmp === (o.caseInsensitiveSpecials ? "nan" : "NaN")) {
      // JS的には符号付きNaNも NaN
      return { kind: "Valid", value: Number.NaN, normalizedText: sign + "NaN" };
    }
    // 途中入力: "n" "na"
    if (o.caseInsensitiveSpecials) {
      if ("nan".startsWith(cmp) && cmp.length < 3 && isAlphaOnly(body)) {
        return { kind: "Incomplete", reason: "incomplete NaN token", normalizedText: text };
      }
    } else {
      // case-sensitive扱いをするなら途中入力判定はやめる（仕様が面倒になる）
    }
  }

  // Infinity / Inf
  if (o.allowInfinitySynonyms) {
    const infTokens = o.caseInsensitiveSpecials
      ? ["inf", "infinity"]
      : ["Inf", "Infinity"];

    const isFull =
      infTokens.some(t => cmp === t);

    if (isFull) {
      const v = sign === "-" ? -Infinity : Infinity;
      return { kind: "Valid", value: v, normalizedText: (sign || "") + "Infinity" };
    }

    // 途中入力: "i" "in" "inf" 未満や "infi" など
    if (o.caseInsensitiveSpecials && isAlphaOnly(body)) {
      const target = "infinity";
      if (target.startsWith(cmp) && cmp.length < target.length) {
        return { kind: "Incomplete", reason: "incomplete Infinity token", normalizedText: text };
      }
      // "inf" も途中扱い（ただし "inf" は Valid にしたいので cmp<3 のみ）
      if ("inf".startsWith(cmp) && cmp.length < 3) {
        return { kind: "Incomplete", reason: "incomplete Inf token", normalizedText: text };
      }
    }
  }

  return null;
}

function isAlphaOnly(s: string): boolean {
  return /^[A-Za-z]+$/.test(s);
}

/**
 * 途中入力として許容するものを判定する。
 * - "", "+", "-", ".", "-.", "+." 等
 * - "1e", "1e+", "1e-" 等
 */
function isIncompleteNumberToken(text: string, o: Required<ParseOptions>): string | null {
  // 符号だけ
  if (text === "-" || (o.allowLeadingPlus && text === "+")) return "sign only";

  // 小数点だけ / 符号 + 小数点だけ
  if (text === "." || text === "-." || (o.allowLeadingPlus && text === "+.")) return "dot only";

  // 指数の途中（例: 1e, 1e+, 1e-）
  // ただし 1e0 は Valid
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)[eE]$/.test(text)) return "exponent marker only";
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)[eE][+-]$/.test(text)) return "exponent sign only";

  return null;
}

/**
 * 十進数 + 指数表記を許可した構文チェック。
 * - 先頭符号 optional
 * - 仮数部: 123, 123., 123.45, .45
 * - 指数部: e[+/-]?digits
 */
function isValidDecimalNumberSyntax(text: string, o: Required<ParseOptions>): boolean {
  // 先頭 + を許可しないなら弾く
  if (!o.allowLeadingPlus && text.startsWith("+")) return false;

  // 正規表現で全体一致（途中入力は別で処理済み）
  // mantissa:
  //  - \d+(\.\d*)?  => 12, 12., 12.34
  //  - \.\d+        => .34
  // exponent:
  //  - ([eE][+-]?\d+)? optional
  const re = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
  return re.test(text);
}
