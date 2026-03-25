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
  group?: string; // グループラベル（例：「A」「B」「合わせ調味料」）
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
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', amount: '', group: '' }]);
  const [steps, setSteps] = useState<Step[]>([{ description: '' }]);
  const [parentTagsInput, setParentTagsInput] = useState(''); // 大タグ（例：豚、鶏）
  const [childTagsInput, setChildTagsInput] = useState('');  // 小タグ（例：豚バラ、鶏もも）

  const [multipleRecipes, setMultipleRecipes] = useState<{ title: string; ingredients: Ingredient[]; steps: Step[] }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // URLパラメータからurlを取得してスクレイピングAPIを呼び出す（初回のみ）
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
        setImageUrl(data.imageUrl || '');
        // 複数レシピ対応
        if (data.recipes && data.recipes.length > 1) {
          setMultipleRecipes(data.recipes);
          setTitle(data.recipes[0].title || '');
          setIngredients(data.recipes[0].ingredients && data.recipes[0].ingredients.length > 0 ? data.recipes[0].ingredients : [{ name: '', amount: '', group: '' }]);
          setSteps(data.recipes[0].steps && data.recipes[0].steps.length > 0 ? data.recipes[0].steps : [{ description: '' }]);
        } else {
          setTitle(data.title || '');
          // 材料・手順が取れていればセット
          if (data.ingredients && data.ingredients.length > 0) {
            setIngredients(data.ingredients);
          }
          if (data.steps && data.steps.length > 0) {
            setSteps(data.steps);
          }
        }
        // 大タグ・小タグを自動セット
        if (data.autoParentTags && data.autoParentTags.length > 0) {
          setParentTagsInput(data.autoParentTags.join(', '));
        }
        if (data.autoChildTags && data.autoChildTags.length > 0) {
          setChildTagsInput(data.autoChildTags.join(', '));
        }
      })
      .catch(() => {
        setError('取り込みに失敗しました。ホームに戻ってやり直してください。');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 材料の行を追加する
  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '', group: '' }]);
  };

  // 材料を変更する
  const updateIngredient = (index: number, field: 'name' | 'amount' | 'group', value: string) => {
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

    // 大タグ・小タグを合わせて保存
    const tags = [
      ...parentTagsInput.split(',').map(t => t.trim()).filter(t => t),
      ...childTagsInput.split(',').map(t => t.trim()).filter(t => t),
    ];

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
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        {error ? (
          <div className="text-center p-8">
            <p className="text-red-500 mb-4">{error}</p>
            <a href="/" className="text-amber-600 underline">← ホームに戻る</a>
          </div>
        ) : (
          <div className="text-center p-8">
            <p className="text-amber-600 text-lg animate-pulse">⏳ レシピを取り込んでいます...</p>
          </div>
        )}
      </div>
    );
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

        {/* 複数レシピ選択UI */}
        {multipleRecipes.length > 1 && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm font-semibold text-blue-700 mb-3">
              📋 {multipleRecipes.length}件のレシピが見つかりました。編集するレシピを選んでください。
            </p>
            <div className="space-y-2">
              {multipleRecipes.map((recipe, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTitle(recipe.title || '');
                    setIngredients(recipe.ingredients.length > 0 ? recipe.ingredients : [{ name: '', amount: '', group: '' }]);
                    setSteps(recipe.steps.length > 0 ? recipe.steps : [{ description: '' }]);
                  }}
                  className="w-full text-left bg-white rounded-lg px-4 py-3 border border-blue-100 hover:border-blue-400 transition-colors"
                >
                  <span className="font-medium text-gray-800">{recipe.title || `レシピ ${idx + 1}`}</span>
                  <span className="text-xs text-gray-400 ml-2">材料{recipe.ingredients.length}件・手順{recipe.steps.length}件</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white text-gray-900"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white text-gray-900"
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
                    value={ing.group || ''}
                    onChange={e => updateIngredient(i, 'group', e.target.value)}
                    placeholder="A"
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white text-gray-900"
                    title="グループ（任意）"
                  />
                  <input
                    type="text"
                    value={ing.name}
                    onChange={e => updateIngredient(i, 'name', e.target.value)}
                    placeholder="材料名（例：卵）"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white text-gray-900"
                  />
                  <input
                    type="text"
                    value={ing.amount}
                    onChange={e => updateIngredient(i, 'amount', e.target.value)}
                    placeholder="分量（例：2個）"
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white text-gray-900"
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
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none bg-white text-gray-900"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 resize-none bg-white text-gray-900"
              placeholder="自由メモ（コツ、感想など）"
            />
          </div>

          {/* タグ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              大タグ <span className="text-xs text-gray-400">（食材の大カテゴリ：豚、鶏、野菜など）</span>
            </label>
            <input
              type="text"
              value={parentTagsInput}
              onChange={e => setParentTagsInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white text-gray-900"
              placeholder="例：豚, 鶏"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              小タグ <span className="text-xs text-gray-400">（具体的な部位・食材：豚バラ、鶏もも、にんじんなど）</span>
            </label>
            <input
              type="text"
              value={childTagsInput}
              onChange={e => setChildTagsInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white text-gray-900"
              placeholder="例：豚バラ, にんじん"
            />
          </div>

          {/* 変更ポイント */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">変更ポイント</label>
            <input
              type="text"
              value={changeNote}
              onChange={e => setChangeNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white text-gray-900"
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
