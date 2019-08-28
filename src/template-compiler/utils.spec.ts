import { printNodes } from "./utils";

describe("Print nodes test suite", () => {
  describe("When passing null node", () => {
    it("Should return empty string", () => {
      expect(printNodes(null)).toBe("");
    });
  });
});
