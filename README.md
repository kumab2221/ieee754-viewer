# IEEE754 Viewer

IEEE754 Viewer は、浮動小数点数のバイナリ表現（IEEE 754形式）を視覚的に確認できる Visual Studio Code 拡張機能です。float（binary32）と double（binary64）の両方の形式に対応しており、符号ビット、指数部、仮数部を詳細に表示します。

## 概要

この拡張機能は、浮動小数点数の内部表現を理解するための教育ツールとして、また低レベルプログラミングやデバッグの支援ツールとして開発されました。入力された数値を IEEE 754 形式のビット列に変換し、各部分（符号、指数、仮数）を分かりやすく表示します。

## 主な機能

### サポートされる数値形式

- **float（IEEE 754 binary32）**: 32ビット単精度浮動小数点数
- **double（IEEE 754 binary64）**: 64ビット倍精度浮動小数点数

### 入力形式

以下の形式の入力をサポートしています：

- 整数: `123`, `-456`
- 小数: `1.25`, `-0.5`, `.5`, `1.`
- 指数表記: `1e-3`, `-1.2E+8`, `1e10`
- 特殊値: `NaN`, `Inf`, `Infinity`, `-Infinity`
  - 大文字小文字を区別しません（`nan`, `NAN`, `inf`, `INF` なども可）

### 表示情報

各数値について以下の情報を表示します：

#### 基本情報
- **state**: 入力状態（Valid / Incomplete / Invalid）
- **normalized**: 正規化された入力テキスト（例: "+1" → "1", "inf" → "Infinity"）
- **kind**: 数値の種類（Zero / Subnormal / Normal / Infinity / NaN）

#### ビット表現（複数形式で表示）
- **hex (bytes)**: バイト単位で区切った16進数
  - float32: `3f 80 00 00` 形式（4バイト）
  - float64: `3f f0 00 00 00 00 00 00` 形式（8バイト）
- **bits (bytes)**: バイト単位で区切ったビット列
  - 例: `00111111 10000000 00000000 00000000`

#### フィールド別のビット情報
- **s**: 符号ビット（`0` または `1`）
- **e**: 指数部のビット列（4ビット区切り）
  - float32: 8ビット（例: `0111 1111`）
  - float64: 11ビット（例: `011 1111 1111`）
- **m**: 仮数部のビット列（4ビット区切り）
  - float32: 23ビット（例: `0000 0000 0000 0000 0000 000`）
  - float64: 52ビット（例: `0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000`）

#### 数値情報
- **exponent(bits)**: 指数部のビット値（バイアス込み）
  - float32: 0～255
  - float64: 0～2047
- **exponent(unbiased)**: バイアスを除いた指数値
  - Normal: 実際の指数（float32: bias=127, float64: bias=1023）
  - Subnormal: 固定値（float32: -126, float64: -1022）
  - Zero/Infinity/NaN: 表示されない（"-"）

#### 仮数部の詳細
- **float32の場合**:
  - **mantissa (uint)**: 仮数部の整数値（0～8388607）
- **float64の場合**:
  - **mantissaHigh(20)**: 仮数部の上位20ビット
  - **mantissaLow(32)**: 仮数部の下位32ビット

#### NaN特有の情報（NaNの場合のみ表示）
- **NaN payload (bits)**: NaNペイロード（仮数部）のビット列（4ビット区切り）
- **NaN payload (hex)**: NaNペイロードの16進数表現
  - float32: 6桁（23ビット）
  - float64: 13桁（52ビット）

## 使い方

### 拡張機能の起動

1. コマンドパレットを開く（Windows/Linux: `Ctrl+Shift+P`, macOS: `Cmd+Shift+P`）
2. `IEEE754 Viewer: Open` を実行
3. Webview パネルが開きます

### 数値の入力

- 左側のカード: **float** 用の入力フィールド
- 右側のカード: **double** 用の入力フィールド

入力フィールドに数値を入力すると、リアルタイムでビット表現が更新されます。

### 入力例と出力

```
入力: 1.0
float32 hex:  3f 80 00 00
float64 hex:  3f f0 00 00 00 00 00 00

入力: -1.25
float32 hex:  bf a0 00 00
float64 hex:  bf f4 00 00 00 00 00 00

入力: 1e-3 (= 0.001)
float32 hex:  3a 83 12 6f
float64 hex:  3f 50 62 4d d2 f1 a9 fc

入力: NaN
float32 hex:  7f c0 00 00
float64 hex:  7f f8 00 00 00 00 00 00
NaN payload も表示されます

入力: Infinity
float32 hex:  7f 80 00 00
float64 hex:  7f f0 00 00 00 00 00 00
```

## プロジェクト構造

このプロジェクトは、保守性とテスタビリティを重視した3層アーキテクチャを採用しています：

