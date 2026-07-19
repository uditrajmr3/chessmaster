import { MEASUREMENT_KEYS, isValidMeasurementKey } from "../measurements";

describe("measurement keys", () => {
  it("accepts a known dotted key", () => {
    expect(isValidMeasurementKey("mates_by_piece.knight")).toBe(true);
  });
  it("rejects an unknown key", () => {
    expect(isValidMeasurementKey("mates_by_piece.dragon")).toBe(false);
  });
  it("has no duplicates", () => {
    expect(new Set(MEASUREMENT_KEYS).size).toBe(MEASUREMENT_KEYS.length);
  });
});
