import { get } from './object-get'

describe('get function', () => {
  const obj = { a: { b: { c: 42 } } }

  test('should get a nested value from an object', () => {
    expect(get(obj, 'a.b.c')).toBe(42)
  })

  test('should return default value if path does not exist', () => {
    expect(get(obj, 'a.b.c.d', 'default')).toBe('default')
  })

  test('should return undefined if path does not exist and no default value is provided', () => {
    expect(get(obj, 'a.b.c.d')).toBeUndefined()
  })

  test('should handle array path', () => {
    expect(get(obj, ['a', 'b', 'c'])).toBe(42)
  })

  test('should return default value for invalid path', () => {
    expect(get(obj, 'a.b[0].c', 'default')).toBe('default')
  })

  test('should return default value for non-object root', () => {
    expect(get(42, 'a.b.c', 'default')).toBe('default')
  })

  test('should handle null and undefined gracefully', () => {
    expect(get(null, 'a.b.c', 'default')).toBe('default')
    expect(get(undefined, 'a.b.c', 'default')).toBe('default')
  })

  test('should get value for single key path', () => {
    const obj = { a: 1 }
    expect(get(obj, 'a')).toBe(1)
  })

  test('should handle empty path', () => {
    expect(get(obj, '', 'default')).toBe(obj)
  })
})
