import fixture from "../../../backend/tests/fixtures/accuracy_fixture.json";
import { gameAccuracy } from "@/lib/accuracy";

describe("accuracy parity with backend fixture", () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      const got = gameAccuracy(c.moves as never);
      if (c.expected === null) {
        expect(got).toBeNull();
      } else {
        expect(got).toBeCloseTo(c.expected as number, 9);
      }
    });
  }
});
