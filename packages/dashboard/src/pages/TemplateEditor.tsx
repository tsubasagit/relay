import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Save, Send, ArrowLeft } from "lucide-react";
import { templates as api } from "../lib/api";

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [category, setCategory] = useState<"transactional" | "marketing">(
    "transactional"
  );
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (id) {
      api
        .get(id)
        .then((res) => {
          const t = res.data;
          setName(t.name);
          setSubject(t.subject);
          setBodyHtml(t.bodyHtml);
          setBodyText(t.bodyText || "");
          setCategory(t.category);
        })
        .catch(() => navigate("/templates"))
        .finally(() => setLoading(false));
    }
  }, [id, navigate]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const data = {
        name,
        subject,
        bodyHtml,
        bodyText: bodyText || undefined,
        category,
      };
      if (isNew) {
        const res = await api.create(data);
        navigate(`/templates/${res.data.id}`);
        setMessage("作成しました");
      } else {
        await api.update(id!, data);
        setMessage("保存しました");
      }
    } catch (err) {
      setMessage(
        `エラー: ${err instanceof Error ? err.message : "保存に失敗しました"}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSend() {
    if (!id || !testTo) return;
    setTestSending(true);
    setMessage("");
    try {
      const res = await api.test(id, testTo);
      setMessage(`テストメール送信完了: ${res.subject}`);
    } catch (err) {
      setMessage(
        `エラー: ${err instanceof Error ? err.message : "送信に失敗しました"}`
      );
    } finally {
      setTestSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/templates")}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? "新規テンプレート" : "テンプレート編集"}
        </h1>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.startsWith("エラー")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              テンプレート名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 応募通知メール"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カテゴリ
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as "transactional" | "marketing"
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="transactional">トランザクション</option>
              <option value="marketing">マーケティング</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            件名
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="例: 【AppTalentHub】新しい応募がありました - {{engineerName}}"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            {"{{変数名}}"} でテンプレート変数を使用できます
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            HTML本文
          </label>
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={12}
            placeholder="<h1>こんにちは {{name}} さん</h1><p>...</p>"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            テキスト本文（オプション）
          </label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={4}
            placeholder="プレーンテキスト版（HTMLが表示できないクライアント用）"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !name || !subject || !bodyHtml}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {!isNew && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            テスト送信
          </h2>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                送信先メールアドレス
              </label>
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="test@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleTestSend}
              disabled={testSending || !testTo}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              {testSending ? "送信中..." : "テスト送信"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
