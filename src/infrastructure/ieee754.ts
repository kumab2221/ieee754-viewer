// src/infrastructure/ieee754.ts
export type FloatKind = "Zero" | "Subnormal" | "Normal" | "Infinity" | "NaN";

export type Float32BitsInfo = {
  kind: FloatKind;
  signBit: 0 | 1;
  exponentBits: number; // 0..255
  mantissaBits: number; // 0..(2^23-1)
  exponentUnbiased: number | null; // Normal/Subnormalのみ
  hex: string; // 8 hex chars
  bits: string; // 32 bits
  pretty: string; // "s eeeeeeee mmmmm...."
};

export type Float64BitsInfo = {
  kind: FloatKind;
  signBit: 0 | 1;
  exponentBits: number; // 0..2047
  mantissaHigh: number; // upper 20 bits of mantissa (from high word)
  mantissaLow: number;  // lower 32 bits of mantissa
  exponentUnbiased: number | null;
  hex: string; // 16 hex chars
  bits: string; // 64 bits
  pretty: string; // "s eeeeeeeeeee mmmmm...."
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

export function float32Bits(value: number): Float32BitsInfo {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);

  // little-endianで統一（どちらでもOKだが一貫性が大事）
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
  const pretty = `${bits.slice(0, 1)} ${bits.slice(1, 9)} ${bits.slice(9)}`;

  return {
    kind,
    signBit,
    exponentBits,
    mantissaBits,
    exponentUnbiased,
    hex,
    bits,
    pretty,
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

  // mantissa: 52 bits = (hi lower 20) + (lo 32)
  const mantissaHigh = hi & 0x000fffff;
  const mantissaLow = lo >>> 0;

  const kind = classifyFloat64(exponentBits, mantissaHigh, mantissaLow);
  const exponentUnbiased =
    kind === "Normal" ? exponentBits - 1023 :
    kind === "Subnormal" ? -1022 :
    null;

  const bits = toBitsString64(hi, lo);
  const hex = toHex64(hi, lo);
  const pretty = `${bits.slice(0, 1)} ${bits.slice(1, 12)} ${bits.slice(12)}`;

  return {
    kind,
    signBit,
    exponentBits,
    mantissaHigh,
    mantissaLow,
    exponentUnbiased,
    hex,
    bits,
    pretty,
  };
}