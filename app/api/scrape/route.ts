// URL取り込みAPI
// URLを受け取ってページをスクレイピングし、レシピ情報を抽出します

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// 調味料・加工品リスト（タグから除外）
const SEASONING_KEYWORDS = [
  'しょうゆ', '醤油', '塩', '砂糖', 'みりん', '酒', '味醂', '酢', 'みそ', '味噌',
  'ごま油', 'サラダ油', 'オリーブ油', 'バター', 'マヨネーズ', 'ケチャップ',
  'だし', '水', 'お湯', 'コショウ', '胡椒', '片栗粉', '小麦粉', '薄力粉',
  'うま味', '調味料', 'だし汁', 'めんつゆ', 'ソース', 'はちみつ', '蜂蜜',
  'ガーリック', '生姜', 'しょうが', 'にんにく', '長ねぎ', 'ねぎ',
  'こしょう', 'パン粉', '牛乳', '生クリーム', '鶏がらスープ',
];

// 大カテゴリ → 小カテゴリのマッピング
// 例：「豚バラ肉ブロック」→ 大タグ「豚」＋小タグ「豚バラ」
export const CATEGORY_MAP: { parent: string; children: string[] }[] = [
  { parent: '豚', children: ['豚バラ', '豚ロース', '豚こま', '豚もも', '豚ひき', '豚肩', '豚スペアリブ', '豚レバー', '豚ミンチ', '豚薄切り', '豚切り落とし'] },
  { parent: '牛', children: ['牛バラ', '牛ロース', '牛もも', '牛ひき', '牛肩', '牛ミンチ', '牛すね', 'ビーフ', '牛薄切り', '牛切り落とし'] },
  { parent: '鶏', children: ['鶏もも', '鶏むね', '鶏ひき', '鶏ささみ', '鶏手羽', '鶏レバー', 'チキン', '鶏皮', '鶏軟骨'] },
  { parent: 'えび', children: ['バナメイエビ', 'ブラックタイガー', '車エビ', '甘エビ'] },
  { parent: 'イカ', children: ['スルメイカ', 'ヤリイカ', 'アオリイカ'] },
  { parent: '鮭', children: ['サーモン', 'シャケ', '紅鮭', '銀鮭', '生鮭', '塩鮭'] },
  // 合いびき肉は豚+牛の混合 → 大タグなし・小タグとして扱う
  { parent: 'ひき肉', children: ['合いびき', '合挽き', '合挽', 'あいびき', '合びき'] },
];

// 大タグ・小タグを分けて返す型
interface TagResult {
  parentTags: string[];  // 大カテゴリ（例：豚、野菜）
  childTags: string[];   // 小カテゴリ（例：豚バラ、にんじん）
}

// 材料名からメイン食材タグを抽出する（大タグ＋小タグ分離版）
function extractMainIngredientTags(ingredientNames: string[]): TagResult {
  const parentTags: string[] = [];
  const childTags: string[] = [];
  // 野菜・その他固有名詞 → 大タグ
  const PARENT_KEYWORDS = [
    '玉ねぎ', 'たまねぎ', 'にんじん', '人参', 'じゃがいも', 'ジャガイモ',
    'ほうれん草', 'キャベツ', 'ブロッコリー', 'なす', 'ナス', 'トマト',
    'きゅうり', 'ピーマン', '白菜', 'もやし', 'ごぼう', 'れんこん', '大根',
    'かぼちゃ', 'アスパラ', 'セロリ', '春菊', 'レタス', '小松菜',
    'エリンギ', 'しめじ', 'えのき', 'マッシュルーム', 'しいたけ',
    '豆腐', '卵', 'たまご', '油揚げ', '厚揚げ', '高野豆腐',
    '納豆', 'チーズ', 'パスタ', 'うどん', 'そば',
    '鮭', 'まぐろ', '鯛', 'タコ', 'ホタテ', 'アジ', 'サバ', 'イワシ', 'ブリ', 'カツオ', 'タラ',
    '羊', 'ラム', '鴨', 'ベーコン', 'ハム', 'ソーセージ', 'ウインナー',
  ];

  const addParent = (tag: string) => { if (!parentTags.includes(tag)) parentTags.push(tag); };
  const addChild = (tag: string) => { if (!childTags.includes(tag)) childTags.push(tag); };

  for (const name of ingredientNames) {
    // 調味料は除外
    if (SEASONING_KEYWORDS.some(s => name.includes(s))) continue;

    let matched = false;

    // CATEGORY_MAPで肉・魚の大タグ（豚/牛/鶏）と部位の小タグを分けて追加
    for (const { parent, children } of CATEGORY_MAP) {
      for (const child of children) {
        if (name.includes(child)) {
          addParent(parent);  // 大タグ（例：豚）
          addChild(child);    // 小タグ＝部位（例：豚バラ）
          matched = true;
          break;
        }
      }
      if (!matched && name.includes(parent)) {
        addParent(parent);    // 大タグのみ（部位不明）
        matched = true;
      }
      if (matched) break;
    }

    if (!matched) {
      // 野菜・その他固有名詞 → 大タグとして追加
      for (const kw of PARENT_KEYWORDS) {
        if (name.includes(kw)) {
          addParent(kw);
          matched = true;
          break;
        }
      }
    }
  }

  return {
    parentTags: parentTags.slice(0, 4),
    childTags: childTags.slice(0, 6),
  };
}

