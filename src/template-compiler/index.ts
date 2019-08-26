const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const get = require("lodash.get");
import readYamlSync from "../sls-yaml";
import { readHelmTemplateSync } from "../helm-template";
// import { printNodes } from "./utils";

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
    { basePath, parentName, globalObj, selfObj }: any
  ) => {
    const ext = uri.substring(uri.lastIndexOf(".") + 1, uri.length);
    const resolvedPath = path.resolve(basePath, uri);
    if (encoding === "utf-8") {
      return fs.readFileSync(resolvedPath, "utf-8");
    }
    if (encoding === "helm") {
      return readHelmTemplateSync(fs.readFileSync(resolvedPath), {
        name: parentName,
        self: globalObj
      });
    }
    if (ext === "yml") {
      console.log({ globalObj, selfObj });
      const ymlObj = readYamlSync(resolvedPath, {
        name: parentName,
        self: selfObj
      });
      return ymlObj;
    } else if (ext === "json") {
      return JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
    } else {
      return fs.readFileSync(resolvedPath, "utf-8");
    }
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
  VALUE,
  VALUE_FRAGMENT,
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
  // prevSibling: Node | null = null;
  firstChild: Node | null = null;
  lastChild: Node | null = null;

  scope?: Scope;

  constructor(public kind: NodeKind, scope?: Scope) {
    if (scope) this.scope = scope;
  }

  setScope(start: number, end: number = -1): void {
    if (this.scope) {
      this.scope.start = start;
      this.scope.end = end;
    }
  }
  setScopeEnd(end: number): void {
    if (this.scope) {
      this.scope.end = end;
    }
  }
}

export class Result {
  constructor(public value: string, public scope?: Scope) {}
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
          const name = buffer.substring(0, buffer.length - 1);
          const childNode = createNode(
            lastParent,
            isVariable ? NodeKind.VARIABLE : NodeKind.FUNCTION,
            new Scope(i)
          );

          childNode.firstChild = createNode(
            childNode,
            NodeKind.VALUE,
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
              createNode(childNode, NodeKind.VALUE, new Scope(i), v);
              return v;
            });
          }

          buffer = "";
          lastParent =
            lastParent && lastParent.parent && lastParent.parent.parent;
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
  parentName?: string;
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
  parentName = "",
  globalObj = null,
  selfObj = null,
  thisObj = {},
  context = {}
}: EmitNodeArg): any {
  if (!selfObj) {
    selfObj = {};
  }
  if (!globalObj) {
    globalObj = selfObj;
  } else if (parentName) {
    globalObj[parentName] = selfObj;
  }
  // console.log(printNodes(node));

  const options = {
    basePath,
    parentName,
    globalObj,
    selfObj,
    thisObj,
    context
  };
  if (!node) {
    /* istanbul ignore next */
    return null;
  }
  switch (node.kind) {
    case NodeKind.OBJECT:
    case NodeKind.ARRAY: {
      let thisObj = node.kind === NodeKind.ARRAY ? [] : {};
      let child = node.firstChild;
      while (child) {
        const keyValue = emitNode({
          node: child,
          ...options,
          thisObj
        });
        const targetObject = parentName ? selfObj[parentName] : selfObj;
        if (!targetObject) {
          selfObj[parentName] = keyValue;
        } else {
          Object.keys(keyValue).forEach(key => {
            const value = keyValue[key];
            targetObject[key] = value;
          });
        }
        child = child.nextSibling;
      }
      return thisObj;
    }
    case NodeKind.PAIR: {
      let keyNode = node.firstChild;
      if (keyNode) {
        let valueNode = keyNode.nextSibling;
        const key = emitNode({
          node: keyNode,
          ...options
        });
        const value = emitNode({
          node: valueNode,
          ...options,
          parentName: key
        });
        thisObj[key] = value;
      }
      return thisObj;
    }
    case NodeKind.GROUP: {
      let child = node.firstChild;
      let finalValue = "";
      while (child) {
        const result = emitNode({
          node: child,
          ...options
        });

        if (result) {
          const value = result.value;
          if (
            finalValue === "" ||
            (typeof value === "object" && value !== null)
          ) {
            finalValue = value;
          } else {
            finalValue += value;
          }
        } else {
          /* istanbul ignore next */
          finalValue = result;
        }
        child = child.nextSibling;
      }
      return finalValue;
    }
    case NodeKind.VALUE: {
      return node.value;
    }
    case NodeKind.TEMPLATE: {
      const child: Node = <Node>node.firstChild;
      const result = emitNode({
        node: child,
        ...options
      });
      return new Result(result.value, node.scope);
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
        if (child.kind === NodeKind.VALUE) {
          _arguments.push(child.value);
        } else {
          const result = emitNode({
            node: child,
            ...options
          });
          _arguments.push(result.value);
        }
        child = child.nextSibling;
      }

      let func = context[functionName];
      func = func || functions[functionName];

      if (func) {
        const __arguments = _arguments.map((arg: any) => {
          if (arg instanceof Node) {
            const result = emitNode({
              node: arg,
              ...options
            });
            return result.value;
          } else {
            return arg;
          }
        });
        const result = func(__arguments, {
          ...options
        });
        return new Result(result, node.scope);
      }
      throw new Error(YamlError.UnknonwReference(functionName));
    }
  }
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
      createNode(itemNode, NodeKind.VALUE, new Scope(0), key);
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
