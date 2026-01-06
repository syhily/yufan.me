import { PhpWeb } from 'php-wasm/PhpWeb.mjs'

const php = new PhpWeb()
let output = ''
php.addEventListener('output', (event) => {
  output += event.detail.join('\n')
})
php.addEventListener('error', (event) => {
  console.log(event.detail)
})

await php.run('<?php phpinfo();')
document.documentElement.innerHTML = output
