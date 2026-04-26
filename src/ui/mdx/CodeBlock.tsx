import {
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react'

const COPY_LABEL = 'Copy'
const COPIED_LABEL = 'Copied'
const FAILED_LABEL = 'Failed'
const RESET_DELAY = 1500
const LANGUAGE_CLASS = /\blanguage-([a-z0-9_+.-]+)\b/i

const LANGUAGE_MAP: Record<string, string> = {
  html: 'HTML',
  htm: 'HTML',
  xhtml: 'XHTML',
  xml: 'XML',
  svg: 'SVG',
  css: 'CSS',
  scss: 'SCSS (Sass)',
  sass: 'Sass',
  less: 'Less',
  js: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  tsx: 'TSX',
  vue: 'Vue',
  svelte: 'Svelte',
  astro: 'Astro',
  json: 'JSON',
  jsonc: 'JSON with Comments',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  ini: 'INI',
  env: 'Environment Variables',
  py: 'Python',
  rb: 'Ruby',
  php: 'PHP',
  java: 'Java',
  kotlin: 'Kotlin',
  swift: 'Swift',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  c: 'C',
  cs: 'C#',
  go: 'Go',
  rs: 'Rust',
  dart: 'Dart',
  scala: 'Scala',
  groovy: 'Groovy',
  perl: 'Perl',
  pl: 'Perl',
  lua: 'Lua',
  r: 'R',
  julia: 'Julia',
  zig: 'Zig',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  fish: 'Fish Shell',
  ps1: 'PowerShell',
  bat: 'Batchfile',
  cmd: 'Windows Command Script',
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
  cmake: 'CMake',
  awk: 'Awk',
  sed: 'Sed',
  sql: 'SQL',
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  plsql: 'PL/SQL',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  cypher: 'Cypher (Neo4j)',
  influxql: 'InfluxQL',
  csv: 'CSV',
  tsv: 'TSV',
  parquet: 'Parquet',
  avro: 'Avro',
  terraform: 'Terraform',
  tf: 'Terraform',
  hcl: 'HCL (HashiCorp Configuration Language)',
  ansible: 'Ansible',
  puppet: 'Puppet',
  chef: 'Chef',
  k8s: 'Kubernetes YAML',
  helm: 'Helm Chart',
  nginx: 'Nginx Config',
  apache: 'Apache Config',
  conf: 'Config File',
  md: 'Markdown',
  mdx: 'MDX',
  rst: 'reStructuredText',
  asciidoc: 'AsciiDoc',
  plaintext: 'Plain Text',
  txt: 'Plain Text',
  log: 'Log File',
  ejs: 'EJS',
  pug: 'Pug (Jade)',
  mustache: 'Mustache',
  handlebars: 'Handlebars',
  hbs: 'Handlebars',
  jinja: 'Jinja2',
  erb: 'ERB (Embedded Ruby)',
  liquid: 'Liquid',
  hs: 'Haskell',
  ml: 'OCaml/Standard ML',
  elm: 'Elm',
  clj: 'Clojure',
  cljs: 'ClojureScript',
  lisp: 'Lisp',
  scheme: 'Scheme',
  prolog: 'Prolog',
  asm: 'Assembly',
  nasm: 'NASM Assembly',
  vhdl: 'VHDL',
  verilog: 'Verilog',
  gdscript: 'GDScript',
  glsl: 'GLSL',
  hlsl: 'HLSL',
  shader: 'Shader',
  unity: 'Unity C#',
  ipynb: 'Jupyter Notebook',
  rmd: 'R Markdown',
  diff: 'Diff',
  patch: 'Patch',
  regex: 'Regular Expression',
  http: 'HTTP',
  rest: 'REST Client',
  dockerignore: 'Docker Ignore',
  gitignore: 'Git Ignore',
  gitattributes: 'Git Attributes',
  editorconfig: 'EditorConfig',
}

type CodeBlockProps = ComponentProps<'pre'>

interface CodeElementProps {
  className?: string
  'data-language'?: string
  children?: ReactNode
}

export function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  const [label, setLabel] = useState(COPY_LABEL)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const language = getCodeLanguage(className, children)
  const displayLanguage = getLanguageLabel(language)
  const text = textFromReactNode(children)

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current)
    }
  }, [])

  const onCopy = async () => {
    if (resetTimer.current !== null) clearTimeout(resetTimer.current)

    let copied = false
    try {
      copied = await copyTextToClipboard(text)
    } catch {
      copied = false
    }

    setLabel(copied ? COPIED_LABEL : FAILED_LABEL)
    resetTimer.current = setTimeout(() => setLabel(COPY_LABEL), RESET_DELAY)
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-header">
        <span className="language-label" aria-label={`Code language: ${displayLanguage}`} role="note">
          {displayLanguage}
        </span>
        <button
          type="button"
          className="copy-code"
          title={`Copy ${displayLanguage} code`}
          aria-label={`Copy ${displayLanguage} code to clipboard`}
          onClick={() => void onCopy()}
        >
          {label}
        </button>
      </div>
      <pre {...props} className={className} data-language={language}>
        {children}
      </pre>
    </div>
  )
}

