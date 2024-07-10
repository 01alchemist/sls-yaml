export function set(obj: any, path?: string | string[] | null, value?: any) {
  if (!obj || typeof obj !== 'object') return

  const keys = Array.isArray(path)
    ? path
    : (path && path.match(/[^.[\]]+/g)) || []

  keys.reduce((acc, key, index) => {
    if (index === keys.length - 1) {
      acc[key] = value
    } else {
      if (!acc[key] || typeof acc[key] !== 'object') {
        acc[key] = isNaN(keys[index + 1] as any) ? {} : []
      }
    }
    return acc[key]
  }, obj)
}