// JSON-LDからレシピ構造化データを取得する
function extractFromJsonLd(html: string) {
  const matches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (!matches) return null;

  for (const match of matches) {
    try {
      const json = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
      const data = JSON.parse(json);

      // @graphの中にRecipeがある場合
      const items = Array.isArray(data['@graph']) ? data['@graph'] : [data];

      for (const item of items) {
        if (item['@type'] === 'Recipe') {
          return item;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Claude APIを使ってInstagramキャプションからレシピを解析する
// recipe/レシピの区切り行を検出する
function isRecipeHeader(line: string): boolean {
  const normalized = line
    .replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[１-９０]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .toLowerCase()
    .trim();
  // 半角・全角英語: recipe1, recipe 2, Recipe３ など
  if (/^recipe[\s\u3000\-_\.・:：]*[1-9]/.test(normalized)) return true;
  // 日本語: レシピ1, レシピ②, レシピ一 など
  if (/^レシピ[\s\u3000\-_\.・:：]*[1-9①-⑨一二三四五六七八九]/.test(line)) return true;
  return false;
}

// Instagramキャプションをパターンマッチングで解析する
function parseInstagramCaption(caption: string): {
  title: string;
  ingredients: { name: string; amount: string; group?: string }[];
  steps: { description: string }[];
}[] {
  const lines = caption.split('\n').map(l => l.trim()).filter(l => l);

  // 区切り行のインデックスを収集
  const splitIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isRecipeHeader(lines[i])) {
      splitIndices.push(i);
    }
  }

  // 区切りがなければ1つのレシピとして解析
  const segments = splitIndices.length > 0
    ? splitIndices.map((start, idx) => lines.slice(start, splitIndices[idx + 1]))
    : [lines];

  return segments.map(segLines => {
    let title = '';
    const ingredients: { name: string; amount: string; group?: string }[] = [];
    const steps: { description: string }[] = [];
    let mode: 'none' | 'ingredients' | 'steps' = 'none';
    let currentGroup = '';

    for (let i = 0; i < segLines.length; i++) {
      const line = segLines[i];

      // タイトル候補（⋆⸜...⸝⋆ 形式）
      if (!title && line.match(/[⋆⸜《【「]/) && line.length < 40) {
        title = line.replace(/[⋆⸜⸝⋆《》【】「」★☆✨]/g, '').trim();
      }

      if (line.match(/材料|ingredients/i)) { mode = 'ingredients'; currentGroup = ''; continue; }
      if (line.match(/作り方|手順|directions|instructions/i)) { mode = 'steps'; continue; }

      if (mode === 'ingredients') {
        // グループラベル（A、Bなど）
        if (line.match(/^[A-ZＡ-Ｚ]$/) || line.match(/^[〈《\[【（(][^〉》\]】）)]{1,10}[〉》\]】）)]$/)) {
          currentGroup = line.replace(/[〈《\[【（(〉》\]】）)]/g, '').trim();
          continue;
        }
        const ingMatch = line.match(/^[・•\-＊*]?\s*(.+?)[…‥．.、,，\s]+([^\s].{0,20})$/);
        if (ingMatch) {
          ingredients.push({ name: ingMatch[1].trim(), amount: ingMatch[2].trim(), group: currentGroup || undefined });
        } else if (line.match(/^[①②③④⑤⑥⑦⑧⑨]/)) {
          mode = 'steps';
          steps.push({ description: line.replace(/^[①-⑨]/, '').trim() });
        } else if (line.match(/^[・•\-＊*]\s*.+/)) {
          ingredients.push({ name: line.replace(/^[・•\-＊*]\s*/, '').trim(), amount: '' });
        }
      }

      if (mode === 'steps') {
        if (line.match(/^[①-⑨]|^\d+[.．]/)) {
          steps.push({ description: line.replace(/^[①-⑨]|^\d+[.．]/, '').trim() });
        } else if (steps.length > 0 && !line.match(/^#|^https?:|^recipe/i)) {
          steps[steps.length - 1].description += ' ' + line;
        }
      }
    }

    return { title, ingredients, steps };
  });
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 });
    }

    // ページを取得する（Instagramはモバイルユーザーエージェントで取得）
    const isInstagram = url.includes('instagram.com');
    const response = await fetch(url, {
      headers: {
        'User-Agent': isInstagram
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'ページの取得に失敗しました' }, { status: 400 });
    }

    const html = await response.text();

    // Instagram専用処理
    if (isInstagram) {
      const $ = (await import('cheerio')).load(html);
      const unescape = (str: string) => str.replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16))).replace(/&quot;/g, '"').replace(/&amp;/g, '&');

      const ogDesc = unescape($('meta[property="og:description"]').attr('content') || '');
      const ogTitle = unescape($('meta[property="og:title"]').attr('content') || '');
      const ogImage = $('meta[property="og:image"]').attr('content')?.split('&')[0] || '';

      // キャプション本文を抽出（"..."の中身）
      const captionMatch = ogDesc.match(/"([^"]+)"/) || ogDesc.match(/:\s*"([\s\S]+)/);
      const caption = captionMatch ? captionMatch[1] : ogDesc;

      const parsedRecipes = parseInstagramCaption(caption);
      const firstRecipe = parsedRecipes[0] || { title: '', ingredients: [], steps: [] };

      // タイトルが取れなければog:titleから生成
      const finalTitle = firstRecipe.title || ogTitle.split(' on Instagram:')[0].trim();

      const { parentTags, childTags } = extractMainIngredientTags(firstRecipe.ingredients.map(i => i.name));

      // 複数レシピの場合、最初のレシピのタイトルを確定タイトルで上書き
      if (parsedRecipes.length > 0 && !parsedRecipes[0].title) {
        parsedRecipes[0].title = finalTitle;
      }

      return NextResponse.json({
        title: finalTitle,
        imageUrl: ogImage,
        bodyText: caption.slice(0, 3000),
        ingredients: firstRecipe.ingredients,
        steps: firstRecipe.steps,
        recipes: parsedRecipes,
        autoParentTags: parentTags,
        autoChildTags: childTags,
        rawHtml: html.slice(0, 50000),
      });
    }
    const $ = cheerio.load(html);

    // ページタイトルを取得
    const title = $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  $('title').text().trim() || '';

    // OGP画像を取得
    const imageUrl = $('meta[property="og:image"]').attr('content') ||
                     $('meta[name="twitter:image"]').attr('content') || '';

    // 材料と手順の初期値
    let ingredients: { name: string; amount: string; group?: string }[] = [];
    let steps: { description: string }[] = [];

    // JSON-LDから構造化データを取得（最も信頼性が高い）
    const jsonLd = extractFromJsonLd(html);

    if (jsonLd) {
      // 材料の取得
      if (Array.isArray(jsonLd.recipeIngredient)) {
        let currentGroup: string | undefined = undefined;
        ingredients = jsonLd.recipeIngredient.map((ing: string) => {
          const trimmed = ing.trim();
          // グループラベルの検出：「〈A〉」「（A）」「(A)」「【A】」などの形式
          const groupMatch = trimmed.match(/^[〈《\[【（(]([^〉》\]】）)]+)[〉》\]】）)]$/);
          if (groupMatch) {
            currentGroup = groupMatch[1];
            return null; // グループラベル行は材料としては追加しない
          }
          // 「卵 2個」→ name: 卵, amount: 2個 に分割を試みる
          const match = trimmed.match(/^(.+?)\s+([\d０-９]+[\w%gGml㎖㎝cc合本枚個杯切れ分g人前人分tbsptspTBSPTSP大小]+\S*)$/);
          if (match) {
            return { name: match[1], amount: match[2], group: currentGroup };
          }
          return { name: trimmed, amount: '', group: currentGroup };
        }).filter((ing: { name: string; amount: string; group?: string } | null): ing is { name: string; amount: string; group?: string } => ing !== null);
      }

      // 手順の取得
      if (Array.isArray(jsonLd.recipeInstructions)) {
        steps = jsonLd.recipeInstructions
          .filter((step: { text?: string } | string) => {
            const text = typeof step === 'string' ? step : step.text || '';
            // レシピIDや参照リンクだけの行を除外
            return text && !text.match(/^レシピID\s*[:：]/) && text.length > 5;
          })
          .map((step: { text?: string } | string) => ({
            description: typeof step === 'string' ? step : (step.text || ''),
          }));
      }
    }

    // グループラベルを検出するヘルパー関数
    const detectGroup = (text: string): string | null => {
      // 〈A〉《A》(A)（A）【A】[A] などの形式
      const m = text.trim().match(/^[〈《\[【（(]([^〉》\]】）)]{1,10})[〉》\]】）)]$/);
      return m ? m[1] : null;
    };

    // JSON-LDで材料が取れなかった場合、HTMLから直接取得を試みる
    if (ingredients.length === 0) {
      let currentGroup: string | undefined = undefined;

      // パターン1：pタグのグループラベル → ulリストの形式（umamikyo等）
      // 例：<p class="...">〈A〉</p><ul><li><p>しょうゆ</p><p>大さじ3</p></li>...
      $('p, h4, dt').each((_, el) => {
        const text = $(el).text().trim();
        const group = detectGroup(text);
        if (group) {
          currentGroup = group;
          // 直後のulのliを処理
          $(el).nextAll('ul').first().find('li').each((__, li) => {
            const ps = $(li).find('p');
            if (ps.length === 2) {
              const name = ps.eq(0).text().trim();
              const amount = ps.eq(1).text().trim();
              if (name && name.length < 20 && !name.includes('\n') && !name.includes('【')) {
                ingredients.push({ name, amount, group: currentGroup });
              }
            }
          });
        }
      });

      // パターン2：pが1つのliで材料名のみ（グループラベルの直後のulではないul）
      $('ul li').each((_, el) => {
        const ps = $(el).find('> p');
        if (ps.length === 2) {
          const name = ps.eq(0).text().trim();
          const amount = ps.eq(1).text().trim();
          if (name && name.length < 20 && !name.includes('\n') && !name.includes('【') && !name.includes('〜')) {
            // 既に同じ材料が登録済みでなければ追加（グループなし）
            const exists = ingredients.some(i => i.name === name);
            if (!exists) {
              ingredients.push({ name, amount });
            }
          }
        }
      });

      // パターン2：クックパッド・楽天レシピ等のclass指定
      if (ingredients.length === 0) {
        $('[class*="ingredient"], [class*="material"], [class*="Ingredient"]').each((_, el) => {
          const name = $(el).find('[class*="name"], [class*="Name"], p:first-child').first().text().trim();
          const amount = $(el).find('[class*="amount"], [class*="Amount"], p:last-child').last().text().trim();
          if (name && name !== amount) {
            ingredients.push({ name, amount });
          }
        });
      }
    }

    // HTMLから手順が取れなかった場合
    if (steps.length === 0) {
      $('ol li').each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text && text.length > 10 && !text.match(/^レシピID/)) {
          steps.push({ description: text });
        }
      });

      if (steps.length === 0) {
        $('[class*="step"] p, [class*="Step"] p, [class*="direction"], [class*="instruction"]').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 10) {
            steps.push({ description: text });
          }
        });
      }
    }

    // 本文テキストを取得（参考用）
    $('script, style, nav, footer, header').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);

    // 材料からメイン食材タグを自動生成（大タグ・小タグ分離）
    const { parentTags, childTags } = extractMainIngredientTags(ingredients.map(i => i.name));

    return NextResponse.json({
      title,
      imageUrl,
      bodyText,
      ingredients,
      steps,
      autoParentTags: parentTags,
      autoChildTags: childTags,
      rawHtml: html.slice(0, 50000),
    });
  } catch (error) {
    console.error('スクレイピングエラー:', error);
    return NextResponse.json({ error: 'スクレイピングに失敗しました' }, { status: 500 });
  }
}
