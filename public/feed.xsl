<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>订阅 - <xsl:value-of select="/rss/channel/title"/></title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <style type="text/css">body{text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;margin:0;color:rgba(0,0,0,.86);font:16px/1.42 -apple-system,BlinkMacSystemFont,Helvetica Neue,PingFang SC,Hiragino Sans GB,Droid Sans Fallback,Microsoft YaHei,sans-serif}img{max-width:100%}.inner{max-width:860px;margin:0 auto;padding:0 20px;box-sizing:border-box}.top{margin-top:40px;font-size:12px}.top,.top a{color:#9ea0a6}.head{padding-top:80px;padding-bottom:40px}.head_logo{float:left;width:120px;height:120px;margin-right:20px}.head_main{overflow:hidden}.head h1{font-size:36px;font-weight:400;margin:0;color:#000}.head p{margin:0 0 10px;font-size:18px;font-weight:300;color:#9ea0a6}.head .head_link{font-size:14px;font-weight:600;color:#333;text-decoration:none}.links{margin:30px auto}.links a{display:inline-block;text-decoration:none;line-height:28px;padding-left:30px;background-position:0;background-size:24px 24px;background-repeat:no-repeat;font-weight:600;color:#333}.links a+a{margin-left:1.4em}.item{border-top:1px solid rgba(0,0,0,.04);padding:20px;margin:20px auto}.item_meta{font-size:14px;color:#9ea0a6}.item a{color:rgba(0,0,0,.98);text-decoration:none}.item>h2{margin:0}.item>h3{margin:6px 0 10px;font-size:18px;font-weight:300;color:#9ea0a6}.item>audio{display:block;width:100%;margin-top:20px}.footer{border-top:1px solid rgba(0,0,0,.04);padding:10px 20px}.footer .title{text-decoration:none;text-transform:uppercase;font-size:16px;font-weight:900;color:rgba(0,0,0,.2);letter-spacing:.02em;margin-right:1em}.footer nav{display:inline-block}.footer nav>a{text-decoration:none;color:rgba(0,0,0,.6);-webkit-transition:color .2s ease;transition:color .2s ease;font-size:.92em}.footer nav>a+a:before{content:" / ";font-size:10px;color:rgba(0,0,0,.1)}</style>
      </head>
      <body>
        <div class="top inner">
          <p><strong>This is a web feed,</strong> also known as an RSS feed. <strong>Subscribe</strong> by copying the URL from the address bar into your newsreader. Visit <a href="https://app.follow.is">Follow</a> to get started with newsreaders and subscribing. It's free.</p>
          <p><strong>此乃网络订阅，</strong>也称 RSS 订阅。将地址栏中的 URL 复制到新闻阅读器中即可<strong>订阅</strong>。推荐使用 <a href="https://app.follow.is">Follow</a> 来订阅本博客。并且是免费的。</p>
        </div>
        <div class="head inner">
          <a class="head_logo">
            <xsl:attribute name="href">
              <xsl:value-of select="/rss/channel/link"/>
            </xsl:attribute>
            <img>
              <xsl:attribute name="src">/logo.svg</xsl:attribute>
              <xsl:attribute name="title">
                <xsl:value-of select="/rss/channel/title"/>
              </xsl:attribute>
            </img>
          </a>
          <div class="head_main">
            <h1><xsl:value-of select="/rss/channel/title"/></h1>
            <p><xsl:value-of select="/rss/channel/description"/></p>
            <a class="head_link" target="_blank">
              <xsl:attribute name="href">
                <xsl:value-of select="/rss/channel/link"/>
              </xsl:attribute>
              访问网站 &#x2192;
            </a>
          </div>
        </div>
        <xsl:for-each select="/rss/channel/item">
          <div class="item inner">
            <div class="item_meta">
              <span><xsl:value-of select="pubDate" /></span>
            </div>
            <h2>
              <a target="_blank">
                <xsl:attribute name="href">
                  <xsl:value-of select="link"/>
                </xsl:attribute>
                <xsl:value-of select="title"/>
              </a>
            </h2>
          </div>
        </xsl:for-each>
        <div class="footer">
          <a class="title" href="https://yufan.me" target="_blank">且听书吟</a>
          <nav>
            <a href="https://yufan.me/about">关于</a>
            <a href="https://yufan.me/links">友链</a>
            <a href="https://yufan.me/categories">分类</a>
          </nav>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
