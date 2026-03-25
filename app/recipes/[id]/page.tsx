'use client';
// レシピ詳細画面
// 現在の版のレシピを表示し、編集・履歴確認ができます

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// レシピ詳細の型定義
interface RecipeDetail {
  id: number;
  source_url: string;
  source_title: string;
  updated_at: string;
  version: {
    id: number;
    version_number: number;
    title: string;
    image_url: string;
    memo: string;
    change_note: string;
    created_at: string;
  };
  ingredients: { id: number; name: string; amount: string; ingredient_group?: string | null }[];
  steps: { id: number; step_number: number; description: string }[];
  tags: string[];
}

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id;

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // レシピデータを取得
  useEffect(() => {
    if (!recipeId) return;
    fetch(`/api/recipes/${recipeId}`)
      .then(res => {
        if (!res.ok) throw new Error('取得失敗');
        return res.json();
      })
      .then(data => {
        setRecipe(data);
        setLoading(false);
      })
      .catch(() => {
        setError('レシピが見つかりませんでした');
        setLoading(false);
      });
  }, [recipeId]);

  if (loading) return <div className="p-8 text-center text-gray-400">読み込み中...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!recipe) return null;

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ヘッダー */}
      <header className="bg-amber-600 text-white p-4 shadow-md">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <Link href="/recipes" className="text-amber-100 hover:text-white text-sm">← 一覧</Link>
          <div className="flex gap-3">
            <Link
              href={`/recipes/${recipeId}/history`}
              className="text-amber-100 hover:text-white text-sm border border-amber-300 px-3 py-1 rounded"
            >
              📜 履歴
            </Link>
            <Link
              href={`/recipes/${recipeId}/edit`}
              className="bg-white text-amber-600 hover:bg-amber-50 text-sm px-3 py-1 rounded font-medium"
            >
              ✏️ 編集
            </Link>
            <button
              onClick={async () => {
                if (!confirm('このレシピを削除しますか？')) return;
                const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });
                if (res.ok) {
                  router.push('/recipes');
                }
              }}
              className="bg-red-500 text-white hover:bg-red-600 text-sm px-3 py-1 rounded font-medium"
            >
              🗑️ 削除
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* メインタイトル */}
        <div>
          {recipe.version.image_url && (
            <img
              src={recipe.version.image_url}
              alt={recipe.version.title}
              className="w-full h-48 object-cover rounded-xl mb-4"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <h1 className="text-2xl font-bold text-gray-800">{recipe.version.title}</h1>

          {/* タグ */}
          {recipe.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {recipe.tags.map(tag => (
                <span key={tag} className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <p className="text-sm text-gray-400 mt-2">
            版数: {recipe.version.version_number}版 |
            更新: {new Date(recipe.updated_at).toLocaleDateString('ja-JP')}
          </p>
        </div>

        {/* 変更ポイント */}
        {recipe.version.change_note && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-yellow-800 mb-1">📝 変更ポイント</h2>
            <p className="text-yellow-900">{recipe.version.change_note}</p>
          </div>
        )}

        {/* 材料リスト */}
        {recipe.ingredients.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 border border-amber-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">材料</h2>
            {(() => {
              // グループ別にまとめる
              const groups: { group: string | null; items: typeof recipe.ingredients }[] = [];
              recipe.ingredients.forEach(ing => {
                const g = ing.ingredient_group || null;
                const last = groups[groups.length - 1];
                if (last && last.group === g) {
                  last.items.push(ing);
                } else {
                  groups.push({ group: g, items: [ing] });
                }
              });
              return (
                <div className="space-y-3">
                  {groups.map((group, gi) => (
                    <div key={gi}>
                      {group.group && (
                        <div className="text-sm font-semibold text-amber-700 mb-1">〈{group.group}〉</div>
                      )}
                      <ul className="space-y-1">
                        {group.items.map(ing => (
                          <li key={ing.id} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                            <span className={`text-gray-700 ${group.group ? 'pl-3' : ''}`}>{ing.name}</span>
                            <span className="text-gray-500">{ing.amount}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* 手順リスト */}
        {recipe.steps.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 border border-amber-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">手順</h2>
            <ol className="space-y-4">
              {recipe.steps.map(step => (
                <li key={step.id} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {step.step_number}
                  </span>
                  <p className="text-gray-700 pt-0.5">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* メモ */}
        {recipe.version.memo && (
          <div className="bg-white rounded-xl shadow-sm p-5 border border-amber-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">メモ</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{recipe.version.memo}</p>
          </div>
        )}

        {/* 元レシピURL */}
        {recipe.source_url && (
          <div className="bg-white rounded-xl shadow-sm p-4 border border-amber-100">
            <h2 className="text-sm font-semibold text-gray-500 mb-1">元レシピ</h2>
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:underline text-sm break-all"
            >
              {recipe.source_title || recipe.source_url}
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
