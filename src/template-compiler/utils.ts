import { NodeKind, Node } from ".";

export function printNodes(node: Node, indent: string = ""): string {
  let str =
    indent +
    `[node:${NodeKind[node.kind]}]${node.value ? `=${node.value}` : ""}\n`;
  let child = node.firstChild;
  while (child) {
    str += printNodes(child, indent + "  ");
    child = child.nextSibling;
  }
  return str;
}