function getCodeLanguage(className: string | undefined, children: ReactNode): string {
  return (
    languageFromClassName(codeClassName(children)) ||
    languageFromClassName(className) ||
    codeDataLanguage(children) ||
    'text'
  )
}

function languageFromClassName(className: string | null | undefined): string | undefined {
  const language = className?.match(LANGUAGE_CLASS)?.[1]?.trim().toLowerCase()
  return language === '' ? undefined : language
}

function getLanguageLabel(language: string): string {
  const normalized = language.trim().toLowerCase()
  if (normalized === '') return 'Text'
  return LANGUAGE_MAP[normalized] ?? normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function codeClassName(children: ReactNode): string | undefined {
  const code = firstCodeElement(children)
  return code?.props.className
}

function codeDataLanguage(children: ReactNode): string | undefined {
  const code = firstCodeElement(children)
  const language = code?.props['data-language']?.trim().toLowerCase()
  return language === '' ? undefined : language
}

function firstCodeElement(children: ReactNode): ReactElement<CodeElementProps> | undefined {
  const childList = Array.isArray(children) ? children : [children]
  for (const child of childList) {
    if (isValidElement<CodeElementProps>(child) && child.type === 'code') return child
  }
  return undefined
}

function textFromReactNode(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return String(node)
  }
  if (Array.isArray(node)) return node.map(textFromReactNode).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromReactNode(node.props.children)
  return ''
}

interface ClipboardCopyEnvironment {
  navigator?: { clipboard?: Pick<Clipboard, 'writeText'> }
  document?: Pick<Document, 'addEventListener' | 'body' | 'createElement' | 'removeEventListener'> & {
    execCommand?: (commandId: string) => boolean
  }
}

async function copyTextToClipboard(text: string, environment: ClipboardCopyEnvironment = {}): Promise<boolean> {
  const documentRef = environment.document ?? globalThis.document
  if (legacyCopyText(text, documentRef)) return true

  const clipboard = environment.navigator?.clipboard ?? globalThis.navigator?.clipboard
  if (clipboard?.writeText !== undefined) {
    try {
      await clipboard.writeText(text)
      return true
    } catch {
      // Some in-app/webview browsers deny all programmatic clipboard writes.
    }
  }

  return false
}

function legacyCopyText(text: string, documentRef: ClipboardCopyEnvironment['document'] | undefined): boolean {
  if (copyViaClipboardEvent(text, documentRef)) return true
  if (documentRef?.body === undefined) return false

  const textarea = documentRef.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'

  documentRef.body.appendChild(textarea)
  try {
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    return runLegacyCopyCommand(documentRef)
  } finally {
    documentRef.body.removeChild(textarea)
  }
}

function copyViaClipboardEvent(text: string, documentRef: ClipboardCopyEnvironment['document'] | undefined): boolean {
  if (documentRef === undefined) return false

  let copied = false
  const onCopy = (event: ClipboardEvent) => {
    event.clipboardData?.setData('text/plain', text)
    event.preventDefault()
    copied = true
  }

  documentRef.addEventListener('copy', onCopy)
  try {
    return runLegacyCopyCommand(documentRef) && copied
  } catch {
    return false
  } finally {
    documentRef.removeEventListener('copy', onCopy)
  }
}

function runLegacyCopyCommand(documentRef: ClipboardCopyEnvironment['document']): boolean {
  if (documentRef?.execCommand === undefined) return false
  return documentRef.execCommand('copy')
}
