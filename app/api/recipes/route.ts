// レシピ一覧取得・新規保存API

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// レシピ一覧を取得する（GETリクエスト）
export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const titleQuery = searchParams.get('title') || '';
  const tagQuery = searchParams.get('tag') || '';

  let sql = `
    SELECT 
      r.id,
      rv.title,
      rv.image_url,
      rv.created_at,
      r.updated_at,
      s.url as source_url,
      GROUP_CONCAT(t.name, ',') as tags
    FROM recipes r
    LEFT JOIN recipeVersions rv ON r.current_version_id = rv.id
    LEFT JOIN sources s ON r.source_id = s.id
    LEFT JOIN recipeTags rt ON r.id = rt.recipe_id
    LEFT JOIN tags t ON rt.tag_id = t.id
    WHERE 1=1
  `;

  const params: (string | number)[] = [];

  // タイトル検索フィルター
  if (titleQuery) {
    sql += ` AND rv.title LIKE ?`;
    params.push(`%${titleQuery}%`);
  }

  sql += ` GROUP BY r.id`;

  // タグ検索フィルター（GROUP BY後に適用）
  if (tagQuery) {
    sql += ` HAVING tags LIKE ?`;
    params.push(`%${tagQuery}%`);
  }

  sql += ` ORDER BY r.updated_at DESC`;

  const recipes = db.prepare(sql).all(...params);
  return NextResponse.json(recipes);
}

// 新しいレシピを保存する（POSTリクエスト）
export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();

  const {
    sourceUrl,
    rawHtml,
    sourceTitle,
    title,
    imageUrl,
    memo,
    changeNote,
    ingredients, // [{name, amount}] の配列
    steps,       // [{description}] の配列
    tags,        // ["タグ1", "タグ2"] の配列
  } = body;

  // トランザクションで一括保存（途中でエラーが起きても全部ロールバック）
  const save = db.transaction(() => {
    // 同じタイトルのレシピが既に存在するか確認
    const existing = db.prepare(`
      SELECT r.id, r.current_version_id
      FROM recipes r
      LEFT JOIN recipeVersions rv ON r.current_version_id = rv.id
      WHERE rv.title = ?
      LIMIT 1
    `).get(title) as { id: number; current_version_id: number } | undefined;

    // 1. sourceを保存
    const sourceResult = db.prepare(`
      INSERT INTO sources (url, title, raw_html) VALUES (?, ?, ?)
    `).run(sourceUrl || '', sourceTitle || '', rawHtml || '');

    // 2. 既存レシピがあれば上書き（新バージョンとして追加）、なければ新規作成
    let recipeId: number | bigint;

    if (existing) {
      // 既存レシピの場合：source_idだけ更新
      recipeId = existing.id;
      db.prepare(`
        UPDATE recipes SET source_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
      `).run(sourceResult.lastInsertRowid, recipeId);
    } else {
      const recipeResult = db.prepare(`
        INSERT INTO recipes (source_id, current_version_id) VALUES (?, NULL)
      `).run(sourceResult.lastInsertRowid);
      recipeId = recipeResult.lastInsertRowid;
    }

    // バージョン番号を決定（既存なら+1）
    const lastVersion = db.prepare(`
      SELECT MAX(version_number) as maxVer FROM recipeVersions WHERE recipe_id = ?
    `).get(recipeId) as { maxVer: number | null };
    const nextVersion = (lastVersion?.maxVer || 0) + 1;

    // 3. recipeVersionを保存
    const versionResult = db.prepare(`
      INSERT INTO recipeVersions (recipe_id, version_number, title, image_url, memo, change_note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recipeId, nextVersion, title, imageUrl || '', memo || '', changeNote || '');

    const versionId = versionResult.lastInsertRowid;

    // 4. 材料を保存
    (ingredients || []).forEach((ing: { name: string; amount: string; group?: string }, i: number) => {
      db.prepare(`
        INSERT INTO versionIngredients (version_id, ingredient_group, sort_order, name, amount) VALUES (?, ?, ?, ?, ?)
      `).run(versionId, ing.group || null, i, ing.name, ing.amount || '');
    });

    // 5. 手順を保存
    (steps || []).forEach((step: { description: string }, i: number) => {
      db.prepare(`
        INSERT INTO versionSteps (version_id, step_number, description) VALUES (?, ?, ?)
      `).run(versionId, i + 1, step.description);
    });

    // 6. タグを保存（既存タグは一旦削除して再登録）
    db.prepare(`DELETE FROM recipeTags WHERE recipe_id = ?`).run(recipeId);
    (tags || []).forEach((tagName: string) => {
      if (!tagName.trim()) return;
      db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`).run(tagName.trim());
      const tag = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(tagName.trim()) as { id: number };
      db.prepare(`INSERT OR IGNORE INTO recipeTags (recipe_id, tag_id) VALUES (?, ?)`).run(recipeId, tag.id);
    });

    // 7. recipeのcurrent_version_idを更新
    db.prepare(`UPDATE recipes SET current_version_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(versionId, recipeId);

    return { recipeId, versionId };
  });

  const result = save();
  return NextResponse.json(result, { status: 201 });
}
