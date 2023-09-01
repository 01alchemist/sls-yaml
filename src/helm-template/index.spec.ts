const path = require("path");
import { readHelmTemplateSync } from ".";

describe("Helm template test suite", () => {
  describe("When passing a helm template path", () => {
    it("Should load from disk", () => {
      const data = readHelmTemplateSync(
        path.resolve(__dirname, "../__mocks__/helm-template.yml"),
      );
      expect(data).toBe(
        [
          "image: {{ .Values.image.repository }}:{{ .Values.image.tag }}",
          "",
        ].join("\n"),
      );
    });
  });
  describe("When passing a wrong helm template", () => {
    it("Should load from disk", () => {
      const buffer = Buffer.from("@:image");
      expect(() => {
        readHelmTemplateSync(buffer);
      }).toThrowError(
        "end of the stream or a document separator is expected (1:1)",
      );
    });
  });
  describe("When passing a helm template as Buffer", () => {
    it("Should load from Buffer", () => {
      const buffer = Buffer.from(
        "image: {{ .Values.image.repository }}:{{ .Values.image.tag }}",
      );
      const data = readHelmTemplateSync(buffer);
      expect(data).toBe(
        "image: {{ .Values.image.repository }}:{{ .Values.image.tag }}\n",
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
          `      mountPath: /etc/localtime`,
        ].join("\n"),
      );
      const expected = [
        `containers: `,
        `  - name: {{ .Values.name }}`,
        `    image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"`,
        `    imagePullPolicy: "{{ .Values.image.pullPolicy }}"`,
        `    readinessProbe: `,
        `      httpGet: `,
        `        path: /health`,
        `        port: {{ .Values.targetPort }}`,
        `      initialDelaySeconds: 15`,
        `      periodSeconds: 30`,
        `    env: `,
        `      - name: NODE_ENV`,
        `        value: "{{ .Values.env }}"`,
        `    ports: `,
        `      - containerPort: {{ .Values.containerPort }}`,
        `    volumeMounts: `,
        `      - name: tz-config`,
        `        mountPath: /etc/localtime`,
        ``,
      ]
        .map((str) => str.replace(/\s/gi, "༌"))
        .join("\n");

      const data = readHelmTemplateSync(buffer)
        .split("\n")
        .map((str) => str.replace(/\s/gi, "༌"))
        .join("\n");

      expect(data).toBe(expected);
    });
  });
});
