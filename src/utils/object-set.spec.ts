import { set } from './object-set'

describe('set function', () => {
  test('should set a nested value in an object', () => {
    const obj: any = {}
    set(obj, 'a.b.c', 42)
    expect(obj).toEqual({ a: { b: { c: 42 } } })
  })

  test('should set a nested value in an array', () => {
    const arr: any = []
    set(arr, '[0].b.c', 42)
    expect(arr).toEqual([{ b: { c: 42 } }])
  })

  test('should create intermediate objects as needed', () => {
    const obj: any = {}
    set(obj, 'a.b.c.d', 42)
    expect(obj).toEqual({ a: { b: { c: { d: 42 } } } })
  })

  test('should handle an empty path', () => {
    const obj: any = { a: 1 }
    set(obj, '', 42)
    expect(obj).toEqual({ a: 1 })
  })

  test('should handle a single key path', () => {
    const obj: any = { a: 1 }
    set(obj, 'b', 42)
    expect(obj).toEqual({ a: 1, b: 42 })
  })

  test('should overwrite existing value', () => {
    const obj: any = { a: { b: 1 } }
    set(obj, 'a.b', 42)
    expect(obj).toEqual({ a: { b: 42 } })
  })

  test('should work with numeric keys in arrays', () => {
    const arr: any = [1, 2, 3]
    set(arr, '[1]', 42)
    expect(arr).toEqual([1, 42, 3])
  })

  test('should create intermediate arrays if next key is a number', () => {
    const obj: any = {}
    set(obj, 'a[0].b', 42)
    expect(obj).toEqual({ a: [{ b: 42 }] })
  })

  test('should do nothing if the object is null or undefined', () => {
    let obj: any = null
    set(obj, 'a.b.c', 42)
    expect(obj).toBeNull()

    obj = undefined
    set(obj, 'a.b.c', 42)
    expect(obj).toBeUndefined()
  })

  test('should handle paths with dots and brackets correctly', () => {
    const obj: any = {}
    set(obj, 'a.b[0].c', 42)
    expect(obj).toEqual({ a: { b: [{ c: 42 }] } })
  })

  test('should work with array paths', () => {
    const obj: any = {}
    set(obj, ['a', 'b', 'c'], 42)
    expect(obj).toEqual({ a: { b: { c: 42 } } })
  })

  test('should handle non-object root gracefully', () => {
    const obj: any = 42
    set(obj, 'a.b.c', 42)
    expect(obj).toBe(42)
  })
})
