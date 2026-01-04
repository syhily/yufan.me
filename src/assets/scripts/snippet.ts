const LANGUAGE_MAP: Record<string, string> = {
  // --- Web Frontend ---
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

  // --- Backend / General Programming ---
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

  // --- Shell / System / Scripting ---
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

  // --- Database / Query ---
  sql: 'SQL',
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  plsql: 'PL/SQL',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  cypher: 'Cypher (Neo4j)',
  influxql: 'InfluxQL',

  // --- Data / Serialization ---
  csv: 'CSV',
  tsv: 'TSV',
  parquet: 'Parquet',
  avro: 'Avro',

  // --- Config / Infra / Cloud ---
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

  // --- Markdown / Documentation ---
  md: 'Markdown',
  mdx: 'MDX',
  rst: 'reStructuredText',
  asciidoc: 'AsciiDoc',
  txt: 'Plain Text',
  log: 'Log File',

  // --- Template / UI / Server-side Rendering ---
  ejs: 'EJS',
  pug: 'Pug (Jade)',
  mustache: 'Mustache',
  handlebars: 'Handlebars',
  hbs: 'Handlebars',
  jinja: 'Jinja2',
  erb: 'ERB (Embedded Ruby)',
  liquid: 'Liquid',

  // --- Functional / Academic ---
  hs: 'Haskell',
  ml: 'OCaml/Standard ML',
  elm: 'Elm',
  clj: 'Clojure',
  cljs: 'ClojureScript',
  lisp: 'Lisp',
  scheme: 'Scheme',
  prolog: 'Prolog',

  // --- Assembly / Low Level ---
  asm: 'Assembly',
  nasm: 'NASM Assembly',
  vhdl: 'VHDL',
  verilog: 'Verilog',

  // --- Mobile / Game / Graphics ---
  gdscript: 'GDScript',
  glsl: 'GLSL',
  hlsl: 'HLSL',
  shader: 'Shader',
  unity: 'Unity C#',

  // --- Data Science / Notebook ---
  ipynb: 'Jupyter Notebook',
  rmd: 'R Markdown',

  // --- Misc / Meta ---
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

export function attachCopyButtons(): void {
  const COPY_LABEL = 'Copy'
  const COPIED_LABEL = 'Copied'
  const RESET_DELAY = 700

  const codeBlocks = document.querySelectorAll<HTMLPreElement>('pre')

  codeBlocks.forEach((block) => {
    const language
      = block.getAttribute('data-language')?.toLowerCase() ?? 'text'

    const displayLang
      = LANGUAGE_MAP[language]
        ?? (language.charAt(0).toUpperCase() + language.slice(1))

    const wrapper = document.createElement('div')
    wrapper.style.position = 'relative'

    const header = createHeader(displayLang, COPY_LABEL)
    const copyButton = header.querySelector('button') as HTMLButtonElement

    // Make <pre> accessible and styled
    block.tabIndex = 0
    block.classList.add('rounded-t-none', 'rounded-b-md')

    // Insert wrapper and compose structure
    block.parentNode?.insertBefore(wrapper, block)
    wrapper.append(header, block)

    // Add copy handler
    copyButton.addEventListener('click', () => handleCopy(block, copyButton))
  })

  /** Helper: Create header bar DOM */
  function createHeader(language: string, buttonLabel: string): HTMLDivElement {
    const header = document.createElement('div')
    header.className
      = 'code-header flex items-center justify-between bg-skin-card border-b border-skin-border px-4 py-2 rounded-t-md'

    const label = document.createElement('span')
    label.className
      = 'language-label text-sm text-skin-base font-medium select-none pointer-events-none'
    label.textContent = language
    label.setAttribute('aria-label', `Code language: ${language}`)
    label.setAttribute('role', 'note')

    const button = document.createElement('button')
    button.className
      = 'copy-code text-sm text-skin-base hover:text-skin-accent transition-colors font-medium select-none cursor-pointer'
    button.textContent = buttonLabel
    button.title = `Copy ${language} code`
    button.setAttribute('aria-label', `Copy ${language} code to clipboard`)

    header.append(label, button)
    return header
  }

  /** Helper: Copy code text */
  async function handleCopy(
    block: HTMLPreElement,
    button: HTMLButtonElement,
  ): Promise<void> {
    const text = block.querySelector('code')?.textContent ?? ''
    await navigator.clipboard.writeText(text)

    button.textContent = COPIED_LABEL
    setTimeout(() => (button.textContent = COPY_LABEL), RESET_DELAY)
  }
}
