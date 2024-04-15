import { options } from '#site/content';

export async function NeteasePlayer({ id }: Readonly<{ id: string }>) {
  const data = await fetch(options.website + '/api/songs?id=' + id).then((res) => {
    return res.json();
  });
  const audio = {
    artist: data.author,
    cover: data.pic,
    lrc: data.lrc,
    name: data.title,
    theme: '',
    type: 'auto',
    url: data.url,
  };

  return <audio controls src={audio.url} />;
}
