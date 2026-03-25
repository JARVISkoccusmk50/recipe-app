'use client';
// 取り込み画面（トップページ）
// URLを入力してレシピを取り込む画面です

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 最近保存したレシピの型定義
interface RecentRecipe {
  id: number;
  title: string;
  updated_at: string;
  tags: string;
}

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentRecipes, setRecentRecipes] = useState<RecentRecipe[]>([]);

  // 最近のレシピを取得
  useEffect(() => {
    fetch('/api/recipes')
      .then(res => res.json())
      .then(data => setRecentRecipes(data.slice(0, 5)))
      .catch(console.error);
  }, []);

  // 取り込みボタンを押したときの処理
  const handleImport = async () => {
    if (!url.trim()) {
      setError('URLを入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // スクレイピングAPIを呼び出す
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '取り込みに失敗しました');
        return;
      }

      const data = await res.json();

      // URLパラメータとして確認画面へ遷移（sessionStorageはlocaltunnel非対応のため）
      router.push(`/import?url=${encodeURIComponent(url)}`);
    } catch (e) {
      setError('取り込みに失敗しました。URLを確認してください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ヘッダー */}
      <header className="bg-amber-600 text-white p-4 shadow-md">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">🍳 マイレシピ帳</h1>
          <Link href="/recipes" className="text-amber-100 hover:text-white underline">
            保存済み一覧 →
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {/* URL取り込みフォーム */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            レシピを取り込む
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            レシピサイトのURLを貼り付けて「取り込む」ボタンを押してください
          </p>

          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleImport()}
              placeholder="https://example.com/recipe/..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 bg-white text-gray-900"
            />
            <button
              onClick={handleImport}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[100px]"
            >
              {loading ? '⏳ 取り込み中...' : '取り込む'}
            </button>
          </div>

          {loading && (
            <p className="text-amber-600 text-sm mt-3 text-center animate-pulse">
              レシピを取り込んでいます。しばらくお待ちください...
            </p>
          )}

          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* 最近保存したレシピ */}
        {recentRecipes.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              最近保存したレシピ
            </h2>
            <div className="space-y-2">
              {recentRecipes.map(recipe => (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow border border-amber-100"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-800">{recipe.title}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(recipe.updated_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  {recipe.tags && (
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {recipe.tags.split(',').map((tag: string) => (
                        <span key={tag} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
            <Link href="/recipes" className="block text-center text-amber-600 hover:text-amber-700 mt-4 text-sm">
              すべて見る →
            </Link>
          </div>
        )}

        {recentRecipes.length === 0 && (
          <p className="text-center text-gray-400 mt-8">
            まだレシピが保存されていません。上のフォームからURLを取り込んでみましょう！
          </p>
        )}
      </main>
    </div>
  );
}
