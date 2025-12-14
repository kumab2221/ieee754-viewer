// src/infrastructure/ieee754.ts
export type FloatKind = "Zero" | "Subnormal" | "Normal" | "Infinity" | "NaN";

export type Float32BitsInfo = {
  kind: FloatKind;

  signBit: 0 | 1;
  exponentBits: number; // 0..255
  mantissaBits: number; // 0..(2^23-1)
  exponentUnbiased: number | null;

  // raw
  hex: string;      // 8 hex chars (no spaces)
  bits: string;     // 32 bits (no spaces)

  // grouped (UI-ready)
  hexGrouped: string;       // "3f 80 00 00"
  bitsGrouped8: string;     // "00111111 10000000 ..."

  signBitsStr: string;      // "0" or "1"
  exponentBitsStr: string;  // 8 bits
  mantissaBitsStr: string;  // 23 bits

  exponentGrouped4: string; // "0111 1111"
  mantissaGrouped4: string; // "0000 0000 ... 000" (last group may be shorter)
  // NaN payload (mantissa)
  payloadBitsStr: string;       // same as mantissaBitsStr
  payloadGrouped4: string;      // same as mantissaGrouped4
  payloadHexPadded: string;     // 6 hex digits (ceil(23/4)=6)
};

export type Float64BitsInfo = {
  kind: FloatKind;

  signBit: 0 | 1;
  exponentBits: number; // 0..2047
  mantissaHigh: number; // upper 20 bits
  mantissaLow: number;  // lower 32 bits
  exponentUnbiased: number | null;

  // raw
  hex: string;   // 16 hex chars
  bits: string;  // 64 bits

  // grouped (UI-ready)
  hexGrouped: string;    // "3f f0 00 00 00 00 00 00"
  bitsGrouped8: string;  // "00111111 11110000 ..."

  signBitsStr: string;      // "0"/"1"
  exponentBitsStr: string;  // 11 bits
  mantissaBitsStr: string;  // 52 bits

  exponentGrouped4: string; // "011 1111 1111" (先頭が3bitになる)
  mantissaGrouped4: string; // 4bit区切り

  // NaN payload (mantissa)
  payloadBitsStr: string;       // same as mantissaBitsStr
  payloadGrouped4: string;      // same as mantissaGrouped4
  payloadHexPadded: string;     // 13 hex digits (52/4=13)
};

function toBitsString32(u32: number): string {
  return (u32 >>> 0).toString(2).padStart(32, "0");
}
function toHex32(u32: number): string {
  return (u32 >>> 0).toString(16).padStart(8, "0");
}
function toHex64(hi: number, lo: number): string {
  return toHex32(hi) + toHex32(lo);
}
function toBitsString64(hi: number, lo: number): string {
  return toBitsString32(hi) + toBitsString32(lo);
}

function groupEvery(s: string, n: number, sep = " "): string {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.join(sep);
}

function groupWithRemainderAtEnd(s: string, group: number, sep = " "): string {
  // 左から group で切っていき、最後が余れば短いグループとして残す
  return groupEvery(s, group, sep);
}

function classifyFloat32(exp: number, mant: number): FloatKind {
  if (exp === 0) return mant === 0 ? "Zero" : "Subnormal";
  if (exp === 0xff) return mant === 0 ? "Infinity" : "NaN";
  return "Normal";
}
function classifyFloat64(exp: number, mantHi: number, mantLo: number): FloatKind {
  const mantIsZero = mantHi === 0 && mantLo === 0;
  if (exp === 0) return mantIsZero ? "Zero" : "Subnormal";
  if (exp === 0x7ff) return mantIsZero ? "Infinity" : "NaN";
  return "Normal";
}

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

export function float32Bits(value: number): Float32BitsInfo {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);

  view.setFloat32(0, value, true);
  const u32 = view.getUint32(0, true);

  const signBit = ((u32 >>> 31) & 1) as 0 | 1;
  const exponentBits = (u32 >>> 23) & 0xff;
  const mantissaBits = u32 & 0x7fffff;

  const kind = classifyFloat32(exponentBits, mantissaBits);
  const exponentUnbiased =
    kind === "Normal" ? exponentBits - 127 :
    kind === "Subnormal" ? -126 :
    null;

  const bits = toBitsString32(u32);
  const hex = toHex32(u32);

  const signBitsStr = bits.slice(0, 1);
  const exponentBitsStr = bits.slice(1, 9);
  const mantissaBitsStr = bits.slice(9);

  const hexGrouped = groupEvery(hex, 2, " ");
  const bitsGrouped8 = groupEvery(bits, 8, " ");

  const exponentGrouped4 = groupEvery(exponentBitsStr, 4, " ");
  const mantissaGrouped4 = groupWithRemainderAtEnd(mantissaBitsStr, 4, " ");

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

export function float64Bits(value: number): Float64BitsInfo {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);

  view.setFloat64(0, value, true);
  const lo = view.getUint32(0, true);
  const hi = view.getUint32(4, true);

  const signBit = ((hi >>> 31) & 1) as 0 | 1;
  const exponentBits = (hi >>> 20) & 0x7ff;

  const mantissaHigh = hi & 0x000fffff;
  const mantissaLow = lo >>> 0;

  const kind = classifyFloat64(exponentBits, mantissaHigh, mantissaLow);
  const exponentUnbiased =
    kind === "Normal" ? exponentBits - 1023 :
    kind === "Subnormal" ? -1022 :
    null;

  const bits = toBitsString64(hi, lo);
  const hex = toHex64(hi, lo);

  const signBitsStr = bits.slice(0, 1);
  const exponentBitsStr = bits.slice(1, 12); // 11
  const mantissaBitsStr = bits.slice(12);    // 52

  const hexGrouped = groupEvery(hex, 2, " ");
  const bitsGrouped8 = groupEvery(bits, 8, " ");

  // exponent 11bitは 4で割れないので 3 + 4 + 4 が自然
  const exponentGrouped4 = `${exponentBitsStr.slice(0, 3)} ${exponentBitsStr.slice(3, 7)} ${exponentBitsStr.slice(7, 11)}`;
  const mantissaGrouped4 = groupEvery(mantissaBitsStr, 4, " ");

  const payloadBitsStr = mantissaBitsStr;
  const payloadGrouped4 = mantissaGrouped4;

  // 52bit = 13 hex
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
