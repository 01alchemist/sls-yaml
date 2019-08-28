import { compile } from "../sls-yaml-compiler";
import { ParentObject, Path } from "~/types";
const fs = require("fs");
const util = require("util");
const yaml = require("js-yaml");

function encodeHelmTemplates(data: string) {
  const lines = data.split("\n");
  return lines
    .map(line => {
      if (line) {
        let values = line;
        let key;
        let isArrayElement = false;
        const [_key, ...value] = line.split(":");

        if (_key.trim().startsWith(" -") && value[0] !== " ") {
          console.log("_key:", _key.trim());
          isArrayElement = true;
          values = line;
        } else {
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
  if (!data) {
    return data;
  }
  const lines = data.split("\n");
  return lines
    .map(line => {
      if (line) {
        let values = line;
        let key;
        let isArrayElement = false;
        const [_key, ...value] = line.split(":");
        if (_key.trim().startsWith(" -") && value[0] !== " ") {
          console.log("_key:", _key.trim());
          isArrayElement = true;
          values = line;
        } else {
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
  parent?: ParentObject
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
  console.log(data);

  const doc = yaml.safeLoad(data);
  let globalObj: any = null;
  let parentPath: any = null;
  if (parent) {
    globalObj = parent.global;
    parentPath = parent.parentPath;
  }
  const compiledDoc = compile({
    doc,
    globalObj,
    parentPath,
    basePath
  });
  let yamlData;
  try {
    yamlData = yaml.safeDump(compiledDoc);
  } catch (e) {
    console.log(e);
    console.log(util.inspect(compiledDoc, { depth: null }));
  }

  const decodedYaml = decodeHelmTemplates(yamlData);
  console.log(decodedYaml);

  return decodedYaml;
}
