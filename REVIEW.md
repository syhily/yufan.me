# 后端新编辑器审查问题与增强建议

1. 编辑器的拖拽功能不可能，也不好用，去掉对应的拖拽功能，去掉对应的拖拽开关按钮。
2. 定时发布的日期选择器是 Shadcn，但是定时发布的时间选择器的样式和日期选择器不一致。所以参考使用 <https://raw.githubusercontent.com/rudrodip/shadcn-date-time-picker/refs/heads/main/content/snippets/date-time-picker.mdx> 进行统一化改造，里面的 AM PM 需要改为上午和下午。
3. 文章插图分为两种类型，扩展文章插图格式，支持这两种类型。一种类型为现在媒体库里面已经存在的图片，另一种类型为外部第三方自定义链接的图片。对于外部第三方的图片，编辑保存的时候不会获取其 thumbhash 等内容，也不会将其放在 image_sources 的 content 表内。对于媒体库的图片，在保存时，如果修改了图片的 alt 信息，直接更新对应的图片表的记录。同时媒体库的图片在存储的 JSON 格式里面，只有 ID，会按照后端的静态资源配置的域名，渲染时替换为真正的地址。
