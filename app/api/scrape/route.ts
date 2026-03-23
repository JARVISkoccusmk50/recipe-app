// URL取り込みAPI
// URLを受け取ってページをスクレイピングし、レシピ情報を抽出します

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 });
    }

    // ページを取得する
    const response = await fetch(url, {
      headers: {
        // ブラウザのようなUser-Agentを設定してブロックされにくくする
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'ページの取得に失敗しました' }, { status: 400 });
    }

    const html = await response.text();
    // cheerioでHTMLをパースする（jQueryのようなAPIで使える）
    const $ = cheerio.load(html);

    // ページタイトルを取得
    const title = $('title').text().trim() || $('h1').first().text().trim() || '';

    // OGP画像を取得（SNSシェア用の画像）
    const imageUrl = $('meta[property="og:image"]').attr('content') || 
                     $('meta[name="twitter:image"]').attr('content') || '';

    // 本文テキストを取得（スクリプトやスタイルを除いた本文）
    $('script, style, nav, footer, header').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);

    return NextResponse.json({
      title,
      imageUrl,
      bodyText,
      rawHtml: html.slice(0, 50000), // DBに保存するHTMLは最大50KB
    });
  } catch (error) {
    console.error('スクレイピングエラー:', error);
    return NextResponse.json({ error: 'スクレイピングに失敗しました' }, { status: 500 });
  }
}
