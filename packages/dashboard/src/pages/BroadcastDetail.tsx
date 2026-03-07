import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { broadcastsApi, type BroadcastDetail as BroadcastDetailType } from "../lib/api";

const statusConfig: Record<
  string,
  { label: string; icon: React.ElementType; className: string; bgClass: string }
> = {
  draft: {
    label: "下書き",
    icon: Clock,
    className: "text-gray-600",
    bgClass: "bg-gray-100",
  },
  sending: {
    label: "送信中",
    icon: Loader2,
    className: "text-blue-600",
    bgClass: "bg-blue-100",
  },
  completed: {
    label: "完了",
    icon: CheckCircle2,
    className: "text-green-600",
    bgClass: "bg-green-100",
  },
  failed: {
    label: "失敗",
    icon: AlertTriangle,
    className: "text-red-600",
    bgClass: "bg-red-100",
  },
};

export default function BroadcastDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [broadcast, setBroadcast] = useState<BroadcastDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined);

  async function load() {
    if (!id) return;
    try {
      const res = await broadcastsApi.get(id);
      setBroadcast(res.data);
      return res.data;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  // Poll while sending
  useEffect(() => {
    if (broadcast?.status === "sending") {
      pollingRef.current = setInterval(async () => {
        const data = await load();
        if (data && data.status !== "sending") {
          clearInterval(pollingRef.current);
        }
      }, 3000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [broadcast?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">配信が見つかりません</p>
      </div>
    );
  }

  const status = statusConfig[broadcast.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const progress =
    broadcast.totalCount > 0
      ? ((broadcast.sentCount + broadcast.failedCount + broadcast.skippedCount) /
          broadcast.totalCount) *
        100
      : 0;

  return (
    <div>
      <button
        onClick={() => navigate("/broadcasts")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        配信一覧
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {broadcast.subject}
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bgClass} ${status.className}`}
            >
              <StatusIcon
                className={`w-3.5 h-3.5 ${
                  broadcast.status === "sending" ? "animate-spin" : ""
                }`}
              />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>From: {broadcast.fromAddress}</span>
            {broadcast.audienceName && (
              <span>To: {broadcast.audienceName}</span>
            )}
            <span>
              {new Date(broadcast.createdAt).toLocaleString("ja-JP")}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">配信進捗</h2>
          <span className="text-sm text-gray-500">
            {broadcast.sentCount + broadcast.failedCount + broadcast.skippedCount}{" "}
            / {broadcast.totalCount}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {broadcast.totalCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">合計</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {broadcast.sentCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">送信済</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">
              {broadcast.failedCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">失敗</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <p className="text-2xl font-bold text-amber-600">
              {broadcast.skippedCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">スキップ</p>
          </div>
        </div>
      </div>

      {/* Broadcast Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">配信情報</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">テンプレート</dt>
            <dd className="text-gray-900 font-medium mt-0.5">
              {broadcast.templateName || "-"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">オーディエンス</dt>
            <dd className="text-gray-900 font-medium mt-0.5">
              {broadcast.audienceName || "-"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">送信アドレス</dt>
            <dd className="text-gray-900 font-medium mt-0.5">
              {broadcast.fromAddress}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">完了日時</dt>
            <dd className="text-gray-900 font-medium mt-0.5">
              {broadcast.completedAt
                ? new Date(broadcast.completedAt).toLocaleString("ja-JP")
                : "-"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Logs */}
      {broadcast.logs && broadcast.logs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">配信ログ</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  宛先
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  ステータス
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                  送信日時
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {broadcast.logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {log.toAddress}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : log.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {log.status === "sent"
                        ? "送信済"
                        : log.status === "failed"
                        ? "失敗"
                        : log.status === "queued"
                        ? "待機中"
                        : log.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {log.sentAt
                      ? new Date(log.sentAt).toLocaleString("ja-JP")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
