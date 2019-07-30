import yaml from "./sls-yaml";

describe("yaml-loader test suite", () => {
  describe("YAML standard spec test suite", () => {
    it("Test #1", () => {
      const content = Buffer.from(`version: 1`);
      const doc = yaml(content);
      expect(doc).toEqual({ version: 1 });
    });
  });

  describe("YAML extended test suite", () => {
    describe("When passing yaml file path", () => {
      it("Should load yaml from path", () => {
        const doc = yaml("src/__mocks__/file.yml");
        expect(doc).toEqual({ key: "value" });
      });
    });
    describe("When passing yaml file buffer", () => {
      it("Should load yaml from path", () => {
        const doc = yaml("src/__mocks__/file.yml");
        expect(doc).toEqual({ key: "value" });
      });
    });

    describe("When passing a yaml file reference", () => {
      it("Should replace value with file content", () => {
        const content = Buffer.from("config: ${file(src/__mocks__/file.yml)}");
        const doc = yaml(content);
        expect(doc).toEqual({ config: { key: "value" } });
      });
    });

    describe("When passing a yaml file reference without key", () => {
      it("Should replace value with file content", () => {
        const content = Buffer.from("${file(src/__mocks__/file.yml)}");
        const doc = yaml(content);
        expect(doc).toEqual({ key: "value" });
      });
    });

    describe("When passing a json file reference", () => {
      it("Should replace value with file's content", () => {
        const content = Buffer.from("json: ${file(src/__mocks__/file.json)}");
        const doc = yaml(content);
        expect(doc).toEqual({ json: { name: "Json", value: 100 } });
      });
    });

    describe("When passing a text file reference", () => {
      it("Should replace value with file's content", () => {
        const content = Buffer.from("text: ${file(src/__mocks__/file.txt)}");
        const doc = yaml(content);
        expect(doc).toEqual({ text: "This is external text content\n" });
      });
    });

    describe("When passing a env reference", () => {
      it("Should replace env var with it's value", () => {
        const content = Buffer.from("config: ${env:NODE_ENV}");
        const doc = yaml(content);
        expect(doc).toEqual({ config: "test" });
      });
    });
    describe("When passing a undefined env reference", () => {
      it("Should replace env var with undefined object", () => {
        const content = Buffer.from("config: ${env:IAM_NOT_EXIST}");
        const doc = yaml(content);
        expect(doc).toEqual({ config: undefined });
      });
    });
    describe("When passing a env reference with prefix", () => {
      it("Should return prefix plus replace env var with it's value", () => {
        const content = Buffer.from("config: prefix-${env:NODE_ENV}");
        const doc = yaml(content);
        expect(doc).toEqual({ config: "prefix-test" });
      });
    });
    describe("When passing a env reference with suffix", () => {
      it("Should return suffix plus replace env var with it's value", () => {
        const content = Buffer.from("config: ${env:NODE_ENV}-suffix");
        const doc = yaml(content);
        expect(doc).toEqual({ config: "test-suffix" });
      });
    });
    describe("When passing a env reference with prefix and suffix", () => {
      it("Should return prefix and suffix plus replace env var with it's value", () => {
        const content = Buffer.from("config: prefix-${env:NODE_ENV}-suffix");
        const doc = yaml(content);
        expect(doc).toEqual({ config: "prefix-test-suffix" });
      });
    });
    describe("When passing a self reference", () => {
      it("Should replace self var with it's value", () => {
        const content = Buffer.from(
          ["version: 1", "config: version-${self:version}"].join("\n")
        );
        const doc = yaml(content);
        expect(doc).toEqual({ version: 1, config: "version-1" });
      });
    });
    describe("When passing a self reference with null value", () => {
      it("Should return prefix plus replace self var with null", () => {
        const content = Buffer.from(
          ["version: null", "config: version-${self:version}"].join("\n")
        );
        const doc = yaml(content);
        expect(doc).toEqual({ version: null, config: "version-null" });
      });
      it("Should replace self var with null", () => {
        const content = Buffer.from(
          ["version: null", "config: ${self:version}"].join("\n")
        );
        const doc = yaml(content);
        expect(doc).toEqual({ version: null, config: null });
      });
    });
    describe("When passing a file reference with env references", () => {
      it("Should replace value with file content", () => {
        const content = Buffer.from(
          "config: ${file(src/__mocks__/file-env.yml)}"
        );
        const doc = yaml(content);
        expect(doc).toEqual({ config: { key: "value-test" } });
      });
    });
    describe("When passing a file reference with self references", () => {
      it("Should replace value with file content", () => {
        const content = Buffer.from(
          "config: ${file(src/__mocks__/file-self.yml)}"
        );
        const expected = {
          config: { a: { b: "value-of-b" }, key: "key+value-of-b" }
        };
        const doc = yaml(content);
        expect(doc).toEqual(expected);
      });
    });
    describe("When passing a file reference with self references within a file reference", () => {
      it("Should replace value with file content", () => {
        const content = Buffer.from(
          "config: ${file(src/__mocks__/file-file-self.yml)}"
        );
        const expected = {
          config: { env: "development", values: { key: "key+development" } }
        };
        const doc = yaml(content);
        expect(doc).toEqual(expected);
      });
    });

    describe("When passing a file reference with dynamic self references within a file reference", () => {
      it("Should replace value with file content", () => {
        const content = Buffer.from(
          "config: ${file(src/__mocks__/file-file-self-dynamic.yml)}"
        );
        const expected = {
          config: { env: "development", values: { key: "key+development" } }
        };
        const doc = yaml(content);
        expect(doc).toEqual(expected);
      });
    });

    describe("When passing boolean values", () => {
      it("Should cast boolean:true values properly", () => {
        const content = Buffer.from(
          [
            "is-enabled: true",
            "isEnabled: ${self:is-enabled}",
            "title: Feature enabled=${self:is-enabled}"
          ].join("\n")
        );
        const expected = {
          "is-enabled": true,
          isEnabled: true,
          title: "Feature enabled=true"
        };
        const doc = yaml(content);
        expect(doc).toEqual(expected);
      });

      it("Should cast boolean:false values properly", () => {
        const content = Buffer.from(
          [
            "is-enabled: false",
            "isEnabled: ${self:is-enabled}",
            "title: Feature enabled=${self:is-enabled}"
          ].join("\n")
        );
        const expected = {
          "is-enabled": false,
          isEnabled: false,
          title: "Feature enabled=false"
        };
        const doc = yaml(content);
        expect(doc).toEqual(expected);
      });
    });
  });

  describe("YAML extended exception test suite", () => {
    describe("When passing an unknown function reference", () => {
      it("Should throw unknonw reference error", () => {
        const content = Buffer.from(
          "config: ${unknown(src/__mocks__/file.yml)}"
        );

        expect(() => {
          yaml(content);
        }).toThrowError(
          `Unknonw reference error, "unknown" is not a known reference name`
        );
      });
    });

    describe("When passing integer values", () => {
      it("Should cast integer values properly", () => {
        const content = Buffer.from(
          [
            "replicas: 3",
            "numReplicas: ${self:replicas}",
            "title: No of replicas=${self:replicas}"
          ].join("\n")
        );
        const expected = {
          replicas: 3,
          numReplicas: 3,
          title: "No of replicas=3"
        };
        const doc = yaml(content);
        expect(doc).toEqual(expected);
      });
    });

    describe("When passing an unknown variable reference", () => {
      it("Should throw unknonw reference error", () => {
        const content = Buffer.from("config: ${unknown:my.var}");

        expect(() => {
          yaml(content);
        }).toThrowError(
          `Unknonw reference error, "unknown" is not a known reference name`
        );
      });
    });
  });
});
