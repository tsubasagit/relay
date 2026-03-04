import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Send, FileText, Mail, TrendingUp } from "lucide-react";
import { logs, templates as templatesApi, type Stats } from "../lib/api";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [templateCount, setTemplateCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([logs.stats(), templatesApi.list()])
      .then(([s, t]) => {
        setStats(s.data);
        setTemplateCount(t.data.length);
      })
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Send className="w-5 h-5 text-indigo-600" />}
          label="総送信数"
          value={stats?.total ?? 0}
        />
        <StatCard
          icon={<Mail className="w-5 h-5 text-green-600" />}
          label="送信成功"
          value={stats?.sent ?? 0}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          label="開封率"
          value={`${(stats?.openRate ?? 0).toFixed(1)}%`}
        />
        <StatCard
          icon={<FileText className="w-5 h-5 text-purple-600" />}
          label="テンプレート数"
          value={templateCount}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            クイックアクション
          </h2>
          <div className="space-y-3">
            <Link
              to="/templates/new"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-5 h-5 text-indigo-600" />
              <span className="text-sm text-gray-700">
                新しいテンプレートを作成
              </span>
            </Link>
            <Link
              to="/logs"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Send className="w-5 h-5 text-indigo-600" />
              <span className="text-sm text-gray-700">配信ログを確認</span>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            配信統計サマリー
          </h2>
          <div className="space-y-3">
            <StatRow label="送信失敗" value={stats?.failed ?? 0} />
            <StatRow label="開封数" value={stats?.opened ?? 0} />
            <StatRow label="クリック数" value={stats?.clicked ?? 0} />
            <StatRow
              label="クリック率"
              value={`${(stats?.clickRate ?? 0).toFixed(1)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-2">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
