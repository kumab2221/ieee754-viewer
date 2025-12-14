// src/domain/parseFloatingInput.ts
// Domain: 入力文字列を「Valid / Incomplete / Invalid」に分類し、Validなら数値に変換する。
// - UIの途中入力を壊さないために Incomplete を明確に返す。
// - ここでは四則演算は扱わない（将来ここを ExpressionParser に差し替える）。

/**
 * パース結果の状態を表す型
 * - Valid: 有効な数値として解釈可能
 * - Incomplete: 途中入力（例: "-", "1e", "1e+", ".", "-."）
 * - Invalid: 無効な入力
 */
export type ParseKind = "Valid" | "Incomplete" | "Invalid";

/**
 * パース結果を表す型
 *
 * 判別可能なユニオン型で3つの状態を表現:
 * - Valid: パースに成功し、数値に変換できた
 * - Incomplete: 途中入力状態（エラーではない）
 * - Invalid: 無効な入力（構文エラー）
 */
export type ParseResult =
  | {
      /** パースに成功（有効な数値） */
      kind: "Valid";
      /** パースされた数値（JavaScriptのnumber = IEEE 754 binary64） */
      value: number;            // JS number (double)
      /** 正規化後のテキスト（例: "+1" → "1", "inf" → "Infinity"） */
      normalizedText: string;   // 正規化後テキスト（Infinity表記など）
    }
  | {
      /** 途中入力（例: "-", "1e+", "."） */
      kind: "Incomplete";
      /** 途中状態の理由（例: "sign only", "exponent marker only"） */
      reason: string;
      /** 入力を軽く正規化したテキスト（trim済み） */
      normalizedText: string;   // 入力を軽く正規化したもの（trim等）
    }
  | {
      /** 無効な入力（構文エラー） */
      kind: "Invalid";
      /** 無効な理由（例: "invalid numeric syntax"） */
      reason: string;
      /** 入力を軽く正規化したテキスト */
      normalizedText: string;
    };

/**
 * パーサーのオプション設定
 *
 * 入力許容範囲をカスタマイズ可能
 */
