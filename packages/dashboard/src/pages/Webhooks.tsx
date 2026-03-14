import { useEffect, useState } from "react";
import {
  Plus,
  Webhook,
  Trash2,
  Eye,
  EyeOff,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import {
  webhooksApi,
  type WebhookInfo,
  type WebhookLog,
} from "../lib/api";

const AVAILABLE_EVENTS = [
  { value: "email.sent", label: "メール送信" },
  { value: "email.delivered", label: "メール配信" },
  { value: "email.bounced", label: "バウンス" },
  { value: "email.failed", label: "送信失敗" },
  { value: "email.opened", label: "開封" },
  { value: "email.clicked", label: "クリック" },
  { value: "contact.unsubscribed", label: "配信停止" },
];

export default function Webhooks() {
  const [hooks, setHooks] = useState<WebhookInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState("");

  // Detail / Logs
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await webhooksApi.list();
      setHooks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!newUrl || newEvents.length === 0) {
      setError("URLとイベントを入力してください");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await webhooksApi.create({ url: newUrl, events: newEvents });
      setCreatedSecret(res.data.secret);
      setNewUrl("");
      setNewEvents([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このWebhookを削除しますか？")) return;
    try {
      await webhooksApi.delete(id);
      setHooks(hooks.filter((h) => h.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    try {
      await webhooksApi.update(id, { isActive: !currentActive });
      setHooks(hooks.map((h) => (h.id === id ? { ...h, isActive: !currentActive } : h)));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTest(id: string) {
    try {
      await webhooksApi.test(id);
      alert("テストイベントを送信しました");
      if (expandedId === id) loadLogs(id);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadLogs(id: string) {
    setLogsLoading(true);
    try {
      const res = await webhooksApi.logs(id, { limit: 20 });
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setLogs([]);
    } else {
      setExpandedId(id);
      loadLogs(id);
    }
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Webhook</h1>
        <button
          onClick={() => {
            setShowCreate(!showCreate);
            setCreatedSecret("");
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {error && (
        <div className="p-3 mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Created secret display */}
      {createdSecret && (
        <div className="p-4 mb-6 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800 mb-2">
            Webhookが作成されました。以下のシークレットを安全に保存してください（再表示できません）:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white border border-green-200 rounded text-sm font-mono text-green-900">
              {createdSecret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdSecret);
              }}
              className="p-2 text-green-600 hover:bg-green-100 rounded"
              title="コピー"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Webhook作成
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                エンドポイントURL
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                イベント
              </label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_EVENTS.map((evt) => (
                  <label
                    key={evt.value}
                    className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={newEvents.includes(evt.value)}
                      onChange={() => toggleEvent(evt.value)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700">{evt.label}</span>
                    <span className="text-xs text-gray-400 font-mono">
                      {evt.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "作成中..." : "作成"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook list */}
      {hooks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Webhookが登録されていません</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-indigo-600 hover:underline text-sm"
          >
            最初のWebhookを作成
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {hooks.map((hook) => (
            <div
              key={hook.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      hook.isActive ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {hook.url}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {(hook.events as string[]).map((evt) => (
                        <span
                          key={evt}
                          className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-mono"
                        >
                          {evt}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => handleTest(hook.id)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    title="テスト送信"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(hook.id, hook.isActive)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title={hook.isActive ? "無効化" : "有効化"}
                  >
                    {hook.isActive ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleExpand(hook.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="ログ"
                  >
                    {expandedId === hook.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(hook.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded logs */}
              {expandedId === hook.id && (
                <div className="border-t border-gray-200">
                  <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase">
                      配信ログ（最新20件）
                    </p>
                    <button
                      onClick={() => loadLogs(hook.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  {logsLoading ? (
                    <div className="px-6 py-8 text-center">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">
                      ログがありません
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">
                            イベント
                          </th>
                          <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">
                            ステータス
                          </th>
                          <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">
                            試行回数
                          </th>
                          <th className="text-left px-6 py-2 text-xs font-semibold text-gray-500">
                            日時
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-2 text-xs font-mono text-gray-700">
                              {log.event}
                            </td>
                            <td className="px-6 py-2">
                              {log.success ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {log.statusCode}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-red-600">
                                  <XCircle className="w-3.5 h-3.5" />
                                  {log.statusCode || "エラー"}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-2 text-xs text-gray-500">
                              {log.attempts}回
                            </td>
                            <td className="px-6 py-2 text-xs text-gray-500">
                              {new Date(log.createdAt).toLocaleString("ja-JP")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
