export interface Image {
  /**
   * public url of the image
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
   * blurDataURL of the image
   */
  blurDataURL: string;
  /**
   * blur image width
   */
  blurWidth: number;
  /**
   * blur image height
   */
  blurHeight: number;
}

export const openGraphWidth = 1200;

export const openGraphHeight = 768;
