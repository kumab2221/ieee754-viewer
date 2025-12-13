import * as assert from "assert";
import { ParseFloatingInput } from "../domain/parseFloatingInput";

suite("ParseFloatingInput", () => {
  test("incomplete basics", () => {
    assert.strictEqual(ParseFloatingInput("").kind, "Incomplete");
    assert.strictEqual(ParseFloatingInput("-").kind, "Incomplete");
    assert.strictEqual(ParseFloatingInput(".").kind, "Incomplete");
    assert.strictEqual(ParseFloatingInput("-.").kind, "Incomplete");
    assert.strictEqual(ParseFloatingInput("1e").kind, "Incomplete");
    assert.strictEqual(ParseFloatingInput("1e-").kind, "Incomplete");
  });

  test("valid decimals", () => {
    assert.strictEqual(ParseFloatingInput("0").kind, "Valid");
    assert.strictEqual(ParseFloatingInput("-1.25").kind, "Valid");
    assert.strictEqual(ParseFloatingInput(".5").kind, "Valid");
    assert.strictEqual(ParseFloatingInput("1.").kind, "Valid");
    assert.strictEqual(ParseFloatingInput("1e-3").kind, "Valid");
    assert.strictEqual(ParseFloatingInput("-1.2E+8").kind, "Valid");
  });

  test("specials", () => {
    assert.strictEqual(ParseFloatingInput("NaN").kind, "Valid");
    assert.strictEqual(ParseFloatingInput("-NaN").kind, "Valid");
    assert.strictEqual(ParseFloatingInput("Inf").kind, "Valid");
    assert.strictEqual(ParseFloatingInput("+Infinity").kind, "Valid");
    assert.strictEqual(ParseFloatingInput("infi").kind, "Incomplete"); // 途中入力扱い
  });

  test("invalids", () => {
    assert.strictEqual(ParseFloatingInput("1ee3").kind, "Invalid");
    assert.strictEqual(ParseFloatingInput("--1").kind, "Invalid");
    assert.strictEqual(ParseFloatingInput("e3").kind, "Invalid");
    assert.strictEqual(ParseFloatingInput("1e1.2").kind, "Invalid");
  });
});