### ディレクトリ構造

```
ieee754-viewer/
├── src/
│   ├── domain/                   # ドメイン層
│   │   └── parseFloatingInput.ts # 入力パーサー
│   ├── application/               # アプリケーション層
│   │   └── ieee754Usecase.ts     # ビューモデル構築
│   ├── infrastructure/            # インフラストラクチャ層
│   │   └── ieee754.ts            # IEEE754 ビット操作
│   ├── test/                     # テストコード
│   │   ├── parseFloatingInput.test.ts
│   │   ├── ieee754Usecase.test.ts
│   │   └── extension.test.ts
│   └── extension.ts              # VSCode拡張機能エントリーポイント
├── dist/                         # ビルド出力
├── package.json
├── tsconfig.json
├── esbuild.js
└── eslint.config.mjs
```

### アーキテクチャの詳細

#### 1. Domain層 ([src/domain/parseFloatingInput.ts](src/domain/parseFloatingInput.ts))

入力文字列の検証とパースを担当します。以下の3つの状態を返します：

- **Valid**: 有効な数値として解釈可能
- **Incomplete**: 途中入力（例: `-`, `1e`, `1e+`, `.`, `-.`）
  - UIでの入力体験を損なわないため、途中状態を明示的にサポート
- **Invalid**: 無効な入力

主な機能：
- 数値構文の検証（整数、小数、指数表記）
- 特殊値の処理（NaN, Infinity）
- 大文字小文字を区別しない特殊値のサポート
- 途中入力の判定ロジック

#### 2. Application層 ([src/application/ieee754Usecase.ts](src/application/ieee754Usecase.ts))

ドメイン層とインフラ層を組み合わせてビューモデルを構築します。

```typescript
export function buildViewModel(inputText: string, precision: Precision): ViewModel
```

- パース結果に基づいてViewModelを生成
- float/doubleの精度に応じたビット情報を取得

#### 3. Infrastructure層 ([src/infrastructure/ieee754.ts](src/infrastructure/ieee754.ts))

IEEE 754 標準に基づく実際のビット操作を実装します。

主な関数：
- `float32Bits(value: number): Float32BitsInfo`
  - JavaScriptのnumberをfloat32に変換してビット情報を抽出
  - 返り値には生データとUI表示用のグループ化データを含む
- `float64Bits(value: number): Float64BitsInfo`
  - double（float64）のビット情報を抽出
  - 返り値には生データとUI表示用のグループ化データを含む

実装の詳細：
- `DataView` を使用したバイナリ操作
- Little-endianでの一貫したバイト順
- 符号ビット、指数ビット、仮数ビットの抽出
- 数値の種類の分類（Zero, Subnormal, Normal, Infinity, NaN）
- UI表示用に複数のフォーマットを生成:
  - バイト単位でグループ化された16進数（`hexGrouped`）
  - バイト単位でグループ化されたビット列（`bitsGrouped8`）
  - 4ビット単位でグループ化された指数部・仮数部（`exponentGrouped4`, `mantissaGrouped4`）
  - NaNペイロードの16進数表現（`payloadHexPadded`）

#### 4. Presentation層 ([src/extension.ts](src/extension.ts))

VSCode拡張機能としてのUI層を提供します。

- Webview パネルの管理
- ユーザー入力の受信とレスポンス送信
- HTML/CSS/JavaScriptによるインタラクティブなUI
- CSP（Content Security Policy）の適用

特徴：
- リアルタイム更新（入力のたびに再計算）
- クライアント側での簡易的な入力フィルタリング（完全な検証はDomain層で実施）
- ペースト時の不正文字フィルタリング

## 開発

### 必要な環境

- Node.js (22.x)
- pnpm
- Visual Studio Code (^1.107.0)

### セットアップ

```bash
# 依存関係のインストール
pnpm install

# 開発モードでビルド＆ウォッチ
pnpm run watch

# プロダクションビルド
pnpm run package
```

### スクリプト

```json
{
  "compile": "型チェック + Lint + ビルド",
  "watch": "開発モード（自動リビルド）",
  "package": "プロダクションビルド（minify有効）",
  "test": "テスト実行",
  "lint": "ESLint実行",
  "check-types": "TypeScriptの型チェックのみ"
}
```

### ビルドツール

- **TypeScript**: 型安全な開発
- **esbuild**: 高速バンドラー（ESMからCJSへ変換）
- **ESLint**: コード品質チェック
- **Mocha**: テストフレームワーク

### テスト

テストは3つのファイルに分かれています：

1. **parseFloatingInput.test.ts**: 入力パーサーのテスト
   - Incomplete、Valid、Invalid の各ケース
   - 特殊値（NaN, Infinity）のテスト
