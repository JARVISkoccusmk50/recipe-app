// 特定レシピの取得・更新API

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// レシピの詳細を取得する（GETリクエスト）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const { id } = await params;
  const recipeId = parseInt(id);

  // レシピの基本情報を取得
  const recipe = db.prepare(`
    SELECT r.id, r.source_id, r.current_version_id, r.created_at, r.updated_at,
           s.url as source_url, s.title as source_title
    FROM recipes r
    LEFT JOIN sources s ON r.source_id = s.id
    WHERE r.id = ?
  `).get(recipeId) as any;

  if (!recipe) {
    return NextResponse.json({ error: 'レシピが見つかりません' }, { status: 404 });
  }

  // 現在の版の詳細を取得
  const version = db.prepare(`
    SELECT * FROM recipeVersions WHERE id = ?
  `).get(recipe.current_version_id) as any;

  // 材料リストを取得
  const ingredients = db.prepare(`
    SELECT * FROM versionIngredients WHERE version_id = ? ORDER BY sort_order
  `).all(recipe.current_version_id);

  // 手順リストを取得
  const steps = db.prepare(`
    SELECT * FROM versionSteps WHERE version_id = ? ORDER BY step_number
  `).all(recipe.current_version_id);

  // タグリストを取得
  const tags = db.prepare(`
    SELECT t.name FROM tags t
    JOIN recipeTags rt ON t.id = rt.tag_id
    WHERE rt.recipe_id = ?
  `).all(recipeId) as { name: string }[];

  return NextResponse.json({
    ...recipe,
    version,
    ingredients,
    steps,
    tags: tags.map(t => t.name),
  });
}

// レシピを削除する（DELETEリクエスト）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const { id } = await params;
  const recipeId = parseInt(id);

  const recipe = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(recipeId) as any;
  if (!recipe) {
    return NextResponse.json({ error: 'レシピが見つかりません' }, { status: 404 });
  }

  const deleteRecipe = db.transaction(() => {
    // current_version_id の外部キー制約を先に解除
    db.prepare(`UPDATE recipes SET current_version_id = NULL WHERE id = ?`).run(recipeId);

    // バージョンIDを全取得
    const versions = db.prepare(`SELECT id FROM recipeVersions WHERE recipe_id = ?`).all(recipeId) as { id: number }[];
    const versionIds = versions.map(v => v.id);

    // versionIngredients, versionSteps を削除
    for (const versionId of versionIds) {
      db.prepare(`DELETE FROM versionIngredients WHERE version_id = ?`).run(versionId);
      db.prepare(`DELETE FROM versionSteps WHERE version_id = ?`).run(versionId);
    }

    // recipeVersions を削除
    db.prepare(`DELETE FROM recipeVersions WHERE recipe_id = ?`).run(recipeId);

    // recipeTags を削除
    db.prepare(`DELETE FROM recipeTags WHERE recipe_id = ?`).run(recipeId);

    // recipes を削除
    db.prepare(`DELETE FROM recipes WHERE id = ?`).run(recipeId);

    // sources を削除（他のレシピで使われていなければ）
    if (recipe.source_id) {
      const otherUse = db.prepare(`SELECT COUNT(*) as cnt FROM recipes WHERE source_id = ?`).get(recipe.source_id) as { cnt: number };
      if (otherUse.cnt === 0) {
        db.prepare(`DELETE FROM sources WHERE id = ?`).run(recipe.source_id);
      }
    }
  });

  deleteRecipe();
  return NextResponse.json({ success: true });
}

// レシピを新しい版として更新する（PUTリクエスト）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const { id } = await params;
  const recipeId = parseInt(id);
  const body = await request.json();

  const {
    title,
    imageUrl,
    memo,
    changeNote,
    ingredients,
    steps,
    tags,
  } = body;

  // 既存のレシピを確認
  const recipe = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(recipeId) as any;
  if (!recipe) {
    return NextResponse.json({ error: 'レシピが見つかりません' }, { status: 404 });
  }

  // 現在の最新版番号を取得
  const latestVersion = db.prepare(`
    SELECT MAX(version_number) as max_version FROM recipeVersions WHERE recipe_id = ?
  `).get(recipeId) as { max_version: number };

  // トランザクションで新しい版を保存
  const update = db.transaction(() => {
    const newVersionNumber = (latestVersion.max_version || 0) + 1;

    // 新しい版を作成
    const versionResult = db.prepare(`
      INSERT INTO recipeVersions (recipe_id, version_number, title, image_url, memo, change_note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recipeId, newVersionNumber, title, imageUrl || '', memo || '', changeNote || '');

    const versionId = versionResult.lastInsertRowid;

    // 材料を保存
    (ingredients || []).forEach((ing: { name: string; amount: string; group?: string }, i: number) => {
      db.prepare(`
        INSERT INTO versionIngredients (version_id, ingredient_group, sort_order, name, amount) VALUES (?, ?, ?, ?, ?)
      `).run(versionId, ing.group || null, i, ing.name, ing.amount || '');
    });

    // 手順を保存
    (steps || []).forEach((step: { description: string }, i: number) => {
      db.prepare(`
        INSERT INTO versionSteps (version_id, step_number, description) VALUES (?, ?, ?)
      `).run(versionId, i + 1, step.description);
    });

    // 既存のタグを削除して新しいタグを設定
    db.prepare(`DELETE FROM recipeTags WHERE recipe_id = ?`).run(recipeId);
    (tags || []).forEach((tagName: string) => {
      if (!tagName.trim()) return;
      db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`).run(tagName.trim());
      const tag = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(tagName.trim()) as { id: number };
      db.prepare(`INSERT OR IGNORE INTO recipeTags (recipe_id, tag_id) VALUES (?, ?)`).run(recipeId, tag.id);
    });

    // current_version_idを更新
    db.prepare(`
      UPDATE recipes SET current_version_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
    `).run(versionId, recipeId);

    return { recipeId, versionId, versionNumber: newVersionNumber };
  });

  const result = update();
  return NextResponse.json(result);
}
