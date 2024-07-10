import { NodeKind, Node } from '.'

export function printNodes(node: Node | null, indent: string = ''): string {
  if (node) {
    let str =
      indent +
      `[node:${NodeKind[node.kind]}]${
        node.value !== undefined ? `=${node.value}` : ''
      }\n`
    let child = node.firstChild
    while (child) {
      str += printNodes(child, indent + '  ')
      child = child.nextSibling
    }
    return str
  }
  return ''
}
