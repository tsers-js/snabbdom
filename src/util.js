

export const zipObj = pairs => {
  const o = {}
  pairs.forEach(([k, v]) => o[k] = v)
  return o
}
export const isArray = x => x && Array.isArray(x)

export const isStr = x => x && typeof x === "string"

export const isPlainObj = x => x && x.constructor === Object

export const isPrimitive = x => typeof x === "string" || typeof x === "number"

export const keys = x => x ? Object.keys(x) : []

export const extend = Object.assign
