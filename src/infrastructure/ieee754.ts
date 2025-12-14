// src/infrastructure/ieee754.ts
// IEEE 754浮動小数点数のビット操作を提供するインフラストラクチャ層
// - float32（binary32）: 32ビット単精度浮動小数点数
// - float64（binary64）: 64ビット倍精度浮動小数点数
// それぞれのビット構造を詳細に解析し、UI表示用の情報を生成する

/**
 * IEEE 754浮動小数点数の分類
 * - Zero: ゼロ（指数部=0, 仮数部=0）
 * - Subnormal: 非正規化数（指数部=0, 仮数部≠0）
 * - Normal: 正規化数（指数部が0と最大値以外）
 * - Infinity: 無限大（指数部=最大, 仮数部=0）
 * - NaN: 非数（指数部=最大, 仮数部≠0）
 */
export type FloatKind = "Zero" | "Subnormal" | "Normal" | "Infinity" | "NaN";

/**
 * IEEE 754 binary32（float32）のビット情報
 *
 * ビット構造（32ビット）:
 * - 符号ビット（s）: 1ビット（最上位ビット）
 * - 指数部（e）: 8ビット（バイアス=127）
 * - 仮数部（m）: 23ビット
 *
 * フォーマット: seeeeeee emmmmmmm mmmmmmmm mmmmmmmm
 */
export type Float32BitsInfo = {
  /** 浮動小数点数の分類 */
  kind: FloatKind;

  /** 符号ビット（0=正, 1=負） */
  signBit: 0 | 1;
  /** 指数部のビット値（0..255）バイアス込み */
  exponentBits: number; // 0..255
  /** 仮数部のビット値（0..(2^23-1)） */
  mantissaBits: number; // 0..(2^23-1)
  /** バイアスを除去した指数（Normal/Subnormalのみ、それ以外はnull） */
  exponentUnbiased: number | null;

  // ========== 生データ ==========
  /** 16進数表現（8文字、スペースなし）例: "3f800000" */
  hex: string;      // 8 hex chars (no spaces)
  /** ビット列全体（32ビット、スペースなし）例: "00111111100000000000000000000000" */
  bits: string;     // 32 bits (no spaces)

  // ========== UI表示用にグループ化されたデータ ==========
  /** バイト単位で区切った16進数 例: "3f 80 00 00" */
  hexGrouped: string;       // "3f 80 00 00"
  /** バイト単位で区切ったビット列 例: "00111111 10000000 00000000 00000000" */
  bitsGrouped8: string;     // "00111111 10000000 ..."

  /** 符号ビットの文字列（"0" または "1"） */
  signBitsStr: string;      // "0" or "1"
  /** 指数部のビット列（8ビット） */
  exponentBitsStr: string;  // 8 bits
  /** 仮数部のビット列（23ビット） */
  mantissaBitsStr: string;  // 23 bits

  /** 指数部を4ビットで区切った表現 例: "0111 1111" */
  exponentGrouped4: string; // "0111 1111"
  /** 仮数部を4ビットで区切った表現（最後のグループは3ビット）例: "0000 0000 0000 0000 0000 000" */
  mantissaGrouped4: string; // "0000 0000 ... 000" (last group may be shorter)

  // ========== NaN用のペイロード情報 ==========
  /** NaNペイロード（仮数部と同じ） */
  payloadBitsStr: string;       // same as mantissaBitsStr
  /** NaNペイロードを4ビットで区切った表現 */
  payloadGrouped4: string;      // same as mantissaGrouped4
  /** NaNペイロードの16進数（6桁、ゼロパディング済み） */
  payloadHexPadded: string;     // 6 hex digits (ceil(23/4)=6)
};

/**
 * IEEE 754 binary64（float64）のビット情報
 *
 * ビット構造（64ビット）:
 * - 符号ビット（s）: 1ビット（最上位ビット）
 * - 指数部（e）: 11ビット（バイアス=1023）
 * - 仮数部（m）: 52ビット
 *
 * フォーマット: seeeeeee eeeemmmm mmmmmmmm ... mmmmmmmm
 *
 * 注: JavaScriptのnumber型はこの形式（IEEE 754 binary64）
 */
