import { useState, useEffect } from "react";
import {
  Server,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Star,
  Zap,
  Shield,
} from "lucide-react";
import { providers as providersApi, type ProviderInfo, type CreateProvider } from "../lib/api";

export default function Providers() {
  const [providerList, setProviderList] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"gmail" | "smtp" | "sendgrid" | "ses">("gmail");
  const [isDefault, setIsDefault] = useState(false);
  const [creating, setCreating] = useState(false);

  // Gmail preset fields
  const [gmailAddress, setGmailAddress] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");

  // SMTP fields
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");

  // SendGrid fields
  const [sgApiKey, setSgApiKey] = useState("");

  // SES fields
  const [sesAccessKey, setSesAccessKey] = useState("");
  const [sesSecretKey, setSesSecretKey] = useState("");
  const [sesRegion, setSesRegion] = useState("ap-northeast-1");

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    try {
      const res = await providersApi.list();
      setProviderList(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function getConfig(): Record<string, unknown> {
    switch (type) {
      case "gmail":
        return { host: "smtp.gmail.com", port: 587, username: gmailAddress, password: gmailAppPassword };
      case "smtp":
        return { host: smtpHost, port: parseInt(smtpPort), username: smtpUser, password: smtpPass };
      case "sendgrid":
        return { apiKey: sgApiKey };
      case "ses":
        return { accessKeyId: sesAccessKey, secretAccessKey: sesSecretKey, region: sesRegion };
    }
  }

  async function handleCreate() {
    if (!name) return;
    setCreating(true);
    setMessage(null);
    try {
      const apiType = type === "gmail" ? "smtp" : type;
      const data: CreateProvider = { name, type: apiType, config: getConfig(), isDefault };
      await providersApi.create(data);
      loadProviders();
      setShowCreate(false);
      resetForm();
      setMessage({ type: "success", text: "プロバイダーを追加しました" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "追加に失敗しました" });
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setName("");
    setType("gmail");
    setIsDefault(false);
    setGmailAddress("");
    setGmailAppPassword("");
    setSmtpHost("");
    setSmtpPort("587");
    setSmtpUser("");
    setSmtpPass("");
    setSgApiKey("");
    setSesAccessKey("");
    setSesSecretKey("");
    setSesRegion("ap-northeast-1");
  }

  async function handleTest(id: string) {
    setTesting(id);
    setMessage(null);
    try {
      const res = await providersApi.test(id);
      setMessage({ type: "success", text: res.message });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "接続テスト失敗" });
    } finally {
      setTesting(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このプロバイダーを削除しますか？")) return;
    try {
      await providersApi.delete(id);
      loadProviders();
    } catch (err) {
      console.error(err);
    }
  }

  const typeLabel: Record<string, string> = { smtp: "SMTP", sendgrid: "SendGrid", ses: "Amazon SES", "gmail-oauth": "Gmail（自動設定）" };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">メールプロバイダー</h1>
        <p className="mt-1 text-sm text-gray-500">
          メールの送信に使用するサービスを設定します。Googleログインで自動設定された Gmail は、そのまま利用できます。
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Create form */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          プロバイダー追加
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            新規プロバイダー
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="本番SMTP" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイプ</label>
                <select value={type} onChange={(e) => setType(e.target.value as "gmail" | "smtp" | "sendgrid" | "ses")} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="gmail">Gmail（おすすめ）</option>
                  <option value="smtp">SMTP</option>
                  <option value="sendgrid">SendGrid</option>
                  <option value="ses">Amazon SES</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm text-gray-700">デフォルトにする</span>
                </label>
              </div>
            </div>

            {type === "gmail" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                    <input type="email" value={gmailAddress} onChange={(e) => setGmailAddress(e.target.value)} placeholder="your@gmail.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">アプリパスワード</label>
                    <input type="password" value={gmailAppPassword} onChange={(e) => setGmailAppPassword(e.target.value)} placeholder="16文字のアプリパスワード" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-medium mb-2">アプリパスワードの取得方法:</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700">
                    <li>Google アカウント設定を開く</li>
                    <li>セキュリティ → 2段階認証を有効にする</li>
                    <li>アプリパスワード →「メール」で生成</li>
                    <li>生成された16文字を上に貼り付け</li>
                  </ol>
                </div>
              </div>
            )}

            {type === "smtp" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ホスト</label>
                  <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ポート</label>
                  <input type="text" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ユーザー名</label>
                  <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="user@example.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                  <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="アプリパスワード" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            )}

            {type === "sendgrid" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input type="password" value={sgApiKey} onChange={(e) => setSgApiKey(e.target.value)} placeholder="SG.xxxxx" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}

            {type === "ses" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Key ID</label>
                  <input type="text" value={sesAccessKey} onChange={(e) => setSesAccessKey(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secret Access Key</label>
                  <input type="password" value={sesSecretKey} onChange={(e) => setSesSecretKey(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">リージョン</label>
                  <input type="text" value={sesRegion} onChange={(e) => setSesRegion(e.target.value)} placeholder="ap-northeast-1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={creating || !name} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? "追加中..." : "追加"}
              </button>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider List */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          登録済みプロバイダー
        </h2>
        {providerList.length === 0 ? (
          <p className="text-sm text-gray-500">
            プロバイダーがまだ設定されていません
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {providerList.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      {p.isDefault && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded font-medium">
                          <Star className="w-3 h-3" />
                          デフォルト
                        </span>
                      )}
                      {p.type === "gmail-oauth" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium">
                          <Shield className="w-3 h-3" />
                          Googleログインで自動設定済み
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {typeLabel[p.type] ?? p.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(p.id)}
                    disabled={testing === p.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {testing === p.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                    テスト
                  </button>
                  {p.type !== "gmail-oauth" && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
