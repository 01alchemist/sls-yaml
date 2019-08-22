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
    return `{{ ${template} }}`;
  }
};

export enum NodeKind {
  VALUE,
  REFERENCE,
  FUNCTION,
  VARIABLE
}

export class Scope {
  constructor(public start: number, public end: number = -1) {}
}

export class Node {
  value: any;
  nextChild: Node | null = null;
  prevChild: Node | null = null;
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
  REFERENCE,
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
  "${": TokenKind.REFERENCE,
  "{": TokenKind.LEFT_BRACE,
  "}": TokenKind.RIGHT_BRACE,
  "(": TokenKind.LEFT_PARENTHESIS,
  ")": TokenKind.RIGHT_PARENTHESIS,
  "[": TokenKind.LEFT_BRACKET,
  "]": TokenKind.RIGHT_BRACKET,
  ":": TokenKind.COLON
};

export const tokenValues = Object.keys(tokens);

export function parseToken(value: any) {
  let buffer: string = "";
  const valueNode = new Node(NodeKind.VALUE, new Scope(0, value.length));
  valueNode.value = value;
  let node: Node | null = null;
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
       * Reference open
       */
      if (tokens[char] === TokenKind.DOLLAR) {
        buffer = char;
      }
      /**
       * Function open
       */
      if (tokens[char] === TokenKind.LEFT_PARENTHESIS) {
        const name = buffer.substring(0, buffer.length - 1);
        const fnNode = new Node(NodeKind.FUNCTION, new Scope(i));
        fnNode.value = {
          name,
          arguments: [],
          rawValue: buffer
        };
        if (node) {
          node.nextChild = fnNode;
          fnNode.prevChild = node;
        }
        nodeStack.push(fnNode);
        buffer = "";
      }
      /**
       * Function close
       */
      if (tokens[char] === TokenKind.RIGHT_PARENTHESIS) {
        buffer = buffer.substring(0, buffer.length - 1);
        const fnNode = nodeStack.pop();
        if (fnNode) {
          fnNode.scope.end = i;
          fnNode.value.arguments.push(...buffer.split(",").map(v => v.trim()));
          fnNode.value.rawValue += buffer + char;
        }
        buffer = "";
      }

      /**
       * Variable open
       */
      if (tokens[char] === TokenKind.COLON) {
        const name = buffer.substring(0, buffer.length - 1);
        const varNode = new Node(NodeKind.VARIABLE, new Scope(i));
        varNode.value = {
          name,
          arguments: [],
          rawValue: buffer
        };
        if (node) {
          node.nextChild = varNode;
        }
        nodeStack.push(varNode);
        buffer = "";
      }
      /**
       * Variable close
       */
      if (tokens[char] === TokenKind.RIGHT_BRACE) {
        if (node) {
          node.scope.end = i;
        }
        const varNode = nodeStack.pop();
        buffer = buffer.substring(0, buffer.length - 1);
        if (varNode) {
          varNode.scope.end = i;
          varNode.value.arguments.push(...buffer.split(","));
          varNode.value.rawValue += buffer;
        }
        buffer = "";
      }
    }

    if (tokens[buffer] === TokenKind.REFERENCE) {
      node = new Node(NodeKind.REFERENCE, new Scope(i));
      buffer = "";
    }
  });

  valueNode.nextChild = node;

  return valueNode;
}

type PrintArg = {
  node: Node | null;
  basePath: string;
  parentName: string;
  globalObj: any;
  selfObj: any;
};

export function print({
  node,
  basePath,
  parentName,
  globalObj,
  selfObj
}: PrintArg): any {
  if (!node) {
    return null;
  }
  switch (node.kind) {
    case NodeKind.VALUE: {
      const result = print({
        node: node.nextChild,
        basePath,
        parentName,
        globalObj,
        selfObj
      });

      const value = node.value;
      if (result) {
        const prefix = value.substring(0, result.start - 1);
        const suffix = value.substring(result.end + 1, value.length);

        if (prefix || suffix) {
          const combined = prefix + result.value + suffix;
          return combined;
        } else {
          return result.value;
        }
      } else {
        return value;
      }
    }
    case NodeKind.REFERENCE: {
      const valueNode: Node = <Node>node.nextChild;
      const result = print({
        node: valueNode,
        basePath,
        parentName,
        globalObj,
        selfObj
      });
      const { start, end } = node.scope;
      return new Result(result.value, start, end);
    }
    case NodeKind.FUNCTION: {
      const { name, arguments: _arguments } = node.value;
      const func = functions[name];
      if (func) {
        const result = func(_arguments, {
          basePath,
          parentName,
          globalObj,
          selfObj
        });
        const { start, end } = node.scope;
        return new Result(result, start, end);
      }
      throw new Error(YamlError.UnknonwReference(name));
    }
    case NodeKind.VARIABLE: {
      const { name, arguments: _arguments } = node.value;
      const func = functions[name];
      if (func) {
        const result = func(_arguments, { globalObj, selfObj });
        const { start, end } = node.scope;
        return new Result(result, start, end);
      }
      throw new Error(YamlError.UnknonwReference(name));
    }
  }
  return node;
}
