export interface MusicPlayerProps {
  id: string
}

export function MusicPlayer({ id }: MusicPlayerProps) {
  return <div className="music-player aplayer" data-id={id} />
}
