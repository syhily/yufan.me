import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '未找到页面',
};

export default function NotFound() {
  return (
    <div className="data-null">
      <div className="my-auto">
        <i className="svg-404"></i>
        <h1 className="font-number">404</h1>
        <div>抱歉，没有你要找的内容...</div>
      </div>
    </div>
  );
}