export type Float64BitsInfo = {
  /** 浮動小数点数の分類 */
  kind: FloatKind;

  /** 符号ビット（0=正, 1=負） */
  signBit: 0 | 1;
  /** 指数部のビット値（0..2047）バイアス込み */
  exponentBits: number; // 0..2047
  /** 仮数部の上位20ビット */
  mantissaHigh: number; // upper 20 bits
  /** 仮数部の下位32ビット */
  mantissaLow: number;  // lower 32 bits
  /** バイアスを除去した指数（Normal/Subnormalのみ、それ以外はnull） */
  exponentUnbiased: number | null;

  // ========== 生データ ==========
  /** 16進数表現（16文字、スペースなし）例: "3ff0000000000000" */
  hex: string;   // 16 hex chars
  /** ビット列全体（64ビット、スペースなし） */
  bits: string;  // 64 bits

  // ========== UI表示用にグループ化されたデータ ==========
  /** バイト単位で区切った16進数 例: "3f f0 00 00 00 00 00 00" */
  hexGrouped: string;    // "3f f0 00 00 00 00 00 00"
  /** バイト単位で区切ったビット列 例: "00111111 11110000 ..." */
  bitsGrouped8: string;  // "00111111 11110000 ..."

  /** 符号ビットの文字列（"0" または "1"） */
  signBitsStr: string;      // "0"/"1"
  /** 指数部のビット列（11ビット） */
  exponentBitsStr: string;  // 11 bits
  /** 仮数部のビット列（52ビット） */
  mantissaBitsStr: string;  // 52 bits

  /** 指数部を4ビットで区切った表現（先頭は3ビット）例: "011 1111 1111" */
  exponentGrouped4: string; // "011 1111 1111" (先頭が3bitになる)
  /** 仮数部を4ビットで区切った表現 */
  mantissaGrouped4: string; // 4bit区切り

  // ========== NaN用のペイロード情報 ==========
  /** NaNペイロード（仮数部と同じ） */
  payloadBitsStr: string;       // same as mantissaBitsStr
  /** NaNペイロードを4ビットで区切った表現 */
  payloadGrouped4: string;      // same as mantissaGrouped4
  /** NaNペイロードの16進数（13桁、52ビット÷4=13） */
  payloadHexPadded: string;     // 13 hex digits (52/4=13)
};

/**
 * 32ビット符号なし整数をビット文字列（32桁）に変換
 * @param u32 32ビット符号なし整数
 * @returns "00000000000000000000000000000000" 形式の文字列
 */
function toBitsString32(u32: number): string {
  return (u32 >>> 0).toString(2).padStart(32, "0");
}

/**
 * 32ビット符号なし整数を16進数文字列（8桁）に変換
 * @param u32 32ビット符号なし整数
 * @returns "00000000" 形式の文字列
 */
function toHex32(u32: number): string {
  return (u32 >>> 0).toString(16).padStart(8, "0");
}

/**
 * 64ビットを上位32ビットと下位32ビットから16進数文字列（16桁）に変換
 * @param hi 上位32ビット
 * @param lo 下位32ビット
 * @returns "0000000000000000" 形式の文字列
 */
function toHex64(hi: number, lo: number): string {
  return toHex32(hi) + toHex32(lo);
}

/**
 * 64ビットを上位32ビットと下位32ビットからビット文字列（64桁）に変換
 * @param hi 上位32ビット
 * @param lo 下位32ビット
 * @returns 64桁のビット文字列
 */
function toBitsString64(hi: number, lo: number): string {
  return toBitsString32(hi) + toBitsString32(lo);
}

/**
 * 文字列をn文字ごとに区切る
 * @param s 対象文字列
 * @param n 区切り文字数
 * @param sep 区切り文字（デフォルトは半角スペース）
 * @returns 区切られた文字列 例: "12345678" → "1234 5678" (n=4)
 */
function groupEvery(s: string, n: number, sep = " "): string {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.join(sep);
}

/**
 * 文字列を左からn文字ごとに区切る（最後のグループは短くなる可能性あり）
 * @param s 対象文字列
 * @param group 区切り文字数
 * @param sep 区切り文字（デフォルトは半角スペース）
 * @returns 区切られた文字列 例: "12345678901" → "1234 5678 901" (group=4)
 */
function groupWithRemainderAtEnd(s: string, group: number, sep = " "): string {
  // 左から group で切っていき、最後が余れば短いグループとして残す
  return groupEvery(s, group, sep);
}

/**
 * float32の指数部と仮数部から浮動小数点数の分類を判定
 *
 * IEEE 754の分類ルール:
 * - 指数=0, 仮数=0 → Zero（ゼロ）
 * - 指数=0, 仮数≠0 → Subnormal（非正規化数）
 * - 指数=最大(255), 仮数=0 → Infinity（無限大）
 * - 指数=最大(255), 仮数≠0 → NaN（非数）
 * - それ以外 → Normal（正規化数）
 *
 * @param exp 指数部のビット値（0..255）
 * @param mant 仮数部のビット値
 * @returns 浮動小数点数の分類
 */
function classifyFloat32(exp: number, mant: number): FloatKind {
  if (exp === 0) return mant === 0 ? "Zero" : "Subnormal";
  if (exp === 0xff) return mant === 0 ? "Infinity" : "NaN";
  return "Normal";
}

