import { useEffect, useState } from "react";
import { Send, Eye, MousePointer } from "lucide-react";
import { logs as api, type Stats } from "../lib/api";

export default function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .stats()
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-500">
        統計データの取得に失敗しました
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">分析</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          icon={<Send className="w-6 h-6 text-indigo-600" />}
          label="総送信数"
          value={stats.total}
          sub={`成功: ${stats.sent}`}
        />
        <MetricCard
          icon={<Eye className="w-6 h-6 text-blue-600" />}
          label="開封率"
          value={`${stats.openRate.toFixed(1)}%`}
          sub={`${stats.opened} / ${stats.sent} 件`}
        />
        <MetricCard
          icon={<MousePointer className="w-6 h-6 text-purple-600" />}
          label="クリック率"
          value={`${stats.clickRate.toFixed(1)}%`}
          sub={`${stats.clicked} / ${stats.sent} 件`}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          配信ステータス内訳
        </h2>
        <div className="space-y-4">
          <BarRow
            label="送信成功"
            count={stats.sent}
            total={stats.total}
            color="bg-green-500"
          />
          <BarRow
            label="送信失敗"
            count={stats.failed}
            total={stats.total}
            color="bg-red-500"
          />
          <BarRow
            label="開封"
            count={stats.opened}
            total={stats.total}
            color="bg-blue-500"
          />
          <BarRow
            label="クリック"
            count={stats.clicked}
            total={stats.total}
            color="bg-purple-500"
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-3">{icon}</div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function BarRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-900">
          {count} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
