import type { Root } from 'hast'
import type {
  MdxJsxAttribute,
  MdxJsxAttributeValueExpression,
  MdxJsxFlowElement,
  MdxJsxTextElement,
} from 'mdast-util-mdx-jsx'
import type { Plugin } from 'unified'
import type { SongWithoutURL } from './resolver'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { visit } from 'unist-util-visit'
import YAML from 'yaml'
import { resolveSongWithoutURL } from './resolver'

function isMusicPlayerNode(
  node: any,
): node is MdxJsxFlowElement | MdxJsxTextElement {
  return (
    (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement')
    && typeof node.name === 'string'
  )
}

const songInfoDirectory = join(process.cwd(), 'src', 'content', 'metas', 'musics')

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  }
  catch {
    return false
  }
}

async function readSongInfo(id: string): Promise<SongWithoutURL | null | undefined> {
  const songInfoFile = join(songInfoDirectory, `${id}.yml`)
  if (await fileExists(songInfoFile)) {
    const content = await fs.readFile(songInfoFile, 'utf8')
    const info = YAML.parse(content)
    return info === null || info === undefined ? info : info as SongWithoutURL
  }
  return null
}

async function writeSongInfo(id: string, info: SongWithoutURL): Promise<void> {
  const songInfoFile = join(songInfoDirectory, `${id}.yml`)
  const content = YAML.stringify(info)
  await fs.writeFile(songInfoFile, content, { mode: 0o644, flag: 'w' })
}

const rehypeMusicPlayer: Plugin<[], Root> = () => {
  return async (tree: Root) => {
    const promises: Promise<void>[] = []
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node) => {
      if (!isMusicPlayerNode(node)) {
        return
      }
      if (node.name !== 'MusicPlayer') {
        return
      }

      const attrs = node.attributes || []
      const neteaseAttr = attrs.find(
        a => a.type === 'mdxJsxAttribute' && a.name === 'netease',
      ) as MdxJsxAttribute | undefined

      if (!neteaseAttr) {
        return
      }

      // Handle both literal and expression attribute values
      let netease: string | undefined
      if (typeof neteaseAttr.value === 'string') {
        netease = neteaseAttr.value
      }
      else if (
        neteaseAttr.value
        && (neteaseAttr.value as MdxJsxAttributeValueExpression).type
        === 'mdxJsxAttributeValueExpression'
      ) {
        netease = String((neteaseAttr.value as MdxJsxAttributeValueExpression).value)
      }

      if (!netease) {
        return
      }

      const p = Promise.resolve(readSongInfo(netease))
        .then((meta) => {
          if (meta) {
            return meta
          }
          return resolveSongWithoutURL({ netease })
        })
        .then((meta) => {
          if (!meta || meta.name === '') {
            console.error(`Failed to resolve netease song info ${netease}`)
            return
          }
          // Build new attributes
          const extraAttrs: MdxJsxAttribute[] = [
            { type: 'mdxJsxAttribute', name: 'name', value: meta.name },
            { type: 'mdxJsxAttribute', name: 'artist', value: meta.artist },
            { type: 'mdxJsxAttribute', name: 'pic', value: meta.pic },
            { type: 'mdxJsxAttribute', name: 'lyric', value: meta.lyric },
          ]
          // Remove duplicates if already present
          node.attributes = [
            ...attrs.filter(
              a =>
                !(
                  a.type === 'mdxJsxAttribute'
                  && ['name', 'artist', 'pic', 'lyric'].includes(a.name)
                ),
            ),
            ...extraAttrs,
          ]
          return writeSongInfo(netease, meta)
        })

      promises.push(p)
    })

    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }
}

export default rehypeMusicPlayer
