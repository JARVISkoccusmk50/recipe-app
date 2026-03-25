'use client';
// レシピ編集画面
// 既存のレシピを編集すると、新しい版として保存されます

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Ingredient {
  name: string;
  amount: string;
  group?: string; // グループラベル（例：「A」「B」「合わせ調味料」）
}

interface Step {
  description: string;
}

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 編集フォームの状態
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [memo, setMemo] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [tagsInput, setTagsInput] = useState('');

  // 既存のレシピデータを取得して初期値を設定
  useEffect(() => {
    if (!recipeId) return;
    fetch(`/api/recipes/${recipeId}`)
      .then(res => res.json())
      .then(data => {
        setTitle(data.version?.title || '');
        setImageUrl(data.version?.image_url || '');
        setMemo(data.version?.memo || '');
        setChangeNote('');
        setIngredients(
          data.ingredients?.length > 0
            ? data.ingredients.map((i: any) => ({ name: i.name, amount: i.amount, group: i.ingredient_group || '' }))
            : [{ name: '', amount: '', group: '' }]
        );
        setSteps(
          data.steps?.length > 0
            ? data.steps.map((s: any) => ({ description: s.description }))
            : [{ description: '' }]
        );
        setTagsInput(data.tags?.join(', ') || '');
        setLoading(false);
      })
      .catch(() => {
        setError('レシピの読み込みに失敗しました');
        setLoading(false);
      });
  }, [recipeId]);

  // 材料の追加・変更・削除
  const addIngredient = () => setIngredients([...ingredients, { name: '', amount: '', group: '' }]);
  const updateIngredient = (i: number, field: 'name' | 'amount' | 'group', val: string) => {
    const arr = [...ingredients];
    arr[i][field] = val;
    setIngredients(arr);
  };
  const removeIngredient = (i: number) => setIngredients(ingredients.filter((_, idx) => idx !== i));

  // 手順の追加・変更・削除
  const addStep = () => setSteps([...steps, { description: '' }]);
  const updateStep = (i: number, val: string) => {
    const arr = [...steps];
    arr[i].description = val;
    setSteps(arr);
  };
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  // 保存処理（新しい版として保存）
  const handleSave = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }
    setSaving(true);
    setError('');

    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
    const cleanIngredients = ingredients.filter(i => i.name.trim());
    const cleanSteps = steps.filter(s => s.description.trim());

    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

      // 保存成功後、詳細ページへ戻る
      router.push(`/recipes/${recipeId}`);
    } catch (e) {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ヘッダー */}
      <header className="bg-amber-600 text-white p-4 shadow-md">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">✏️ レシピを編集</h1>
          <Link href={`/recipes/${recipeId}`} className="text-amber-100 hover:text-white text-sm">← 戻る</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 mb-6 text-sm text-amber-800">
          💡 編集して保存すると、新しい版として履歴に残ります。古い版はいつでも見返せます。
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-amber-100 space-y-5">
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
                    placeholder="材料名"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white text-gray-900"
                  />
                  <input
                    type="text"
                    value={ing.amount}
                    onChange={e => updateIngredient(i, 'amount', e.target.value)}
                    placeholder="分量"
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white text-gray-900"
                  />
                  <button onClick={() => removeIngredient(i)} className="text-gray-400 hover:text-red-500 px-2">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addIngredient} className="mt-2 text-sm text-amber-600 hover:text-amber-700">
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
                    rows={2}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none bg-white text-gray-900"
                  />
                  <button onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-500 px-2 pt-2">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addStep} className="mt-2 text-sm text-amber-600 hover:text-amber-700">
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
            />
          </div>

          {/* タグ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タグ</label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white text-gray-900"
              placeholder="カンマ区切り（例：和食, 簡単）"
            />
          </div>

          {/* 変更ポイント */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">今回の変更ポイント</label>
            <input
              type="text"
              value={changeNote}
              onChange={e => setChangeNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white text-gray-900"
              placeholder="今回何を変更したか（例：砂糖を半量に）"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '新しい版として保存'}
          </button>
        </div>
      </main>
    </div>
  );
}
