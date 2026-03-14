import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Radio, ChevronLeft, ChevronRight } from "lucide-react";
import { broadcastsApi, type Broadcast } from "../lib/api";

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: "下書き", className: "bg-gray-100 text-gray-700" },
  scheduled: { label: "予約済", className: "bg-purple-100 text-purple-700" },
  sending: { label: "送信中", className: "bg-blue-100 text-blue-700" },
  completed: { label: "完了", className: "bg-green-100 text-green-700" },
  failed: { label: "失敗", className: "bg-red-100 text-red-700" },
};

export default function Broadcasts() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const navigate = useNavigate();

  async function load() {
    try {
      const res = await broadcastsApi.list({ limit, offset });
      setItems(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [offset]);

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
        <h1 className="text-2xl font-bold text-gray-900">一斉配信</h1>
        <button
          onClick={() => navigate("/broadcasts/new")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規配信
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Radio className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">配信履歴がありません</p>
          <button
            onClick={() => navigate("/broadcasts/new")}
            className="text-indigo-600 hover:underline text-sm"
          >
            最初の配信を作成
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    件名
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    オーディエンス
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    ステータス
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    送信数
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    日時
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const status = statusLabels[item.status] || statusLabels.draft;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/broadcasts/${item.id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-3 text-sm text-gray-900 font-medium">
                        {item.subject}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {item.audienceName || "-"}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {item.sentCount}/{item.totalCount}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {new Date(item.createdAt).toLocaleString("ja-JP")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                {offset + 1} - {Math.min(offset + limit, total)} / {total}件
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
