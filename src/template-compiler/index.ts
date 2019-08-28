const fs = require("fs");
// const util = require("util");
const path = require("path");
const { spawnSync } = require("child_process");
const get = require("lodash.get");
const set = require("lodash.set");
import readYamlSync from "../sls-yaml";
import { readHelmTemplateSync } from "../helm-template";
import { printNodes } from "./utils";
if (printNodes) {
}
type FunctionMap = {
  [key: string]: Function;
};

export const YamlError: FunctionMap = {
  UnknonwReference: (name: string) =>
    `Unknonw reference error, "${name}" is not a known reference name`
};

export const functions: FunctionMap = {
  file: (
    [uri, encoding]: [string, string],
    { basePath, parentName, globalObj, parentPath, parentObj }: any
  ) => {
    const ext = uri.substring(uri.lastIndexOf(".") + 1, uri.length);
    const resolvedPath = path.resolve(basePath, uri);
    if (encoding === "utf-8") {
      return fs.readFileSync(resolvedPath, "utf-8");
    }

    /**
     * If there is no parent
     * Create parentObj and assign self and global obj accordingly
     */
    if (!parentObj) {
      parentObj = {};
    }

    if (!globalObj) {
      globalObj = parentObj;
    }

    if (parentName) {
      parentPath = parentPath ? `${parentPath}.${parentName}` : parentName;
    }
    let result = null;

    switch (ext) {
      case "yaml":
      case "yml":
        if (encoding === "helm") {
          result = readHelmTemplateSync(fs.readFileSync(resolvedPath), {
            global: globalObj,
            parentPath
          });
        } else {
          result = readYamlSync(resolvedPath, {
            global: globalObj,
            parentPath
          });
        }
        break;
      case "json":
        result = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
        break;
      default:
        result = fs.readFileSync(resolvedPath, "utf-8");
        break;
    }

    return result;
  },
  git: ([name]: string[]) => {
    let cmds;
    switch (name) {
      /* istanbul ignore next */
      case "branch":
        cmds = ["rev-parse", "--abbrev-ref", "HEAD"];
        break;
      case "sha1":
        cmds = ["rev-parse", "HEAD"];
        break;
    }
    const result = spawnSync("git", cmds);
    const output = result.output.toString().replace(/,|\n/gi, "");
    return output;
  },
  env: ([name]: string[]) => {
    return process.env[name];
  },
  global: ([name]: string[], { globalObj }: any) => {
    return get(globalObj, name);
  },
  self: ([name]: string[], { selfObj }: any) => {
    return get(selfObj, name);
  },
  helm: ([template]: string[]) => {
    const c0 = template[0];
    const cl = template[template.length - 1];
    if ((c0 === `"` && cl === `"`) || (c0 === `'` && cl === `'`)) {
      return `'{{ ${template.substring(1, template.length - 1)} }}'`;
    }
    /* istanbul ignore next */
    return `{{ ${template} }}`;
  },
  replace: ([source, _searchValue, replaceValue]: string[]) => {
    let searchValue: string | RegExp = _searchValue;
    if (searchValue.startsWith("/")) {
      const result = _searchValue.match(/(?<=\/)(.*?)(?=\/)|(?<=\/)(\w*)/gi);
      if (result) {
        const [pattern, flags]: string[] = result;
        searchValue = new RegExp(pattern, flags);
      }
    }
    return source.replace(searchValue, replaceValue);
  }
};

export enum NodeKind {
  KEY,
  VALUE,
  VALUE_FRAGMENT,
  NAME,
  ARG,
  GROUP,
  PAIR,
  ARRAY,
  OBJECT,
  TEMPLATE,
  FUNCTION,
  VARIABLE
}

export class Scope {
  constructor(public start: number, public end: number = -1) {}
}

export class Node {
  value: any;

  parent: Node | null = null;

  nextSibling: Node | null = null;
  firstChild: Node | null = null;
  lastChild: Node | null = null;

  scope?: Scope;

  constructor(public kind: NodeKind, scope?: Scope) {
    if (scope) this.scope = scope;
  }

  setScopeEnd(end: number): void {
    if (this.scope) {
      this.scope.end = end;
    }
  }
}

export enum TokenKind {
  TEMPLATE_OPEN,
  // Brackets
  LEFT_BRACE,
  RIGHT_BRACE,
  LEFT_BRACKET,
  RIGHT_BRACKET,
  LEFT_PARENTHESIS,
  RIGHT_PARENTHESIS,

  DOLLAR,
  COLON,

  DOT,
  COMMA,
  DEFAULT_VALUE
}

