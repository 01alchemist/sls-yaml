import { compile } from "./sls-yaml-compiler";
const fs = require("fs");
const yaml = require("js-yaml");

type ParentNode = {
  name: string;
  self: any;
};

export function readYamlSync(pathOrData: string | Buffer, parent?: ParentNode) {
  try {
    let data,
      basePath = "./";
    if (pathOrData instanceof Buffer) {
      data = pathOrData;
    } else if (typeof pathOrData === "string") {
      basePath = pathOrData.substring(0, pathOrData.lastIndexOf("/"));
      data = fs.readFileSync(pathOrData, "utf8");
    }
    const doc = yaml.safeLoad(data);
    let globalObj = doc;
    if (parent) {
      globalObj = {
        ...parent.self,
        [parent.name]: doc
      };
    }

    const compiledDoc = compile({ doc, globalObj, basePath });
    return compiledDoc;
  } catch (e) {
    console.log(e);
  }
}

export default readYamlSync;
