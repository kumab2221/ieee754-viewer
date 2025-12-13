// src/application/ieee754Usecase.ts
import { ParseFloatingInput, ParseResult } from "../domain/parseFloatingInput";
import { float32Bits, float64Bits, Float32BitsInfo, Float64BitsInfo } from "../infrastructure/ieee754";

export type Precision = "float" | "double";

export type ViewModel =
  | {
      state: "Incomplete";
      normalizedText: string;
      message?: string;
    }
  | {
      state: "Invalid";
      normalizedText: string;
      message: string;
    }
  | {
      state: "Valid";
      normalizedText: string;
      value: number;
      precision: Precision;
      bits: Float32BitsInfo | Float64BitsInfo;
    };

export function buildViewModel(inputText: string, precision: Precision): ViewModel {
  const r: ParseResult = ParseFloatingInput(inputText);

  if (r.kind === "Incomplete") {
    return { state: "Incomplete", normalizedText: r.normalizedText, message: r.reason };
  }
  if (r.kind === "Invalid") {
    return { state: "Invalid", normalizedText: r.normalizedText, message: r.reason };
  }

  // Valid
  const value = r.value;

  // float でも double でも、入力値はJS number (double)。
  // float表示は「float32に丸めた結果のビット」を見せる。
  const bits = precision === "float" ? float32Bits(value) : float64Bits(value);

  return {
    state: "Valid",
    normalizedText: r.normalizedText,
    value,
    precision,
    bits,
  };
}
