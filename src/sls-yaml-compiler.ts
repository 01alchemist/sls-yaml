import { NodeKind, Node, emitNode, Scope, parse } from "./template-compiler";

type CompileOptions = {
  doc: any;
  globalObj: any;
  selfObj: any;
  basePath: string;
  parentName: string;
};

export function compile({
  doc,
  globalObj,
  selfObj,
  basePath,
  parentName = ""
}: CompileOptions) {
  const parent = new Node(NodeKind.GROUP, new Scope(0));
  const node = parse({ content: doc, parent });

  const compiledJson = emitNode({
    node,
    basePath,
    parentName,
    globalObj,
    selfObj
  });
  return compiledJson;
}
