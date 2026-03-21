import { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { keys as keysApi, type ApiKeyInfo } from "../lib/api";

export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">設定</h1>
      <ApiKeysPanel />
    </div>
  );
}

function ApiKeysPanel() {
  const [keyItems, setKeyItems] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  async function loadKeys() {
    try {
      const res = await keysApi.list();
      setKeyItems(res.data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadKeys();
  }, []);

  async function handleCreateKey() {
    if (!newKeyName) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await keysApi.create(newKeyName);
      setCreatedKey(res.data.key);
      setNewKeyName("");
      loadKeys();
    } catch (err) {
      setMessage(
        `エラー: ${err instanceof Error ? err.message : "作成に失敗しました"}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("このAPIキーを無効化しますか？")) return;
    try {
      await keysApi.revoke(id);
      loadKeys();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            message.startsWith("エラー")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Create new key */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          新規APIキー作成
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          外部サービスからAPIを利用するためのキーを作成します
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="キー名（例: TalentFlow本番用）"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <button
            onClick={handleCreateKey}
            disabled={loading || !newKeyName}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            {loading ? "作成中..." : "作成"}
          </button>
        </div>

        {createdKey && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800 mb-2">
              APIキーが作成されました（一度だけ表示されます）
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border border-amber-200 break-all">
                {createdKey}
              </code>
              <button
                onClick={() => handleCopy(createdKey)}
                className="p-2 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing keys */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          APIキー一覧
        </h2>
        {keyItems.length === 0 ? (
          <p className="text-sm text-gray-500">
            APIキーがまだありません
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {keyItems.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {k.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded ${
                        k.isActive
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {k.isActive ? "有効" : "無効"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-gray-500 font-mono">
                      {k.keyPrefix}...
                    </p>
                    <p className="text-xs text-gray-400">
                      作成:{" "}
                      {new Date(k.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                </div>
                {k.isActive && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="無効化"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
