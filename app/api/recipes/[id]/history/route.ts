// レシピの履歴一覧取得API

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// 全ての版の一覧を取得する（GETリクエスト）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const { id } = await params;
  const recipeId = parseInt(id);

  // 全版の一覧（新しい順）
  const versions = db.prepare(`
    SELECT rv.*,
      (SELECT GROUP_CONCAT(name || ' ' || amount, ', ')
       FROM versionIngredients WHERE version_id = rv.id) as ingredients_summary
    FROM recipeVersions rv
    WHERE rv.recipe_id = ?
    ORDER BY rv.version_number DESC
  `).all(recipeId);

  return NextResponse.json(versions);
}
