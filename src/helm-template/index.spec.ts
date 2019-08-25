const path = require("path");
import { readHelmTemplateSync } from ".";

describe("Helm template test suite", () => {
  describe("When passing a helm template path", () => {
    it("Should load from disk", () => {
      const data = readHelmTemplateSync(
        path.resolve(__dirname, "../__mocks__/helm-template.yml")
      );
      expect(data).toBe(
        [
          "image: {{ .Values.image.repository }}:{{ .Values.image.tag }}",
          ""
        ].join("\n")
      );
    });
  });
  describe("When passing a helm template as Buffer", () => {
    it("Should load from Buffer", () => {
      const buffer = Buffer.from(
        "image: {{ .Values.image.repository }}:{{ .Values.image.tag }}"
      );
      const data = readHelmTemplateSync(buffer);
      expect(data).toBe(
        "image: {{ .Values.image.repository }}:{{ .Values.image.tag }}\n"
      );
    });
  });
});
