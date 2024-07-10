const path = require('path')
import { functions, parse, emitNode } from '.'
import { printNodes } from './utils'

describe('Template compiler test suite', () => {
  describe('When passing a helm template path to file function', () => {
    it('Should load from disk and compiler templates and passthrough helm templates', () => {
      const data = functions.file(['./__mocks__/helm-template.yml', 'helm'], {
        basePath: path.resolve(__dirname, '../')
      })
      expect(data).toBe(
        [
          'image: {{ .Values.image.repository }}:{{ .Values.image.tag }}',
          ''
        ].join('\n')
      )
    })
  })
  describe('When passing a yaml template path to file function', () => {
    it('Should load yaml file from disk and compile template', () => {
      const data = functions.file(['./__mocks__/file.yml'], {
        basePath: path.resolve(__dirname, '../')
      })
      expect(data).toEqual({ key: 'value' })
    })
  })
  describe('When passing an empty template', () => {
    it('Should return null', () => {
      const data = functions.file(['./__mocks__/empty-template.yml'], {
        basePath: path.resolve(__dirname, '../')
      })
      expect(data).toEqual({ key: null })
    })
  })
})

describe('Template compiler parser test suite', () => {
  describe('When passing a string', () => {
    it('Should parse string correctly', () => {
      const content = 'Service Name'
      const rootNode = parse({
        content
      })
      expect(printNodes(rootNode)).toBe(`[node:GROUP]
  [node:VALUE_FRAGMENT]=Service Name\n`)
    })
  })

  describe('When passing a string with variable template', () => {
    it('Should parse string correctly', () => {
      const content = 'ServiceName@${self:version}'
      const rootNode = parse({
        content
      })
      const result = printNodes(rootNode)
      expect(result).toBe(`[node:GROUP]
  [node:VALUE_FRAGMENT]=ServiceName@
  [node:TEMPLATE]
    [node:VARIABLE]
      [node:NAME]=self
      [node:ARG]=version\n`)
    })
  })

  describe('When passing a string with function template', () => {
    it('Should parse string correctly', () => {
      const content = 'ServiceName@${func(arg1, arg2)}'
      const rootNode = parse({
        content
      })
      const result = printNodes(rootNode)
      expect(result).toBe(`[node:GROUP]
  [node:VALUE_FRAGMENT]=ServiceName@
  [node:TEMPLATE]
    [node:FUNCTION]
      [node:NAME]=func
      [node:ARG]=arg1
      [node:ARG]=arg2\n`)
    })
  })

  describe('When passing a string with nested template with default value', () => {
    it('Should parse string correctly', () => {
      const content = 'ServiceName@${replace(${self:version, v0.0.0},.,-)}'
      const rootNode = parse({
        content
      })
      const result = printNodes(rootNode)
      expect(result).toBe(`[node:GROUP]
  [node:VALUE_FRAGMENT]=ServiceName@
  [node:TEMPLATE]
    [node:FUNCTION]
      [node:NAME]=replace
      [node:TEMPLATE]
        [node:VARIABLE]
          [node:NAME]=self
          [node:ARG]=version
          [node:ARG]=v0.0.0
      [node:ARG]=.
      [node:ARG]=-\n`)
    })
  })

  describe('When passing an object', () => {
    it('Should parse object correctly', () => {
      const content = { name: 'Service Name' }
      const rootNode = parse({
        content
      })
      expect(printNodes(rootNode)).toBe(`[node:OBJECT]
  [node:PAIR]
    [node:KEY]=name
    [node:GROUP]
      [node:VALUE_FRAGMENT]=Service Name\n`)
    })
  })
  describe('When passing an array', () => {
    it('Should parse array correctly', () => {
      const content = { hosts: ['0.0.0.0', '127.0.0.1'] }
      const rootNode = parse({
        content
      })
      const result = printNodes(rootNode)
      expect(result).toBe(`[node:OBJECT]
  [node:PAIR]
    [node:KEY]=hosts
    [node:ARRAY]
      [node:PAIR]
        [node:KEY]=0
        [node:GROUP]
          [node:VALUE_FRAGMENT]=0.0.0.0
      [node:PAIR]
        [node:KEY]=1
        [node:GROUP]
          [node:VALUE_FRAGMENT]=127.0.0.1\n`)
    })
  })
})

