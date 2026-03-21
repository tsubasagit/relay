import { useEffect, useState } from "react";
import { Send, CheckCircle, XCircle, Clock, Eye, MousePointer } from "lucide-react";
import { logs as api, type EmailLog } from "../lib/api";

const STATUS_CONFIG = {
  queued: { label: "待機中", icon: Clock, color: "text-amber-600 bg-amber-50" },
  sent: { label: "送信済", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  bounced: { label: "バウンス", icon: XCircle, color: "text-orange-600 bg-orange-50" },
  failed: { label: "失敗", icon: XCircle, color: "text-red-600 bg-red-50" },
} as const;

export default function Logs() {
  const [items, setItems] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  async function load(status?: string) {
    setLoading(true);
    try {
      const res = await api.list({
        status: status || undefined,
        limit: 50,
      });
      setItems(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">配信ログ</h1>
        <span className="text-sm text-gray-500">全 {total} 件</span>
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { value: "", label: "すべて" },
          { value: "sent", label: "送信済" },
          { value: "failed", label: "失敗" },
          { value: "queued", label: "待機中" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === opt.value
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Send className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">配信ログがありません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {items.map((log) => {
            const config = STATUS_CONFIG[log.status];
            const Icon = config.icon;
            return (
              <div key={log.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {log.subject}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      To: {log.toAddress}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {log.openedAt && (
                      <span className="flex items-center gap-1 text-xs text-blue-600" title="開封済">
                        <Eye className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {log.clickedAt && (
                      <span className="flex items-center gap-1 text-xs text-purple-600" title="クリック済">
                        <MousePointer className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>
                  </div>
                </div>
                {log.status === "failed" && log.errorMessage && (
                  <p className="mt-1.5 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    {log.errorMessage}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>
                    {new Date(log.createdAt).toLocaleString("ja-JP")}
                  </span>
                  {log.sentAt && (
                    <span>
                      送信:{" "}
                      {new Date(log.sentAt).toLocaleString("ja-JP")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
