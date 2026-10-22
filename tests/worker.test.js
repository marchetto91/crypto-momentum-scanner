import test from "node:test";
import assert from "node:assert/strict";
import { marketPrice, isSpotInstrument, positionSize } from "../worker.js";

test("marketPrice uses last traded price and never the 24h change", () => {
  assert.equal(marketPrice({ a: "123.45", b: "123.4", k: "123.5", c: "0.08" }), 123.45);
});

test("marketPrice falls back to bid/ask midpoint only when last price is absent", () => {
  assert.equal(marketPrice({ b: "99", k: "101", c: "0.5" }), 100);
  assert.equal(marketPrice({ b: "0", k: "0", c: "0.5" }), 0);
});

test("isSpotInstrument allows known spot types and rejects derivatives", () => {
  assert.equal(isSpotInstrument({ instrument_name: "BTC_USDT", inst_type: "CCY_PAIR" }), true);
  assert.equal(isSpotInstrument({ instrument_name: "BTC-PERP", inst_type: "PERPETUAL_SWAP" }), false);
  assert.equal(isSpotInstrument({ instrument_name: "BTC_USDT", inst_type: "PERPETUAL_SWAP" }), false);
});

test("positionSize caps loss budget including entry and exit fees", () => {
  const size = positionSize({ capital: 150, riskEur: 3, entry: 100, stop: 95, feeRate: 0.003 });
  assert.ok(size > 0 && size <= 150);
  const estimatedLoss = size * ((100 - 95) / 100 + 2 * 0.003);
  assert.ok(estimatedLoss <= 3 + 1e-9);
});

test("positionSize rejects invalid stop or entry values", () => {
  assert.equal(positionSize({ capital: 150, riskEur: 3, entry: 100, stop: 100 }), 0);
  assert.equal(positionSize({ capital: 150, riskEur: 3, entry: 100, stop: 0 }), 0);
});
