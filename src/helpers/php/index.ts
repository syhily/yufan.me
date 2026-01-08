import { PHP } from '@php-wasm/universal'
import { loadNodeRuntime } from './load-runtime'

const php = new PHP(await loadNodeRuntime('7.2'))
export default php
