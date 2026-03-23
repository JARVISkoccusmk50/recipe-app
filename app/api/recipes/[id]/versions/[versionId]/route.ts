// 特定の版のデータを取得するAPI（履歴から特定版を表示するときに使う）

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const db = getDb();
  const { versionId } = await params;
  const versionIdNum = parseInt(versionId);

  // 版の詳細を取得
  const version = db.prepare(`SELECT * FROM recipeVersions WHERE id = ?`).get(versionIdNum) as any;

  if (!version) {
    return NextResponse.json({ error: '版が見つかりません' }, { status: 404 });
  }

  // 材料と手順も取得
  const ingredients = db.prepare(`
    SELECT * FROM versionIngredients WHERE version_id = ? ORDER BY sort_order
  `).all(versionIdNum);

  const steps = db.prepare(`
    SELECT * FROM versionSteps WHERE version_id = ? ORDER BY step_number
  `).all(versionIdNum);

  return NextResponse.json({ version, ingredients, steps });
}
