function trimStartSlash(value: string) {
  return value.replace(/^\/+/, '')
}

function trimEndSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function joinUrl(...parts: string[]) {
  const filtered = parts.filter((part) => part !== '')
  if (filtered.length === 0) return ''

  let result = filtered[0]
  for (let index = 1; index < filtered.length; index++) {
    result = `${trimEndSlash(result)}/${trimStartSlash(filtered[index])}`
  }
  return result
}

export function withLeadingSlash(value: string) {
  return value.startsWith('/') ? value : `/${value}`
}