/**
 * float64の指数部と仮数部から浮動小数点数の分類を判定
 *
 * IEEE 754の分類ルール（float64版）:
 * - 指数=0, 仮数=0 → Zero（ゼロ）
 * - 指数=0, 仮数≠0 → Subnormal（非正規化数）
 * - 指数=最大(2047), 仮数=0 → Infinity（無限大）
 * - 指数=最大(2047), 仮数≠0 → NaN（非数）
 * - それ以外 → Normal（正規化数）
 *
 * @param exp 指数部のビット値（0..2047）
 * @param mantHi 仮数部の上位20ビット
 * @param mantLo 仮数部の下位32ビット
 * @returns 浮動小数点数の分類
 */
function classifyFloat64(exp: number, mantHi: number, mantLo: number): FloatKind {
  const mantIsZero = mantHi === 0 && mantLo === 0;
  if (exp === 0) return mantIsZero ? "Zero" : "Subnormal";
  if (exp === 0x7ff) return mantIsZero ? "Infinity" : "NaN";
  return "Normal";
}

/**
 * ビット文字列を16進数文字列に変換（必要に応じて左側をゼロパディング）
 *
 * 4ビット単位で16進数に変換するため、ビット長が4の倍数でない場合は
 * 左側に0を追加してから変換する
 *
 * @param bits ビット文字列 例: "10111001"
 * @returns 16進数文字列 例: "b9"
 */
function bitsToHexPadded(bits: string): string {
  // bits を 4bit単位に右端で切って hex にする（必要なら左を0でパディング）
  const pad = (4 - (bits.length % 4)) % 4;
  const padded = "0".repeat(pad) + bits;
  let hex = "";
  for (let i = 0; i < padded.length; i += 4) {
    const nibble = padded.slice(i, i + 4);
    hex += parseInt(nibble, 2).toString(16);
  }
  return hex;
}

/**
 * JavaScriptのnumber値をIEEE 754 binary32（float32）として解釈し、ビット情報を抽出
 *
 * 処理の流れ:
 * 1. ArrayBufferとDataViewを使用してnumberをfloat32としてメモリに書き込む
 * 2. 同じメモリ位置から32ビット符号なし整数として読み取る
 * 3. ビットシフトとマスク演算で符号、指数、仮数を抽出
 * 4. UI表示用に各種フォーマット（グループ化、16進数変換など）を生成
 *
 * IEEE 754 binary32のビット構造:
 * - ビット31: 符号ビット（s）
 * - ビット30-23: 指数部（e）8ビット、バイアス=127
 * - ビット22-0: 仮数部（m）23ビット
 *
 * @param value JavaScript number（内部的にはfloat64だが、float32に変換される）
 * @returns float32のビット情報
 */
export function float32Bits(value: number): Float32BitsInfo {
  // 4バイトのバッファを作成（float32用）
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);

  // valueをfloat32として書き込む（little-endian）
  view.setFloat32(0, value, true);
  // 同じ位置から32ビット符号なし整数として読み取る
  const u32 = view.getUint32(0, true);

  // ビット演算で各フィールドを抽出
  const signBit = ((u32 >>> 31) & 1) as 0 | 1;        // 最上位ビット
  const exponentBits = (u32 >>> 23) & 0xff;           // 8ビット（ビット30-23）
  const mantissaBits = u32 & 0x7fffff;                // 23ビット（ビット22-0）

  // 浮動小数点数の分類を判定
  const kind = classifyFloat32(exponentBits, mantissaBits);

  // バイアスを除去した指数を計算
  // Normal: 指数 - 127
  // Subnormal: -126（固定）
  // Zero/Infinity/NaN: null（指数は意味を持たない）
  const exponentUnbiased =
    kind === "Normal" ? exponentBits - 127 :
    kind === "Subnormal" ? -126 :
    null;

  // 生のビット列と16進数を生成
  const bits = toBitsString32(u32);
  const hex = toHex32(u32);

  // 各フィールドのビット列を抽出
  const signBitsStr = bits.slice(0, 1);      // ビット31
  const exponentBitsStr = bits.slice(1, 9);  // ビット30-23（8ビット）
  const mantissaBitsStr = bits.slice(9);     // ビット22-0（23ビット）

  // UI表示用にグループ化
  const hexGrouped = groupEvery(hex, 2, " ");              // バイト単位（2桁ずつ）
  const bitsGrouped8 = groupEvery(bits, 8, " ");           // バイト単位（8ビットずつ）

  const exponentGrouped4 = groupEvery(exponentBitsStr, 4, " ");           // 4ビットずつ
  const mantissaGrouped4 = groupWithRemainderAtEnd(mantissaBitsStr, 4, " "); // 4ビットずつ（最後は3ビット）

  // NaN用のペイロード情報（仮数部と同じ内容）
  const payloadBitsStr = mantissaBitsStr;
  const payloadGrouped4 = mantissaGrouped4;
  const payloadHexPadded = bitsToHexPadded(payloadBitsStr).padStart(6, "0"); // 23bit => 6 hex

  return {
    kind,
    signBit,
    exponentBits,
    mantissaBits,
    exponentUnbiased,

    hex,
    bits,

    hexGrouped,
    bitsGrouped8,

    signBitsStr,
    exponentBitsStr,
    mantissaBitsStr,

    exponentGrouped4,
    mantissaGrouped4,

    payloadBitsStr,
    payloadGrouped4,
    payloadHexPadded,
  };
}