export type ParseOptions = {
  /** 先頭の "+" 記号を許可するか（デフォルト: true） */
  allowLeadingPlus?: boolean;   // default true
  /** Inf / Infinity を許可するか（デフォルト: true） */
  allowInfinitySynonyms?: boolean; // default true: Inf / Infinity
  /** NaN を許可するか（デフォルト: true） */
  allowNaN?: boolean;           // default true
  /** 特殊値（NaN, Inf, Infinity）の大文字小文字を区別しないか（デフォルト: true） */
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

/**
 * 数値テキストを軽く正規化する
 *
 * 過度な正規化は行わず、最小限の処理のみ実施
 * （詳細な表示整形はUI層で行う）
 *
 * @param text 入力テキスト
 * @param o オプション設定
 * @returns 正規化されたテキスト
 */
function normalizeNumericText(text: string, o: Required<ParseOptions>): string {
  // ここでは過度な正規化はしない（表示はUI層で整える）
  // 例: "+1" を "1" にする程度はOK
  if (o.allowLeadingPlus && text.startsWith("+")) return text.slice(1);
  return text;
}

/**
 * 特殊値（NaN, Inf, Infinity）のパース処理
 *
 * 符号付き特殊値にも対応（例: "-Infinity", "+NaN"）
 * 途中入力も検出（例: "i", "in", "na"）
 *
 * @param text 入力テキスト（trim済み）
 * @param o オプション設定
 * @returns パース結果（特殊値でない場合はnull）
 */
function parseSpecial(text: string, o: Required<ParseOptions>): ParseResult | null {
  // 符号を分離（例: "-Infinity" → sign="-", body="Infinity"）
  const m = text.match(/^([+-])?(.*)$/);
  if (!m) {return null;}

  const sign = m[1] ?? "";
  const body = m[2];

  // 大文字小文字を区別しない場合は小文字化して比較
  const cmp = o.caseInsensitiveSpecials ? body.toLowerCase() : body;

  // ========== NaN の処理 ==========
  if (o.allowNaN) {
    // "NaN" または "nan"（大文字小文字設定に応じて）
    if (cmp === (o.caseInsensitiveSpecials ? "nan" : "NaN")) {
      // JavaScriptでは符号付きNaNもただのNaN（符号は無視される）
      return { kind: "Valid", value: Number.NaN, normalizedText: sign + "NaN" };
    }
    // 途中入力の検出: "n" "na"（"nan"の途中）
    if (o.caseInsensitiveSpecials) {
      if ("nan".startsWith(cmp) && cmp.length < 3 && isAlphaOnly(body)) {
        return { kind: "Incomplete", reason: "incomplete NaN token", normalizedText: text };
      }
    } else {
      // case-sensitive扱いをするなら途中入力判定はやめる（仕様が面倒になる）
    }
  }

  // ========== Infinity / Inf の処理 ==========
  if (o.allowInfinitySynonyms) {
    // 大文字小文字設定に応じて許可するトークンを決定
    const infTokens = o.caseInsensitiveSpecials
      ? ["inf", "infinity"]
      : ["Inf", "Infinity"];

    // 完全一致チェック（"Inf" または "Infinity"）
    const isFull =
      infTokens.some(t => cmp === t);

    if (isFull) {
      // 符号に応じて +Infinity または -Infinity を返す
      const v = sign === "-" ? -Infinity : Infinity;
      return { kind: "Valid", value: v, normalizedText: (sign || "") + "Infinity" };
    }

    // 途中入力の検出: "i" "in" "infi" "infin" など（"infinity"の途中）
    if (o.caseInsensitiveSpecials && isAlphaOnly(body)) {
      const target = "infinity";
      if (target.startsWith(cmp) && cmp.length < target.length) {
        return { kind: "Incomplete", reason: "incomplete Infinity token", normalizedText: text };
      }
      // "inf" も Validだが、"i" "in"は途中扱い
      if ("inf".startsWith(cmp) && cmp.length < 3) {
        return { kind: "Incomplete", reason: "incomplete Inf token", normalizedText: text };
      }
    }
  }

  // 特殊値にマッチしなかった
  return null;
}

/**
 * 文字列がアルファベットのみで構成されているか判定
 * @param s 判定対象の文字列
 * @returns アルファベットのみの場合true
 */
function isAlphaOnly(s: string): boolean {
  return /^[A-Za-z]+$/.test(s);
}

/**
 * 途中入力として許容するトークンを判定
 *
 * ユーザーが入力中の状態を検出し、エラー表示を抑制する
 * これにより自然な入力体験を提供できる
 *
 * 検出パターン:
 * - 符号のみ: "-", "+"
 * - 小数点のみ: ".", "-.", "+."
 * - 指数マーカーのみ: "1e", "1.5e", ".5e"
 * - 指数符号のみ: "1e+", "1e-"
 *
 * @param text 入力テキスト（trim済み）
 * @param o オプション設定
 * @returns 途中入力の場合は理由文字列、そうでない場合はnull
 */
function isIncompleteNumberToken(text: string, o: Required<ParseOptions>): string | null {
  // 符号だけ（"-" または "+"）
  if (text === "-" || (o.allowLeadingPlus && text === "+")) return "sign only";

  // 小数点だけ / 符号 + 小数点だけ（".", "-.", "+."）
  if (text === "." || text === "-." || (o.allowLeadingPlus && text === "+.")) return "dot only";

  // 指数マーカーだけ（例: "1e", "1.5e", ".5e"）
  // ただし "1e0" は Valid なので除外される
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)[eE]$/.test(text)) return "exponent marker only";

  // 指数符号だけ（例: "1e+", "1e-"）
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)[eE][+-]$/.test(text)) return "exponent sign only";

  // 途中入力ではない
  return null;
}

/**
 * 十進数 + 指数表記の構文が妥当か検証
 *
 * 許可される構文:
 * - 符号: [+/-] (optional)
 * - 仮数部:
 *   - 整数形式: 123
 *   - 小数点あり: 123., 123.45
 *   - 小数点始まり: .45
 * - 指数部: e[+/-]?digits または E[+/-]?digits (optional)
 *
 * 例:
 * - "123" ✓
 * - "-123.45" ✓
 * - ".5" ✓
 * - "1e10" ✓
 * - "1.5e-3" ✓
 * - "+123" ✓ (allowLeadingPlus=trueの場合)
 *
 * @param text 入力テキスト（trim済み）
 * @param o オプション設定
 * @returns 構文が妥当な場合true
 */
function isValidDecimalNumberSyntax(text: string, o: Required<ParseOptions>): boolean {
  // 先頭 + を許可しない設定の場合は弾く
  if (!o.allowLeadingPlus && text.startsWith("+")) return false;

  // 正規表現で全体一致（途中入力は別で処理済み）
  // mantissa（仮数部）:
  //  - \d+(\.\d*)?  => 12, 12., 12.34
  //  - \.\d+        => .34
  // exponent（指数部）:
  //  - ([eE][+-]?\d+)? optional
  const re = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
  return re.test(text);
}
