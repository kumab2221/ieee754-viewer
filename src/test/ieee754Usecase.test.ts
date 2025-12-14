import * as assert from "assert";
import { buildViewModel } from "../application/ieee754Usecase";

suite("ieee754 usecase", () => {
  test("float32: 1.0", () => {
    const vm = buildViewModel("1.0", "float");
    assert.strictEqual(vm.state, "Valid");
    if (vm.state !== "Valid") return;
    assert.strictEqual(vm.bits.hex, "3f800000"); // float32 1.0
  });

  test("float64: 1.0", () => {
    const vm = buildViewModel("1.0", "double");
    assert.strictEqual(vm.state, "Valid");
    if (vm.state !== "Valid") return;
    assert.strictEqual(vm.bits.hex, "3ff0000000000000"); // float64 1.0
  });

  test("Infinity", () => {
    const vm = buildViewModel("Inf", "float");
    assert.strictEqual(vm.state, "Valid");
    if (vm.state !== "Valid") return;
    assert.strictEqual(vm.bits.kind, "Infinity");
  });

  test("NaN", () => {
    const vm = buildViewModel("NaN", "double");
    assert.strictEqual(vm.state, "Valid");
    if (vm.state !== "Valid") return;
    assert.strictEqual(vm.bits.kind, "NaN");
  });
});

test("hex grouped", () => {
  const vm = buildViewModel("1.0", "float");
  assert.strictEqual(vm.state, "Valid");
  if (vm.state !== "Valid") return;
  assert.strictEqual(vm.bits.hexGrouped, "3f 80 00 00");
});

