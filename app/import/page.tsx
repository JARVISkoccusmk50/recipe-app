'use client';
// 取り込み確認・編集画面
// スクレイピングした内容を確認して編集し、保存する画面です

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// 材料の型
interface Ingredient {
  name: string;
  amount: string;
}

// 手順の型
interface Step {
  description: string;
}

function ImportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 元レシピの情報（スクレイピング結果）
  const [sourceData, setSourceData] = useState<{
    url: string;
    title: string;
    imageUrl: string;
    bodyText: string;
    rawHtml: string;
  } | null>(null);

  // 編集フォームの状態
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [memo, setMemo] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', amount: '' }]);
  const [steps, setSteps] = useState<Step[]>([{ description: '' }]);
  const [tagsInput, setTagsInput] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // URLパラメータからurlを取得してスクレイピングAPIを呼び出す
  useEffect(() => {
    const targetUrl = searchParams.get('url');
    if (!targetUrl) {
      router.push('/');
      return;
    }
    fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl }),
    })
      .then(res => {
        if (!res.ok) throw new Error('scrape failed');
        return res.json();
      })
      .then(data => {
        setSourceData({ url: targetUrl, ...data });
        setTitle(data.title || '');
        setImageUrl(data.imageUrl || '');
      })
      .catch(() => {
        router.push('/');
      });
  }, [router, searchParams]);

  // 材料の行を追加する
  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '' }]);
  };

  // 材料を変更する
  const updateIngredient = (index: number, field: 'name' | 'amount', value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index][field] = value;
    setIngredients(newIngredients);
  };

  // 材料の行を削除する
  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // 手順の行を追加する
  const addStep = () => {
    setSteps([...steps, { description: '' }]);
  };

  // 手順を変更する
  const updateStep = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index].description = value;
    setSteps(newSteps);
  };

  // 手順の行を削除する
  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  // 保存ボタンを押したときの処理
  const handleSave = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    setSaving(true);
    setError('');

    // タグをカンマ区切りで分割
    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);

    // 空の材料・手順を除外
    const cleanIngredients = ingredients.filter(i => i.name.trim());
    const cleanSteps = steps.filter(s => s.description.trim());

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: sourceData?.url,
          rawHtml: sourceData?.rawHtml,
          sourceTitle: sourceData?.title,
          title,
          imageUrl,
          memo,
          changeNote,
          ingredients: cleanIngredients,
          steps: cleanSteps,
          tags,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '保存に失敗しました');
        return;
      }

      const data = await res.json();
      // 保存成功後、詳細ページへ遷移
      router.push(`/recipes/${data.recipeId}`);
    } catch (e) {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (!sourceData) {
    return <div className="p-8 text-center">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ヘッダー */}
      <header className="bg-amber-600 text-white p-4 shadow-md">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">🍳 レシピを取り込む</h1>
          <Link href="/" className="text-amber-100 hover:text-white text-sm">← 戻る</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* 元レシピの情報 */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-amber-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">元レシピ</h2>
          <p className="font-medium text-gray-800">{sourceData.title || '（タイトルなし）'}</p>
          <a href={sourceData.url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-amber-600 hover:underline break-all">
            {sourceData.url}
          </a>
          {sourceData.bodyText && (
            <details className="mt-2">
              <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">
                取り込んだテキストを見る
              </summary>
              <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap max-h-40 overflow-y-auto border rounded p-2">
                {sourceData.bodyText}
              </p>
            </details>
          )}
        </div>

        {/* 編集フォーム */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-amber-100 space-y-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">自分のレシピとして編集</h2>

          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
              placeholder="例：ふわふわオムレツ（自分版）"
            />
          </div>

          {/* 画像URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">画像URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
              placeholder="https://..."
            />
            {imageUrl && (
              <img src={imageUrl} alt="プレビュー" className="mt-2 h-32 object-cover rounded-lg" />
            )}
          </div>

          {/* 材料 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">材料</label>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={e => updateIngredient(i, 'name', e.target.value)}
                    placeholder="材料名（例：卵）"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    value={ing.amount}
                    onChange={e => updateIngredient(i, 'amount', e.target.value)}
                    placeholder="分量（例：2個）"
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => removeIngredient(i)}
                    className="text-gray-400 hover:text-red-500 px-2"
                    title="削除"
                  >✕</button>
                </div>
              ))}
            </div>
            <button
              onClick={addIngredient}
              className="mt-2 text-sm text-amber-600 hover:text-amber-700"
            >
              ＋ 材料を追加
            </button>
          </div>

          {/* 手順 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">手順</label>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-sm text-gray-400 pt-2 min-w-[24px]">{i + 1}.</span>
                  <textarea
                    value={step.description}
                    onChange={e => updateStep(i, e.target.value)}
                    placeholder={`手順${i + 1}`}
                    rows={2}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
                  />
                  <button
                    onClick={() => removeStep(i)}
                    className="text-gray-400 hover:text-red-500 px-2 pt-2"
                    title="削除"
                  >✕</button>
                </div>
              ))}
            </div>
            <button
              onClick={addStep}
              className="mt-2 text-sm text-amber-600 hover:text-amber-700"
            >
              ＋ 手順を追加
            </button>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 resize-none"
              placeholder="自由メモ（コツ、感想など）"
            />
          </div>

          {/* タグ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タグ</label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
              placeholder="カンマ区切りで入力（例：和食, 簡単, 時短）"
            />
          </div>

          {/* 変更ポイント */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">変更ポイント</label>
            <input
              type="text"
              value={changeNote}
              onChange={e => setChangeNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
              placeholder="元レシピからどこを変えたか（例：砂糖を控えめにした）"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* 保存ボタン */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
      <ImportPageInner />
    </Suspense>
  );
}
