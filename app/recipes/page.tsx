'use client';
// 保存済みレシピ一覧画面
// 保存したレシピをタイトルやタグで検索できます

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// レシピの型定義
interface Recipe {
  id: number;
  title: string;
  image_url: string;
  updated_at: string;
  tags: string;
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [titleQuery, setTitleQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // レシピを検索・取得する
  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (titleQuery) params.set('title', titleQuery);
    if (tagQuery) params.set('tag', tagQuery);

    const res = await fetch(`/api/recipes?${params}`);
    const data = await res.json();
    setRecipes(data);
    setLoading(false);
  }, [titleQuery, tagQuery]);

  // 検索条件が変わったら自動で再検索（0.5秒のデバウンス）
  useEffect(() => {
    const timer = setTimeout(fetchRecipes, 500);
    return () => clearTimeout(timer);
  }, [fetchRecipes]);

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ヘッダー */}
      <header className="bg-amber-600 text-white p-4 shadow-md">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">🍳 保存済みレシピ</h1>
          <Link href="/" className="text-amber-100 hover:text-white text-sm">← 取り込む</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {/* 検索フォーム */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-amber-100 space-y-3">
          <div>
            <input
              type="text"
              value={titleQuery}
              onChange={e => setTitleQuery(e.target.value)}
              placeholder="タイトルで検索..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <input
              type="text"
              value={tagQuery}
              onChange={e => setTagQuery(e.target.value)}
              placeholder="タグで検索（例：和食）"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* レシピ一覧 */}
        {loading ? (
          <p className="text-center text-gray-400">読み込み中...</p>
        ) : recipes.length === 0 ? (
          <p className="text-center text-gray-400">
            {titleQuery || tagQuery ? '該当するレシピがありません' : 'まだレシピがありません'}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{recipes.length}件のレシピ</p>
            {recipes.map(recipe => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow border border-amber-100"
              >
                <div className="flex gap-4 items-start">
                  {/* サムネイル画像 */}
                  {recipe.image_url && (
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-800 truncate">{recipe.title}</h3>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {new Date(recipe.updated_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    {/* タグ表示 */}
                    {recipe.tags && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {recipe.tags.split(',').map((tag: string) => (
                          <span key={tag} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
