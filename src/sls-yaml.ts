import { compile } from './sls-yaml-compiler'
import { Path, ParentObject } from './types'
const fs = require('fs')
const yaml = require('js-yaml')

export function readYamlSync(
  pathOrData: Path | Buffer,
  parent?: ParentObject | null,
  context: any = {}
) {
  let data,
    basePath = './'

  if (typeof pathOrData === 'string') {
    basePath = pathOrData.substring(0, pathOrData.lastIndexOf('/'))
    data = fs.readFileSync(pathOrData, 'utf8')
  }
  if (pathOrData instanceof Buffer) {
    data = pathOrData.toString()
  }

  const doc = yaml.load(data)
  let globalObj: any = null
  let parentPath: any = null
  if (parent) {
    globalObj = parent.global
    parentPath = parent.parentPath
  }

  const compiledDoc = compile({
    doc,
    globalObj,
    parentPath,
    basePath,
    context
  })

  return compiledDoc
}

export default readYamlSync
