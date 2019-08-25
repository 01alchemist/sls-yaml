import { compile } from "../sls-yaml-compiler";
const fs = require("fs");
const yaml = require("js-yaml");

type ParentNode = {
  name: string;
  self: any;
};

type Path = string;

function encodeHelmTemplates(data: string) {
  const lines = data.split("\n");
  return lines
    .map(line => {
      if (line) {
        let values = line;
        let key;
        let isArrayElement = false;
        if (line.trim().startsWith("-")) {
          isArrayElement = true;
          values = line;
        } else {
          const [_key, ...value] = line.split(":");
          key = _key;
          values = value.join(":").trim();
        }

        if (values && values.match(/({(\s*){)(\W|\w)*(}(\s*)})/gi)) {
          let encodedValues;
          if (isArrayElement) {
            const [indent, ...rest] = values.split("-");
            const arrayValue = rest.join("-").trim();
            encodedValues = `${indent}- '${arrayValue
              .replace(/{\s*{/gi, "%[")
              .replace(/}\s*}/gi, "]%")}'`;
          } else {
            encodedValues = `'${values
              .replace(/{\s*{/gi, "%[")
              .replace(/}\s*}/gi, "]%")}'`;
          }
          const result = key ? `${key}: ${encodedValues}` : encodedValues;
          return result;
        }
      }
      return line;
    })
    .join("\n");
}

function decodeHelmTemplates(data: string) {
  const lines = data.split("\n");
  return lines
    .map(line => {
      if (line) {
        let values = line;
        let key;
        let isArrayElement = false;
        if (line.trim().startsWith("-")) {
          values = line;
          isArrayElement = true;
        } else {
          const [_key, ...value] = line.split(":");
          key = _key;
          values = value.join(":").trim();
        }

        if (values && values.match(/(%\[)(\W|\w)*(]%)/gi)) {
          if (isArrayElement) {
            const [indent, ...reset] = values.split("-");
            let arrayValue = reset.join("-").trim();
            arrayValue = arrayValue.substring(1, arrayValue.length - 1).trim();
            values = `${indent}- ${arrayValue}`;
          } else {
            values = values.substring(1, values.length - 1).trim();
          }
        }
        const decodedValues = `${values
          .replace(/%\[/gi, "{{")
          .replace(/]%/gi, "}}")}`;

        const result = key ? `${key}: ${decodedValues}` : decodedValues;
        return result;
      }
      return line;
    })
    .join("\n");
}

export function readHelmTemplateSync(
  pathOrData: Path | Buffer,
  parent?: ParentNode
) {
  let data,
    basePath = "./";

  if (typeof pathOrData === "string") {
    basePath = pathOrData.substring(0, pathOrData.lastIndexOf("/"));
    data = fs.readFileSync(pathOrData, "utf8");
  }
  /* istanbul ignore next */
  if (pathOrData instanceof Buffer) {
    data = pathOrData.toString();
  }
  data = encodeHelmTemplates(data);

  const doc = yaml.safeLoad(data);

  let globalObj = doc;
  if (parent) {
    globalObj = {
      ...parent.self,
      [parent.name]: doc
    };
  }

  const compiledDoc = compile({ doc, globalObj, basePath });
  const yamlData = yaml.safeDump(compiledDoc);

  const decodedYaml = decodeHelmTemplates(yamlData);
  return decodedYaml;
}
