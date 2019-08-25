const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const get = require("lodash.get");
import readYamlSync from "../sls-yaml";
import { readHelmTemplateSync } from "../helm-template";

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
    { basePath, parentName, globalObj }: any
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
      const ymlObj = readYamlSync(resolvedPath, {
        name: parentName,
        self: globalObj
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
  replace: ([source, substr, newSubstr]: string[]) => {
    return source.replace(substr, newSubstr);
  }
};

export enum NodeKind {
  VALUE,
  VALUE_FRAGMENT,
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
  constructor(public kind: NodeKind, public scope: Scope) {}
}

export class Result {
  constructor(
    public value: string,
    public start: number,
    public end: number = -1
  ) {}
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
  scope: Scope,
  value?: any
) {
  const node = new Node(kind, scope);
  if (value) node.value = value;
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
export function parseToken(value: any) {
  let buffer: string = "";
  const parentNode = new Node(NodeKind.VALUE, new Scope(0, value.length));
  parentNode.value = value;
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
            new Scope(i),
            {
              name,
              arguments: [],
              rawValue: buffer
            }
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
              childNode.parent.scope.end = i;
            }
            childNode.scope.end = i;
            const _arguments = buffer.split(",").map(v => {
              v = v.trim();
              createNode(childNode, NodeKind.VALUE, new Scope(i), v);
              return v;
            });

            childNode.value.arguments = _arguments;
            childNode.value.rawValue += buffer;
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

  if (buffer.length > 1) {
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

type PrintArg = {
  node: Node | null;
  basePath: string;
  parentName: string;
  globalObj: any;
  selfObj: any;
};

/**
 * Print compiled template
 * @param options
 */
export function print({
  node,
  basePath,
  parentName,
  globalObj,
  selfObj
}: PrintArg): any {
  if (!node) {
    /* istanbul ignore next */
    return null;
  }
  switch (node.kind) {
    case NodeKind.VALUE: {
      let child = node.firstChild;
      let initialValue = node.value;
      let finalValue: any = child ? "" : initialValue;
      while (child) {
        const result = print({
          node: child,
          basePath,
          parentName,
          globalObj,
          selfObj
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
    case NodeKind.TEMPLATE: {
      const child: Node = <Node>node.firstChild;
      const result = print({
        node: child,
        basePath,
        parentName,
        globalObj,
        selfObj
      });
      const { start, end } = node.scope;
      return new Result(result.value, start, end);
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
          console.log(child);

          const result = print({
            node: child,
            basePath,
            parentName,
            globalObj,
            selfObj
          });
          _arguments.push(result.value);
        }
        child = child.nextSibling;
      }
      console.log("_arguments:", _arguments);

      const func = functions[functionName];
      if (func) {
        const __arguments = _arguments.map((arg: any) => {
          if (arg instanceof Node) {
            const result = print({
              node: arg,
              basePath,
              parentName,
              globalObj,
              selfObj
            });
            return result.value;
          } else {
            return arg;
          }
        });
        const result = func(__arguments, {
          basePath,
          parentName,
          globalObj,
          selfObj
        });
        const { start, end } = node.scope;
        return new Result(result, start, end);
      }
      throw new Error(YamlError.UnknonwReference(functionName));
    }
    // {
    //   const { name, arguments: _arguments } = node.value;
    //   const func = functions[name];
    //   if (func) {
    //     const result = func(_arguments, { globalObj, selfObj });
    //     const { start, end } = node.scope;
    //     return new Result(result, start, end);
    //   }
    //   throw new Error(YamlError.UnknonwReference(name));
    // }
  }
  return node;
}
