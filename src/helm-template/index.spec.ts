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
  describe("When passing a helm template with object array", () => {
    it("Should load from Buffer", () => {
      const buffer = Buffer.from(
        [
          `containers:`,
          `- name: {{ .Values.name }}`,
          `  image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"`,
          `  imagePullPolicy: "{ { .Values.image.pullPolicy } }"`,
          `  readinessProbe:`,
          `    httpGet:`,
          `      path: /health`,
          `      port: { { .Values.targetPort } }`,
          `    initialDelaySeconds: 15`,
          `    periodSeconds: 30`,
          `  env:`,
          `    - name: "NODE_ENV"`,
          `      value: "{{ .Values.env }}"`,
          `  ports:`,
          `    - containerPort: { { .Values.containerPort } }`,
          `  volumeMounts:`,
          `    - name: tz-config`,
          `      mountPath: /etc/localtime`
        ].join("\n")
      );
      const data = readHelmTemplateSync(buffer);
      expect(data).toBe(
        [
          `containers:`,
          `- name: {{ .Values.name }}`,
          `  image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"`,
          `  imagePullPolicy: "{ { .Values.image.pullPolicy } }"`,
          `  readinessProbe:`,
          `    httpGet:`,
          `      path: /health`,
          `      port: { { .Values.targetPort } }`,
          `    initialDelaySeconds: 15`,
          `    periodSeconds: 30`,
          `  env:`,
          `    - name: "NODE_ENV"`,
          `      value: "{{ .Values.env }}"`,
          `  ports:`,
          `    - containerPort: { { .Values.containerPort } }`,
          `  volumeMounts:`,
          `    - name: tz-config`,
          `      mountPath: /etc/localtime`
        ].join("\n")
      );
    });
  });
});
