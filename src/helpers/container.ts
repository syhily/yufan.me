import type { ContainerRenderOptions } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import serverRenderer from '@astrojs/mdx/server.js'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'

// eslint-disable-next-line antfu/no-top-level-await
const container = await AstroContainer.create()
container.addServerRenderer({ name: 'astro:jsx', renderer: serverRenderer })

// We only want to make sure the container instance is singleton.
export async function partialRender(component: AstroComponentFactory, options?: ContainerRenderOptions): Promise<string> {
  return await container.renderToString(component, { ...options, partial: true })
}
