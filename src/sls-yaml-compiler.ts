import { NodeKind, Node, emitNode, Scope, parse } from "./template-compiler";

type CompileOptions = {
  doc: any;
  globalObj: any;
  parentPath: string;
  basePath: string;
  context?: any;
};

export function compile({
  doc,
  globalObj,
  parentPath,
  basePath,
  context
}: CompileOptions) {
  const parent = new Node(NodeKind.GROUP, new Scope(0));
  const node = parse({ content: doc, parent });
  const compiledJson = emitNode({
    node,
    basePath,
    parentPath,
    globalObj,
    context
  });
  return compiledJson;
}
