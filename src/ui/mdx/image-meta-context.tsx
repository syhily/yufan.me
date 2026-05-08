import { createContext, useContext, type ReactNode } from 'react'

export interface ResolvedImageMeta {
  thumbhash?: string
  width?: number
  height?: number
}

export type ImageMetaMap = Record<string, ResolvedImageMeta>

const ImageMetaContext = createContext<ImageMetaMap | undefined>(undefined)

export function ImageMetaProvider({ children, value }: { children: ReactNode; value?: ImageMetaMap }) {
  return <ImageMetaContext.Provider value={value}>{children}</ImageMetaContext.Provider>
}

export function useImageMeta(): ImageMetaMap | undefined {
  return useContext(ImageMetaContext)
}
