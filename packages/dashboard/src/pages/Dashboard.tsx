import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Send,
  FileText,
  Mail,
  TrendingUp,
  Users,
  PenSquare,
  ArrowRight,
  Gauge,
} from "lucide-react";
import {
  logs,
  templates as templatesApi,
  contactsApi,
  type Stats,
  type QuotaUsage,
} from "../lib/api";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [templateCount, setTemplateCount] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [quota, setQuota] = useState<QuotaUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      logs.stats(),
      templatesApi.list(),
      contactsApi.list({ limit: 1 }),
      logs.quota(),
    ])
      .then(([s, t, c, q]) => {
        setStats(s.data);
        setTemplateCount(t.data.length);
        setContactCount(c.total);
        setQuota(q.data);
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

  const isNewUser = (stats?.total ?? 0) === 0;

  // 初回ユーザー向けオンボーディング
  if (isNewUser) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-indigo-100 rounded-2xl mb-4">
            <Mail className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Relay へようこそ！
          </h1>
          <p className="text-gray-500">
            Gmailから始めるメール一斉配信。3ステップで初回送信できます。
          </p>
        </div>

        <div className="space-y-4">
          <OnboardingStep
            step={1}
            completed={contactCount > 0}
            title="コンタクトを追加"
            description="CSVアップロードまたは手動で追加できます"
            linkTo="/contacts"
            linkLabel="コンタクトを追加"
          />
          <OnboardingStep
            step={2}
            completed={false}
            title="最初のメールを作成"
            description="宛先を選んで、件名と本文を入力するだけ"
            linkTo="/compose"
            linkLabel="メールを作成"
            disabled={contactCount === 0}
          />
          <OnboardingStep
            step={3}
            completed={false}
            title="送信！"
            description="プレビューを確認して送信ボタンを押しましょう"
            linkTo="/compose"
            linkLabel=""
            disabled
          />
        </div>

        {quota && (
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-medium text-gray-700">
                本日の送信枠
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 rounded-full h-2"
                  style={{ width: `${Math.min((quota.used / quota.limit) * 100, 100)}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">
                {quota.used} / {quota.limit}通
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 通常ダッシュボード（送信実績あり）
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

      {/* クォータ表示 */}
      {quota && (
        <div className="mb-8 p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-medium text-gray-700">本日の送信枠</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 rounded-full h-2 transition-all"
                style={{
                  width: `${Math.min((quota.used / quota.limit) * 100, 100)}%`,
                }}
              />
            </div>
            <span className="text-sm text-gray-600">
              {quota.used} / {quota.limit}通
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            クイックアクション
          </h2>
          <div className="space-y-3">
            <Link
              to="/compose"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <PenSquare className="w-5 h-5 text-indigo-600" />
              <span className="text-sm text-gray-700">
                メールを作成
              </span>
            </Link>
            <Link
              to="/contacts"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Users className="w-5 h-5 text-indigo-600" />
              <span className="text-sm text-gray-700">
                コンタクトを管理
              </span>
            </Link>
            <Link
              to="/broadcasts"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Send className="w-5 h-5 text-indigo-600" />
              <span className="text-sm text-gray-700">配信履歴を確認</span>
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

function OnboardingStep({
  step,
  completed,
  title,
  description,
  linkTo,
  linkLabel,
  disabled,
}: {
  step: number;
  completed: boolean;
  title: string;
  description: string;
  linkTo: string;
  linkLabel: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 p-5 rounded-xl border transition-colors ${
        completed
          ? "bg-green-50 border-green-200"
          : disabled
          ? "bg-gray-50 border-gray-200 opacity-60"
          : "bg-white border-gray-200 hover:border-indigo-300"
      }`}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-sm ${
          completed ? "bg-green-500" : "bg-indigo-600"
        }`}
      >
        {completed ? "✓" : step}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {linkLabel && !disabled && !completed && (
        <Link
          to={linkTo}
          className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          {linkLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
      {completed && (
        <span className="text-sm text-green-600 font-medium">完了</span>
      )}
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
