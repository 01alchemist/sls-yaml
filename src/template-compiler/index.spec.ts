const path = require("path");
import { functions, parse, emitNode } from ".";
import { printNodes } from "./utils";

xdescribe("Template compiler test suite", () => {
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

xdescribe("Template compiler parser test suite", () => {
  describe("When passing a string", () => {
    it("Should parse string correctly", () => {
      const content = "Service Name";
      const rootNode = parse({
        content
      });
      expect(printNodes(rootNode)).toBe(`[node:GROUP]
  [node:VALUE_FRAGMENT]=Service Name\n`);
    });
  });

  describe("When passing a string with variable template", () => {
    it("Should parse string correctly", () => {
      const content = "ServiceName@${self:version}";
      const rootNode = parse({
        content
      });
      const result = printNodes(rootNode);
      expect(result).toBe(`[node:GROUP]
  [node:VALUE_FRAGMENT]=ServiceName@
  [node:TEMPLATE]
    [node:VARIABLE]
      [node:VALUE]=self
      [node:VALUE]=version\n`);
    });
  });

  describe("When passing a string with function template", () => {
    it("Should parse string correctly", () => {
      const content = "ServiceName@${func(arg1, arg2)}";
      const rootNode = parse({
        content
      });
      const result = printNodes(rootNode);
      expect(result).toBe(`[node:GROUP]
  [node:VALUE_FRAGMENT]=ServiceName@
  [node:TEMPLATE]
    [node:FUNCTION]
      [node:VALUE]=func
      [node:VALUE]=arg1
      [node:VALUE]=arg2\n`);
    });
  });

  describe("When passing a string with nested template with default value", () => {
    it("Should parse string correctly", () => {
      const content = "ServiceName@${replace(${self:version, v0.0.0},.,-)}";
      const rootNode = parse({
        content
      });
      const result = printNodes(rootNode);
      expect(result).toBe(`[node:GROUP]
  [node:VALUE_FRAGMENT]=ServiceName@
  [node:TEMPLATE]
    [node:FUNCTION]
      [node:VALUE]=replace
      [node:TEMPLATE]
        [node:VARIABLE]
          [node:VALUE]=self
          [node:VALUE]=version
          [node:VALUE]=v0.0.0
      [node:VALUE]=.
      [node:VALUE]=-\n`);
    });
  });

  describe("When passing an object", () => {
    it("Should parse object correctly", () => {
      const content = { name: "Service Name" };
      const rootNode = parse({
        content
      });
      expect(printNodes(rootNode)).toBe(`[node:OBJECT]
  [node:PAIR]
    [node:VALUE]=name
    [node:GROUP]
      [node:VALUE_FRAGMENT]=Service Name\n`);
    });
  });
  describe("When passing an array", () => {
    it("Should parse array correctly", () => {
      const content = { hosts: ["0.0.0.0", "127.0.0.1"] };
      const rootNode = parse({
        content
      });
      const result = printNodes(rootNode);
      expect(result).toBe(`[node:OBJECT]
  [node:PAIR]
    [node:VALUE]=hosts
    [node:ARRAY]
      [node:PAIR]
        [node:VALUE]=0
        [node:GROUP]
          [node:VALUE_FRAGMENT]=0.0.0.0
      [node:PAIR]
        [node:VALUE]=1
        [node:GROUP]
          [node:VALUE_FRAGMENT]=127.0.0.1\n`);
    });
  });
});

describe("Template compiler emitter test suite", () => {
  xdescribe("When passing a string", () => {
    it("Should emit string correctly", () => {
      const content = "Service Name";
      const rootNode = parse({
        content
      });
      const result = emitNode({ node: rootNode });
      expect(result).toBe(`Service Name`);
    });
  });

  xdescribe("When passing a string with variable template", () => {
    it("Should emit single string correctly", () => {
      const content = "ServiceName@${self:version}";
      const rootNode = parse({
        content
      });
      const result = emitNode({ node: rootNode });
      expect(result).toBe(`ServiceName@undefined`);
    });
  });

  xdescribe("When passing a string with function template", () => {
    it("Should emit string correctly", () => {
      const content = {
        version: "v1.0.0",
        name: "ServiceName@${func(arg1, arg2)}"
      };
      const rootNode = parse({
        content
      });
      const result = emitNode({
        node: rootNode,
        context: {
          func: ([arg1, arg2]: string[]) => `ok[${arg1}, ${arg2}]`
        }
      });
      expect(result).toEqual({
        version: "v1.0.0",
        name: "ServiceName@ok[arg1, arg2]"
      });
    });
  });

  xdescribe("When passing an object with nested template with default value", () => {
    it("Should emit nested template value correctly", () => {
      const content = {
        version: "v1.0.0",
        name: "ServiceName@${replace(${self:version, v0.0.0},.,-)}"
      };
      const rootNode = parse({
        content
      });
      const result = emitNode({
        node: rootNode
      });
      expect(result).toEqual({ version: "v1.0.0", name: "ServiceName@v1-0.0" });
    });

    it("Should emit self value correctly", () => {
      const content = {
        version: "v1.0.0",
        name: "ServiceName@${self:version}"
      };

      const rootNode = parse({
        content
      });
      const result = emitNode({ node: rootNode });
      expect(result).toEqual({ version: "v1.0.0", name: "ServiceName@v1.0.0" });
    });

    it("Should emit nested template reg express correctly", () => {
      const content = {
        version: "v1.0.0",
        name: "ServiceName@${replace(${self:version, v0.0.0},/\\./gi, -)}"
      };
      const rootNode = parse({
        content
      });
      const result = emitNode({
        node: rootNode
      });
      expect(result).toEqual({ version: "v1.0.0", name: "ServiceName@v1-0-0" });
    });
  });

  describe("When passing an array", () => {
    xit("Should emit array correctly", () => {
      const content = { hosts: ["0.0.0.0", "127.0.0.1"] };
      const rootNode = parse({
        content
      });
      const result = emitNode({
        node: rootNode
      });
      expect(result).toEqual({ hosts: ["0.0.0.0", "127.0.0.1"] });
    });
    xit("Should emit self template array correctly", () => {
      const content = {
        domain: "01alchemist.com",
        hosts: ["0.0.0.0", "127.0.0.1", "${self:domain}"]
      };
      const rootNode = parse({
        content
      });
      console.log(printNodes(rootNode));
      const result = emitNode({
        node: rootNode
      });
      expect(result).toEqual({
        domain: "01alchemist.com",
        hosts: ["0.0.0.0", "127.0.0.1", "01alchemist.com"]
      });
    });
    it("Should emit global template array correctly", () => {
      const content = {
        domain: "01alchemist.com",
        hosts: ["0.0.0.0", "127.0.0.1", "${global:domain}"]
      };
      const rootNode = parse({
        content
      });
      console.log(printNodes(rootNode));
      const result = emitNode({
        node: rootNode
      });
      expect(result).toEqual({
        domain: "01alchemist.com",
        hosts: ["0.0.0.0", "127.0.0.1", "01alchemist.com"]
      });
    });
  });
});
