'use client';
// 履歴画面
// レシピの全ての版（バージョン）の一覧を表示します

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// 版の型定義
interface Version {
  id: number;
  version_number: number;
  title: string;
  change_note: string;
  created_at: string;
  ingredients_summary: string;
}

// 特定の版の詳細データの型
interface VersionDetail {
  version: {
    id: number;
    version_number: number;
    title: string;
    image_url: string;
    memo: string;
    change_note: string;
    created_at: string;
  };
  ingredients: { id: number; name: string; amount: string }[];
  steps: { id: number; step_number: number; description: string }[];
}

export default function HistoryPage() {
  const params = useParams();
  const recipeId = params.id;

  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  // 選択して開いた版の詳細
  const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);

  // 履歴一覧を取得
  useEffect(() => {
    if (!recipeId) return;
    fetch(`/api/recipes/${recipeId}/history`)
      .then(res => res.json())
      .then(data => {
        setVersions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [recipeId]);

  // 特定の版の詳細を取得
  const handleSelectVersion = async (versionId: number) => {
    // すでに選択中の版を再クリックしたら閉じる
    if (selectedVersion?.version.id === versionId) {
      setSelectedVersion(null);
      return;
    }

    setLoadingVersion(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/versions/${versionId}`);
      const data = await res.json();
      setSelectedVersion(data);
    } finally {
      setLoadingVersion(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ヘッダー */}
      <header className="bg-amber-600 text-white p-4 shadow-md">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">📜 編集履歴</h1>
          <Link href={`/recipes/${recipeId}`} className="text-amber-100 hover:text-white text-sm">← 詳細へ</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {loading ? (
          <p className="text-center text-gray-400">読み込み中...</p>
        ) : versions.length === 0 ? (
          <p className="text-center text-gray-400">履歴がありません</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{versions.length}版の記録</p>

            {versions.map(v => (
              <div key={v.id}>
                {/* 版の概要カード */}
                <button
                  onClick={() => handleSelectVersion(v.id)}
                  className="w-full text-left bg-white rounded-xl shadow-sm p-4 border border-amber-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-sm font-bold text-amber-600">第{v.version_number}版</span>
                      <span className="text-gray-800 ml-2">{v.title}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(v.created_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  {v.change_note && (
                    <p className="text-sm text-gray-500 mt-1">📝 {v.change_note}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    クリックで詳細を{selectedVersion?.version.id === v.id ? '閉じる' : '開く'}
                  </p>
                </button>

                {/* 選択した版の詳細（アコーディオン展開） */}
                {selectedVersion?.version.id === v.id && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-1 ml-4 space-y-4">
                    {loadingVersion ? (
                      <p className="text-center text-gray-400 text-sm">読み込み中...</p>
                    ) : (
                      <>
                        <h3 className="font-semibold text-gray-800">{selectedVersion.version.title}</h3>

                        {/* 材料 */}
                        {selectedVersion.ingredients.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-600 mb-2">材料</h4>
                            <ul className="space-y-1">
                              {selectedVersion.ingredients.map((ing, i) => (
                                <li key={ing.id} className="flex justify-between text-sm">
                                  <span className="text-gray-700">
                                    <span className="text-gray-400 mr-1">{i + 1}.</span>{ing.name}
                                  </span>
                                  <span className="text-gray-500">{ing.amount}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* 手順 */}
                        {selectedVersion.steps.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-600 mb-2">手順</h4>
                            <ol className="space-y-2">
                              {selectedVersion.steps.map(step => (
                                <li key={step.id} className="flex gap-2 text-sm">
                                  <span className="flex-shrink-0 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs">
                                    {step.step_number}
                                  </span>
                                  <span className="text-gray-700">{step.description}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* メモ */}
                        {selectedVersion.version.memo && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-600 mb-1">メモ</h4>
                            <p className="text-sm text-gray-700">{selectedVersion.version.memo}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
