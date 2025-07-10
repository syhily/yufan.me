export function buildTemplate(data: Record<string, string>, template: string) {
  Object.keys(data).forEach((key) => {
    const value = data[key as keyof typeof data]
    template = template.replace(`{{${key}}}`, value)
  })
  return template
}
