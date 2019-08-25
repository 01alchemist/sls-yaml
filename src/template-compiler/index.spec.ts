const path = require("path");
import { functions } from ".";

describe("Template compiler test suite", () => {
  describe("When passing a helm template path to file function", () => {
    it("Should load from disk", () => {
      const data = functions.file(["./__mocks__/helm-template.yml", "helm"], {
        basePath: path.resolve(__dirname, "../")
      });
      expect(data).toBe(
        [
          "image: {{ .Values.image.repository }}:{{ .Values.image.tag }}",
          ""
        ].join("\n")
      );
    });
  });
});