describe('Template compiler emitter test suite', () => {
  describe('When passing a string', () => {
    it('Should emit string correctly', () => {
      const content = 'Service Name'
      const rootNode = parse({
        content
      })
      const result = emitNode({ node: rootNode })
      expect(result).toBe(`Service Name`)
    })
  })

  describe('When passing a string with variable template', () => {
    it('Should emit single string correctly', () => {
      const content = 'ServiceName@${self:version}'
      const rootNode = parse({
        content
      })
      const result = emitNode({ node: rootNode })
      expect(result).toBe(`ServiceName@undefined`)
    })
  })

  describe('When passing a string with function template', () => {
    it('Should emit string correctly', () => {
      const content = {
        version: 'v1.0.0',
        name: 'ServiceName@${func(arg1, arg2)}'
      }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode,
        context: {
          func: ([arg1, arg2]: string[]) => `ok[${arg1}, ${arg2}]`
        }
      })
      expect(result).toEqual({
        version: 'v1.0.0',
        name: 'ServiceName@ok[arg1, arg2]'
      })
    })
  })

  describe('When passing an object with nested template with default value', () => {
    it('Should emit nested template value correctly', () => {
      const content = {
        version: 'v1.0.0',
        name: 'ServiceName@${replace(${self:version, v0.0.0},.,-)}'
      }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode
      })
      expect(result).toEqual({ version: 'v1.0.0', name: 'ServiceName@v1-0.0' })
    })

    it('Should emit self value correctly', () => {
      const content = {
        version: 'v1.0.0',
        name: 'ServiceName@${self:version}'
      }

      const rootNode = parse({
        content
      })
      const result = emitNode({ node: rootNode })
      expect(result).toEqual({ version: 'v1.0.0', name: 'ServiceName@v1.0.0' })
    })

    it('Should emit nested template reg express correctly', () => {
      const content = {
        version: 'v1.0.0',
        name: 'ServiceName@${replace(${ self : version, v0.0.0 }, /\\./gi, - )}'
      }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode
      })
      expect(result).toEqual({ version: 'v1.0.0', name: 'ServiceName@v1-0-0' })
    })
  })

  describe('When passing an array', () => {
    it('Should emit array correctly', () => {
      const content = { hosts: ['0.0.0.0', '127.0.0.1'] }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode
      })
      expect(result).toEqual({ hosts: ['0.0.0.0', '127.0.0.1'] })
    })
    it('Should emit self template array correctly', () => {
      const content = {
        domain: '01alchemist.com',
        hosts: ['0.0.0.0', '127.0.0.1', '${self:domain}']
      }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode
      })
      expect(result).toEqual({
        domain: '01alchemist.com',
        hosts: ['0.0.0.0', '127.0.0.1', '01alchemist.com']
      })
    })
    it('Should emit global template array correctly', () => {
      const content = {
        domain: '01alchemist.com',
        hosts: ['0.0.0.0', '127.0.0.1', '${global:domain}']
      }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode
      })
      expect(result).toEqual({
        domain: '01alchemist.com',
        hosts: ['0.0.0.0', '127.0.0.1', '01alchemist.com']
      })
    })
  })

  describe('When passing a valid globalObj', () => {
    it('Should read value from globalObj and emit tha same value', () => {
      const content = { value: '${global:some_global_value}' }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode,
        globalObj: { some_global_value: 'this is a global value' }
      })
      expect(result).toEqual({ value: 'this is a global value' })
    })
  })
  describe('When passing a null globalObj and valid parentObj', () => {
    it('Should read value from parentObj and emit tha same value', () => {
      const content = { value: '${global:some_global_value}' }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode,
        parentObj: { some_global_value: 'this is a global value' },
        parentName: 'root'
      })
      expect(result).toEqual({ value: 'this is a global value' })
    })
  })
  describe('When passing a valid globalObj and parentObj', () => {
    it('Should read value from globalObj and emit tha same value', () => {
      const content = { value: '${global:some_global_value}' }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode,
        globalObj: { some_global_value: 'this is a global value' },
        parentObj: { some_global_value: 'this is a parent value' },
        parentName: 'root'
      })
      expect(result).toEqual({ value: 'this is a global value' })
    })
  })
  describe('When passing git:branch', () => {
    it('Should read value from current git branch', () => {
      const content = { branch: '${git:branch}' }
      const rootNode = parse({
        content
      })
      const result = emitNode({
        node: rootNode
      })
      expect(result).toEqual({ branch: 'master' })
    })
  })
})
