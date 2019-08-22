import { NodeKind, Node, print, parseToken, Scope } from "./template-compiler";

type ParseArg = {
  content: any;
  parent: any;
  basePath: string;
  globalObj: any;
  selfObj: any;
};

function parse({
  content,
  parent = {},
  basePath,
  globalObj,
  selfObj
}: ParseArg): any {
  if (typeof content === "object") {
    if (!content) {
      const valueNode = new Node(NodeKind.VALUE, new Scope(0, -1));
      valueNode.value = content;
      return valueNode;
    }
    const keys = Object.keys(content);
    keys.forEach(key => {
      let value = content[key];
      let newValue = null;
      if (typeof value === "string") {
        newValue = print({
          node: parseToken(value),
          basePath,
          parentName: key,
          globalObj,
          selfObj
        });
      } else if (typeof value === "object") {
        const child = Array.isArray(value) ? [] : {};
        newValue = print({
          node: parse({
            content: value,
            parent: child,
            basePath,
            globalObj,
            selfObj
          }),
          basePath,
          parentName: key,
          globalObj,
          selfObj
        });
      } else {
        newValue = value;
      }
      parent[key] = newValue;
      selfObj[key] = newValue;
    });
    return parent;
  }
  // Convert all non-objects to string
  return print({
    node: parseToken(content.toString()),
    basePath,
    parentName: "",
    globalObj,
    selfObj
  });
}

type CompileOptions = {
  doc: any;
  globalObj: any;
  basePath: string;
};

export function compile({ doc, globalObj, basePath }: CompileOptions) {
  const selfObj = doc;
  const parent = {};
  const node = parse({ content: doc, parent, basePath, globalObj, selfObj });
  return node;
}
