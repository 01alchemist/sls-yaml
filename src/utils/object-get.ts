/**
 * Gets the value at `path` of `object`. If the resolved value is `undefined`, the `defaultValue` is returned in its place.
 *
 * @param {object} obj The object to query.
 * @param {string | string[]} path The path of the property to get.
 * @param {any} [defaultValue] The value returned for `undefined` resolved values.
 * @returns {any} Returns the resolved value.
 */
export function get(
  obj: any,
  path?: string | string[] | null,
  defaultValue?: any
): any {
  if (!obj || typeof obj !== 'object') return defaultValue

  const keys = Array.isArray(path)
    ? path
    : (path && path.match(/[^.[\]]+/g)) || []

  let result = obj
  for (const key of keys) {
    result = result ? result[key] : undefined
    if (result === undefined) {
      return defaultValue
    }
  }

  return result
}