export const tokens: any = {
  $: TokenKind.DOLLAR,
  "${": TokenKind.TEMPLATE_OPEN,
  "{": TokenKind.LEFT_BRACE,
  "}": TokenKind.RIGHT_BRACE,
  "(": TokenKind.LEFT_PARENTHESIS,
  ")": TokenKind.RIGHT_PARENTHESIS,
  "[": TokenKind.LEFT_BRACKET,
  "]": TokenKind.RIGHT_BRACKET,
  ":": TokenKind.COLON
};

export const tokenValues = Object.keys(tokens);

function createNode(
  parent: Node | null,
  kind: NodeKind,
  scope?: Scope,
  value?: any
) {
  const node = new Node(kind, scope);
  if (value !== undefined) node.value = value;
  if (parent) {
    node.parent = parent;
    if (!parent.firstChild) parent.firstChild = node;
    if (parent.lastChild) {
      parent.lastChild.nextSibling = node;
    }
    parent.lastChild = node;
  }
  return node;
}

function lastTemplate(node: Node | null) {
  if (node && node.parent) {
    if (
      node.parent.kind === NodeKind.FUNCTION ||
      node.parent.kind === NodeKind.VARIABLE
    ) {
      return node.parent.parent;
    }
    return node.parent;
  }
  /* istanbul ignore next */
  return null;
}

/**
 * Parse template tokens and create node tree
 * @param {string} value
 */
export function parseToken(value: any, parent: Node | null = null) {
  let buffer: string = "";
  const parentNode = createNode(
    parent,
    NodeKind.GROUP,
    new Scope(0, value.length)
    // value
  );

  let lastParent: Node | null = parentNode;
  let nodeStack: Node[] = [];
  const charStream = value.split("");
  /**
   * Tokenize
   */
  charStream.forEach((char: string, i: number) => {
    buffer += char;
    /**
     * Match single char tokens
     */
    if (tokenValues.indexOf(char) > -1) {
      /**
       * Template open
       */
      if (tokens[char] === TokenKind.DOLLAR) {
        if (buffer.length > 1) {
          const start = i - buffer.length - 1;
          const end = i - 1;
          createNode(
            lastParent,
            NodeKind.VALUE_FRAGMENT,
            new Scope(start, end),
            buffer.substring(0, buffer.length - 1)
          );
        }

        buffer = char;
      }

      /**
       * Only process function and variable tokens if there is a template node
       */
      if (lastParent && lastParent.kind === NodeKind.TEMPLATE) {
        /**
         * Variable or Function open
         */
        const isVariable = tokens[char] === TokenKind.COLON;
        if (tokens[char] === TokenKind.LEFT_PARENTHESIS || isVariable) {
          const name = buffer.substring(0, buffer.length - 1).trim();
          const childNode = createNode(
            lastParent,
            isVariable ? NodeKind.VARIABLE : NodeKind.FUNCTION,
            new Scope(i)
          );

          childNode.firstChild = createNode(
            childNode,
            NodeKind.NAME,
            new Scope(i),
            name
          );

          nodeStack.push(childNode);
          buffer = "";
        }

        /**
         * Template close
         */
        if (tokens[char] === TokenKind.RIGHT_BRACE) {
          const childNode = nodeStack.pop();
          if (childNode) {
            const end =
              buffer.length - (childNode.kind === NodeKind.FUNCTION ? 2 : 1);
            buffer = buffer.substring(0, end);
            if (childNode.parent) {
              childNode.parent.setScopeEnd(i);
            }
            childNode.setScopeEnd(i);
            if (buffer[0] === ",") {
              buffer = buffer.substring(1);
            }
            buffer.split(",").map(v => {
              v = v.trim();
              createNode(childNode, NodeKind.ARG, new Scope(i), v);
              return v;
            });
          }

          buffer = "";
          lastParent = lastTemplate(lastParent);
        }
      }
    }

    if (tokens[buffer] === TokenKind.TEMPLATE_OPEN) {
      if (lastParent && lastParent.kind === NodeKind.TEMPLATE) {
        lastParent = lastParent.firstChild;
      }
      lastParent = createNode(lastParent, NodeKind.TEMPLATE, new Scope(i));
      buffer = "";
    }
  });
  if (buffer.length > 0) {
    const start = charStream.length - buffer.length;
    const end = charStream.length;
    createNode(
      parentNode,
      NodeKind.VALUE_FRAGMENT,
      new Scope(start, end),
      buffer
    );
  }

  return parentNode;
}

type EmitNodeArg = {
  node: Node | null;
  basePath?: string;
  parentObj?: any;
  parentName?: string | null;
  parentPath?: string | null;
  globalObj?: any;
  selfObj?: any;
  thisObj?: any;
  context?: any;
};

/**
 * Print compiled template
 * @param options
 */
