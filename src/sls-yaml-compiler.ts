const fs = require("fs");
const path = require("path");
const get = require("lodash.get");
import readYamlSync from "./sls-yaml";

type FunctionMap = {
  [key: string]: Function;
};

const YamlError: FunctionMap = {
  UnknonwReference: (name: string) =>
    `Unknonw reference error, "${name}" is not a known reference name`
};

let globalObj: any;
let selfObj: any = {};

const functions: FunctionMap = {
  file: (uri: string, basePath: string, parentName: string) => {
    const ext = uri.substring(uri.lastIndexOf(".") + 1, uri.length);
    const resolvedPath = path.resolve(basePath, uri);
    if (ext === "yml") {
      const ymlObj = readYamlSync(resolvedPath, {
        name: parentName,
        self: globalObj
      });
      return ymlObj;
    } else {
      return fs.readFileSync(resolvedPath, "utf-8");
    }
  },
  env: (name: string) => {
    return process.env[name];
  },
  global: (name: string) => {
    return get(globalObj, name);
  },
  self: (name: string) => {
    return get(selfObj, name);
  }
};

enum NodeKind {
  VALUE,
  REFERENCE,
  FUNCTION,
  VARIABLE
}

class Scope {
  constructor(public start: number, public end: number = -1) {}
}

class Node {
  value: any;
  nextChild: Node | null = null;
  prevChild: Node | null = null;
  constructor(public kind: NodeKind, public scope: Scope) {}
}

class Result {
  constructor(
    public value: string,
    public start: number,
    public end: number = -1
  ) {}
}

enum TokenKind {
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

const tokens: any = {
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

const tokenValues = Object.keys(tokens);

function parseToken(value: any) {
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
          fnNode.value.arguments.push(...buffer.split(","));
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

function cast(value: any) {
  switch (value) {
    case "undefined":
      return undefined;
    case "null":
      return null;
    case "true":
      return true;
    case "false":
      return false;
    default:
      return value;
  }
}

function print(node: Node | null, basePath: string, parentName: string): any {
  if (!node) {
    return null;
  }
  switch (node.kind) {
    case NodeKind.VALUE: {
      const result = print(node.nextChild, basePath, parentName);
      const value = node.value;
      if (result) {
        const prefix = value.substring(0, result.start - 1);
        const suffix = value.substring(result.end + 1, value.length);

        if (prefix || suffix) {
          const combined = prefix + result.value + suffix;
          return cast(combined);
        } else {
          return result.value;
        }
      } else {
        return value;
      }
    }
    case NodeKind.REFERENCE: {
      const valueNode: Node = <Node>node.nextChild;
      const result = print(valueNode, basePath, parentName);
      const { start, end } = node.scope;
      return new Result(result.value, start, end);
    }
    case NodeKind.FUNCTION: {
      const func = functions[node.value.name];
      if (func) {
        const result = func(...node.value.arguments, basePath, parentName);
        const { start, end } = node.scope;
        return new Result(result, start, end);
      }
      throw new Error(YamlError.UnknonwReference(name));
    }
    case NodeKind.VARIABLE: {
      const name = node.value.name;
      const func = functions[name];
      if (func) {
        const result = func(...node.value.arguments);
        const { start, end } = node.scope;
        return new Result(result, start, end);
      }
      throw new Error(YamlError.UnknonwReference(name));
    }
  }
  return node;
}

function parse(content: any, root: any = {}, basePath: string): any {
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
        newValue = print(parseToken(value), basePath, key);
      } else if (typeof value === "object") {
        const child = {};
        newValue = print(parse(value, child, basePath), basePath, key);
      } else {
        newValue = value;
      }
      root[key] = newValue;
      selfObj[key] = newValue;
    });
  } else if (typeof content === "string") {
    return print(parseToken(content), basePath, "");
  } else {
    return content;
  }
  return root;
}

type CompileOptions = {
  doc: any;
  globalObj: any;
  basePath: string;
};

export function compile({
  doc,
  globalObj: _globalObj,
  basePath
}: CompileOptions) {
  globalObj = _globalObj;
  selfObj = doc;
  const node = parse(doc, {}, basePath);
  return node;
}