/**
 * JavaScriptのnumber値をIEEE 754 binary64（float64）として解釈し、ビット情報を抽出
 *
 * 処理の流れ:
 * 1. ArrayBufferとDataViewを使用してnumberをfloat64としてメモリに書き込む
 * 2. 同じメモリ位置から32ビット符号なし整数2つ（上位・下位）として読み取る
 * 3. ビットシフトとマスク演算で符号、指数、仮数を抽出
 * 4. UI表示用に各種フォーマット（グループ化、16進数変換など）を生成
 *
 * IEEE 754 binary64のビット構造:
 * - ビット63: 符号ビット（s）
 * - ビット62-52: 指数部（e）11ビット、バイアス=1023
 * - ビット51-0: 仮数部（m）52ビット
 *
 * @param value JavaScript number（内部的にはfloat64）
 * @returns float64のビット情報
 */
export function float64Bits(value: number): Float64BitsInfo {
  // 8バイトのバッファを作成（float64用）
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);

  // valueをfloat64として書き込む（little-endian）
  view.setFloat64(0, value, true);
  // 同じ位置から32ビット符号なし整数2つとして読み取る
  const lo = view.getUint32(0, true);  // 下位32ビット（バイト0-3）
  const hi = view.getUint32(4, true);  // 上位32ビット（バイト4-7）

  // ビット演算で各フィールドを抽出（上位32ビットから）
  const signBit = ((hi >>> 31) & 1) as 0 | 1;  // 最上位ビット
  const exponentBits = (hi >>> 20) & 0x7ff;     // 11ビット（ビット62-52）

  // 仮数部は52ビット（上位20ビット + 下位32ビット）
  const mantissaHigh = hi & 0x000fffff;         // 上位20ビット
  const mantissaLow = lo >>> 0;                 // 下位32ビット

  // 浮動小数点数の分類を判定
  const kind = classifyFloat64(exponentBits, mantissaHigh, mantissaLow);

  // バイアスを除去した指数を計算
  // Normal: 指数 - 1023
  // Subnormal: -1022（固定）
  // Zero/Infinity/NaN: null（指数は意味を持たない）
  const exponentUnbiased =
    kind === "Normal" ? exponentBits - 1023 :
    kind === "Subnormal" ? -1022 :
    null;

  // 生のビット列と16進数を生成
  const bits = toBitsString64(hi, lo);
  const hex = toHex64(hi, lo);

  // 各フィールドのビット列を抽出
  const signBitsStr = bits.slice(0, 1);       // ビット63
  const exponentBitsStr = bits.slice(1, 12);  // ビット62-52（11ビット）
  const mantissaBitsStr = bits.slice(12);     // ビット51-0（52ビット）

  // UI表示用にグループ化
  const hexGrouped = groupEvery(hex, 2, " ");         // バイト単位（2桁ずつ）
  const bitsGrouped8 = groupEvery(bits, 8, " ");      // バイト単位（8ビットずつ）

  // 指数部は11ビットなので4で割り切れない → 3 + 4 + 4 に分割
  const exponentGrouped4 = `${exponentBitsStr.slice(0, 3)} ${exponentBitsStr.slice(3, 7)} ${exponentBitsStr.slice(7, 11)}`;
  // 仮数部は52ビット（4で割り切れる）→ 4ビットずつ
  const mantissaGrouped4 = groupEvery(mantissaBitsStr, 4, " ");

  // NaN用のペイロード情報（仮数部と同じ内容）
  const payloadBitsStr = mantissaBitsStr;
  const payloadGrouped4 = mantissaGrouped4;
  // 52bit = 13 hex digits
  const payloadHexPadded = bitsToHexPadded(payloadBitsStr).padStart(13, "0");

  return {
    kind,
    signBit,
    exponentBits,
    mantissaHigh,
    mantissaLow,
    exponentUnbiased,

    hex,
    bits,

    hexGrouped,
    bitsGrouped8,

    signBitsStr,
    exponentBitsStr,
    mantissaBitsStr,

    exponentGrouped4,
    mantissaGrouped4,

    payloadBitsStr,
    payloadGrouped4,
    payloadHexPadded,
  };
}
