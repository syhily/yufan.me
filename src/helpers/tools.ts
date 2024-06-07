export const makeToken = (
  length: number,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
) => {
  let result = '';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
};

export const urlJoin = (base: string, ...paths: string[]): string => {
  return Array.from([base, ...paths])
    .reduce((left, right) => left + (left.endsWith('/') || right.startsWith('/') ? '' : '/') + right)
    .replace(/([^:]\/)\/+/g, '$1');
};