2. **ieee754Usecase.test.ts**: ユースケースのテスト
   - float32とfloat64のビット表現
   - 特殊値の正しい分類
3. **extension.test.ts**: 拡張機能のエントリーポイント

テスト実行:
```bash
pnpm run test
```

## 技術的な特徴

### 1. 入力検証の工夫

このプロジェクトの重要な設計上の工夫は、**Incomplete状態の明示的なサポート**です。

通常の入力検証では「Valid / Invalid」の2状態しか持ちませんが、この拡張機能では途中入力を明示的に扱うことで、以下のメリットを実現しています：

- ユーザーが `-` や `1e` を入力中にエラー表示されない
- 自然な入力体験の提供
- 正確なエラーメッセージの表示（無効な入力と途中入力を区別）

例：
```typescript
"-"      → Incomplete (符号だけ)
"1e"     → Incomplete (指数マーカーのみ)
"1e-"    → Incomplete (指数符号のみ)
"1e-3"   → Valid (完全な指数表記)
"1ee3"   → Invalid (不正な構文)
```

### 2. UI表示の最適化

ビット情報を複数の形式で提供することで、ユーザーが理解しやすい表示を実現：

- **バイト区切り**: メモリレイアウトの理解に最適
  - 16進数: `3f 80 00 00`（各バイトが視覚的に分離）
  - ビット列: `00111111 10000000 00000000 00000000`

- **4ビット区切り**: 16進数との対応関係が明確
  - 指数部: `0111 1111`（各グループが16進数1桁に対応）
  - 仮数部: `0000 0000 0000 0000 0000 000`

- **フィールド分離**: s（符号）、e（指数）、m（仮数）を個別に表示

この多層的な表示により、初学者から専門家まで幅広いユーザーのニーズに対応しています。

### 3. IEEE 754 の実装

JavaScript の `number` 型は IEEE 754 double（binary64）です。float32 を表現するには以下の手順を取ります：

1. `DataView` を使用して `ArrayBuffer` に値を書き込み
2. `setFloat32()` でfloat32として格納
3. `getUint32()` でビットパターンを読み取り
4. ビットシフトとマスク演算で各フィールドを抽出
5. UI表示用に複数フォーマットを生成

```typescript
const buf = new ArrayBuffer(4);
const view = new DataView(buf);
view.setFloat32(0, value, true);  // little-endian
const u32 = view.getUint32(0, true);

// ビット演算で各フィールドを抽出
const signBit = (u32 >>> 31) & 1;
const exponentBits = (u32 >>> 23) & 0xff;
const mantissaBits = u32 & 0x7fffff;

// グループ化された表示用データを生成
const hexGrouped = "3f 80 00 00";           // バイト区切り
const exponentGrouped4 = "0111 1111";        // 4ビット区切り
const mantissaGrouped4 = "0000 0000 ...";   // 4ビット区切り
```

#### NaNペイロードのサポート

NaN（非数）の場合、仮数部はペイロード（追加情報）として利用できます。この拡張機能では、NaNペイロードをビット列と16進数の両方で表示し、デバッグやシグナリングNaNの識別に役立てています。

### 4. Webview の実装

VSCode の Webview API を使用してインタラクティブなUIを提供：

- `postMessage()` による双方向通信
  - Webview → Extension: ユーザー入力の送信
  - Extension → Webview: ビューモデルの更新
- Content Security Policy（CSP）によるセキュリティ確保
  - nonceを使用したインラインスクリプトの制限
  - XSS攻撃の防止
- `retainContextWhenHidden` でパネルの状態を保持
- リアルタイム更新: 入力のたびに即座にビット表現を更新
- 入力フィルタリング: 不正な文字の入力を防止（UI層とDomain層の二重チェック）

## 参考資料

- [IEEE 754 - Wikipedia](https://en.wikipedia.org/wiki/IEEE_754)
- [IEEE 754 浮動小数点数の形式](https://ja.wikipedia.org/wiki/IEEE_754)
- [VSCode Extension API - Webview](https://code.visualstudio.com/api/extension-guides/webview)

## ライセンス

このプロジェクトのライセンスは未定です。

## バージョン履歴

### 0.0.1 (初期リリース)

- IEEE754 float32/float64 ビューワーの基本機能
- 入力パーサー（Valid/Incomplete/Invalid状態のサポート）
- Webview ベースのUI
- NaN、Infinity、指数表記のサポート
- グループ化されたビット表現:
  - バイト単位の16進数・ビット列表示
  - 4ビット区切りの指数部・仮数部表示
- NaNペイロード情報の表示
- 包括的なテストスイート
- 詳細なコードコメント（JSDoc形式）

---

**開発者向けメモ**: このREADMEはコードベースを詳しく解析して作成されました。プロジェクトの構造、アーキテクチャ、実装の詳細について包括的に記載しています。
