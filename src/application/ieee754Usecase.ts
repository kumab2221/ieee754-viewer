// src/application/ieee754Usecase.ts
// Application層: Domain層とInfrastructure層を組み合わせてビューモデルを構築
// 入力テキストをパースし、指定された精度（float/double）でビット情報を生成

import { ParseFloatingInput, ParseResult } from "../domain/parseFloatingInput";
import { float32Bits, float64Bits, Float32BitsInfo, Float64BitsInfo } from "../infrastructure/ieee754";

/**
 * 浮動小数点数の精度を指定する型
 * - float: IEEE 754 binary32（32ビット単精度）
 * - double: IEEE 754 binary64（64ビット倍精度）
 */
export type Precision = "float" | "double";

/**
 * UI表示用のビューモデル
 *
 * パース結果の状態に応じて3つの形態を持つ判別可能なユニオン型:
 * - Incomplete: 入力途中（エラー表示しない）
 * - Invalid: 無効な入力（エラー表示）
 * - Valid: 有効な数値（ビット情報を含む）
 */
export type ViewModel =
  | {
      /** 入力途中の状態 */
      state: "Incomplete";
      /** 正規化された入力テキスト */
      normalizedText: string;
      /** 途中状態の理由（オプション） */
      message?: string;
    }
  | {
      /** 無効な入力状態 */
      state: "Invalid";
      /** 正規化された入力テキスト */
      normalizedText: string;
      /** エラーメッセージ */
      message: string;
    }
  | {
      /** 有効な数値（パース成功） */
      state: "Valid";
      /** 正規化された入力テキスト */
      normalizedText: string;
      /** パースされた数値 */
      value: number;
      /** 精度（float または double） */
      precision: Precision;
      /** IEEE 754ビット情報 */
      bits: Float32BitsInfo | Float64BitsInfo;
    };

/**
 * 入力テキストと精度からビューモデルを構築
 *
 * 処理の流れ:
 * 1. 入力テキストをパース（Domain層）
 * 2. パース結果に応じて処理を分岐:
 *    - Incomplete → そのまま返す（エラー表示なし）
 *    - Invalid → そのまま返す（エラー表示あり）
 *    - Valid → ビット情報を抽出してビューモデルを構築
 * 3. 指定された精度（float/double）でビット操作を実行（Infrastructure層）
 *
 * 重要な注意点:
 * - JavaScriptのnumber型は常にIEEE 754 binary64（double）
 * - float表示の場合、値をfloat32に丸めてからビット情報を抽出
 * - この丸めにより、doubleとfloatで表現できる精度が異なる
 *
 * @param inputText ユーザーが入力したテキスト
 * @param precision 表示する精度（"float" または "double"）
 * @returns UI表示用のビューモデル
 */
export function buildViewModel(inputText: string, precision: Precision): ViewModel {
  // Domain層で入力をパース
  const r: ParseResult = ParseFloatingInput(inputText);

  // 途中入力の場合、エラー表示せずに状態を返す
  if (r.kind === "Incomplete") {
    return { state: "Incomplete", normalizedText: r.normalizedText, message: r.reason };
  }

  // 無効な入力の場合、エラーメッセージを含めて返す
  if (r.kind === "Invalid") {
    return { state: "Invalid", normalizedText: r.normalizedText, message: r.reason };
  }

  // Valid: パースに成功した数値
  const value = r.value;

  // Infrastructure層でビット情報を抽出
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
