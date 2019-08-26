import { compile } from "./sls-yaml-compiler";
const fs = require("fs");
const yaml = require("js-yaml");

type ParentNode = {
  name: string;
  self: any;
};

type Path = string;

export function readYamlSync(pathOrData: Path | Buffer, parent?: ParentNode) {
  let data,
    basePath = "./";

  if (typeof pathOrData === "string") {
    basePath = pathOrData.substring(0, pathOrData.lastIndexOf("/"));
    data = fs.readFileSync(pathOrData, "utf8");
  }
  if (pathOrData instanceof Buffer) {
    data = pathOrData.toString();
  }

  const doc = yaml.safeLoad(data);
  let globalObj = doc;
  let parentName = "";
  if (parent) {
    parentName = parent.name;
    globalObj = {
      ...parent.self,
      [parent.name]: doc
    };
  }

  const compiledDoc = compile({
    doc,
    globalObj,
    parentName,
    basePath
  });
  return compiledDoc;
}

export default readYamlSync;
