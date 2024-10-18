import { experimental_AstroContainer as AstroContainer, type ContainerRenderOptions } from 'astro/container';
import serverRenderer from 'astro/jsx/server.js';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

const container = await AstroContainer.create();
container.addServerRenderer({ name: 'astro:jsx', renderer: serverRenderer });

// We only want to make sure the container instance is singleton.
export const partialRender = async (
  component: AstroComponentFactory,
  options?: ContainerRenderOptions,
): Promise<string> => {
  return await container.renderToString(component, { ...options, partial: true });
};
