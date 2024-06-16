import { getContainerRenderer } from '@astrojs/mdx';
import type { AstroRenderer, SSRLoadedRenderer } from 'astro';
import { experimental_AstroContainer as AstroContainer, type ContainerRenderOptions } from 'astro/container';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

// FIXME: This is a monkey patch which should be removed after bumping the astro to 4.10.3
export async function loadRenderers(renderers: AstroRenderer[]) {
  const loadedRenderers = await Promise.all(
    renderers.map(async (renderer) => {
      const mod = await import(/* @vite-ignore */ renderer.serverEntrypoint);
      if (typeof mod.default !== 'undefined') {
        return {
          ...renderer,
          ssr: mod.default,
        } as SSRLoadedRenderer;
      }
      return undefined;
    }),
  );

  return loadedRenderers.filter((r): r is SSRLoadedRenderer => Boolean(r));
}

const renderers = await loadRenderers([getContainerRenderer()]);
const container = await AstroContainer.create({ renderers: renderers });

// We only want to make sure the container instance is singleton.
export const partialRender = async (
  component: AstroComponentFactory,
  options?: ContainerRenderOptions,
): Promise<string> => {
  const html = await container.renderToString(component, options);
  // Remove this doctype by default.
  return html.startsWith('<!DOCTYPE html>') ? html.slice(15) : html;
};
