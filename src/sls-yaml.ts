import { compile } from "./sls-yaml-compiler";
import { Path, ParentObject } from './types';
const fs = require("fs");
const yaml = require("js-yaml");

export function readYamlSync(pathOrData: Path | Buffer, parent?: ParentObject) {
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
  let globalObj: any = {};
  let selfObj: any = {};
  let parentName = "";
  if (parent) {
    parentName = parent.name;
    globalObj = parent.global;
    globalObj[parentName] = selfObj;
  }

  const compiledDoc = compile({
    doc,
    globalObj,
    selfObj,
    parentName,
    basePath
  });

  return compiledDoc;
}

export default readYamlSync;
