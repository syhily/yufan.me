import fs from 'node:fs/promises';
import { join } from 'node:path';
import { getPlaiceholder } from 'plaiceholder';

export interface Image {
  /**
   * relative image path in 'public' directory
   */
  src: string;
  /**
   * image width
   */
  width: number;
  /**
   * image height
   */
  height: number;
  /**
   * blur image in base64 encoding
   */
  style: {
    backgroundImage: string;
    backgroundPosition: string;
    backgroundSize: string;
    backgroundRepeat: string;
  };
}

export const imageMetadata = async (publicPath: string): Promise<Image> => {
  const root = join(process.cwd(), 'public');
  const file = await fs.readFile(join(root, publicPath));
  const {
    metadata: { height, width },
    css,
  } = await getPlaiceholder(file);

  return {
    src: publicPath,
    width: width,
    height: height,
    style: css,
  };
};