export function emitNode({
  node,
  basePath = ".",
  parentPath = "",
  parentName = null,
  globalObj = null,
  selfObj = null,
  parentObj = null,
  thisObj = null,
  context = {}
}: EmitNodeArg): any {
  let options = {
    basePath,
    parentName,
    parentPath,
    parentObj,
    globalObj,
    selfObj,
    thisObj,
    context
  };
  /* istanbul ignore next */
  if (!node) {
    return null;
  }

  switch (node.kind) {
    case NodeKind.OBJECT:
    case NodeKind.ARRAY: {
      let thisObj = node.kind === NodeKind.ARRAY ? [] : {};

      if (parentName) {
        parentPath = parentPath ? `${parentPath}.${parentName}` : parentName;
      }
      if (parentObj && parentName) {
        parentObj[parentName] = thisObj;
      } else {
        parentObj = thisObj;
      }

      if (!selfObj) {
        selfObj = parentObj;
      }

      if (!globalObj) {
        globalObj = selfObj;
      } else {
        set(globalObj, parentPath, thisObj);
      }

      let child = node.firstChild;
      while (child) {
        emitNode({
          node: child,
          ...options,
          parentPath,
          globalObj,
          selfObj,
          parentObj,
          thisObj
        });
        child = child.nextSibling;
      }
      // if (parentName === null)
      //   console.log(
      //     `----- parentName:${parentName}\n`,
      //     util.inspect(
      //       {
      //         selfObj,
      //         parentObj,
      //         thisObj
      //       },
      //       { depth: null }
      //     )
      //   );
      return thisObj;
    }
    /**
     * Key value pair
     */
    case NodeKind.PAIR: {
      let keyNode = node.firstChild;
      /* istanbul ignore next */
      if (keyNode) {
        let valueNode = keyNode.nextSibling;
        const key = emitNode({
          node: keyNode,
          ...options
        });
        emitNode({
          node: valueNode,
          ...options,
          parentName: key,
          parentObj: thisObj
        });
      }
      return thisObj;
    }
    case NodeKind.GROUP: {
      let child = node.firstChild;
      let finalValue = "";
      while (child) {
        const value = emitNode({
          node: child,
          ...options
        });

        if (
          finalValue === "" ||
          (typeof value === "object" && value !== null)
        ) {
          finalValue = value;
        } else {
          finalValue += value;
        }
        child = child.nextSibling;
      }

      if (parentObj && parentName) {
        parentObj[parentName] = finalValue;
      }
      return finalValue;
    }
    case NodeKind.KEY:
    case NodeKind.NAME:
    case NodeKind.ARG:
    case NodeKind.VALUE_FRAGMENT:
      return node.value;

    case NodeKind.VALUE: {
      const value = node.value;
      if (parentObj && parentName) {
        parentObj[parentName] = value;
      }
      return value;
    }
    case NodeKind.TEMPLATE: {
      const child: Node = <Node>node.firstChild;
      return emitNode({
        node: child,
        ...options
      });
    }
    case NodeKind.FUNCTION:
    case NodeKind.VARIABLE: {
      let child = node.firstChild;
      let functionName = "unknown";
      if (child) {
        functionName = child.value;
        child = child.nextSibling;
      }
      const _arguments = [];

      while (child) {
        if (child.kind === NodeKind.ARG) {
          _arguments.push(child.value);
        } else {
          const result = emitNode({
            node: child,
            ...options
          });
          _arguments.push(result);
        }
        child = child.nextSibling;
      }

      let func = context[functionName];
      func = func || functions[functionName];

      if (func) {
        const result = func(_arguments, {
          ...options
        });
        return result;
      }
      throw new Error(YamlError.UnknonwReference(functionName));
    }
  }
  /* istanbul ignore next */
  return node;
}

type ParseArg = {
  content: any;
  parent?: any;
};

export function parse({ content, parent = null }: ParseArg): any {
  if (typeof content === "object") {
    if (!content) {
      return createNode(parent, NodeKind.VALUE, new Scope(0), content);
    }
    const kind = Array.isArray(content) ? NodeKind.ARRAY : NodeKind.OBJECT;
    const lastParent = createNode(parent, kind, new Scope(0));
    const keys = Object.keys(content);
    keys.forEach(key => {
      const itemNode = createNode(lastParent, NodeKind.PAIR);
      createNode(itemNode, NodeKind.KEY, new Scope(0), key);
      parse({
        content: content[key],
        parent: itemNode
      });
    });
    return lastParent;
  }
  if (typeof content === "string") {
    return parseToken(content, parent);
  } else {
    return createNode(parent, NodeKind.VALUE, new Scope(0), content);
  }
}
