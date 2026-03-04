import { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Mail,
  Server,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  keys as keysApi,
  settingsApi,
  setApiKey,
  getApiKey,
  type ApiKeyInfo,
  type SmtpSettings,
} from "../lib/api";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<"smtp" | "apikeys">("smtp");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">設定</h1>

      {/* API Key input (always visible) */}
      <ApiKeyInput />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <TabButton
          active={activeTab === "smtp"}
          onClick={() => setActiveTab("smtp")}
          icon={<Server className="w-4 h-4" />}
          label="SMTP設定"
        />
        <TabButton
          active={activeTab === "apikeys"}
          onClick={() => setActiveTab("apikeys")}
          icon={<Key className="w-4 h-4" />}
          label="APIキー管理"
        />
      </div>

      {activeTab === "smtp" ? <SmtpSettingsPanel /> : <ApiKeysPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? "border-indigo-600 text-indigo-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── API Key Input ─── */
function ApiKeyInput() {
  const [currentKey, setCurrentKey] = useState(getApiKey());
  const [message, setMessage] = useState("");

  function handleSet() {
    setApiKey(currentKey);
    setMessage("APIキーを設定しました");
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        ダッシュボード接続
      </h2>
      <p className="text-sm text-gray-500 mb-3">
        ダッシュボードがAPIと通信するためのキーを設定してください
      </p>
      {message && (
        <div className="mb-3 px-3 py-2 rounded-lg text-sm bg-green-50 text-green-700">
          {message}
        </div>
      )}
      <div className="flex gap-3">
        <input
          type="password"
          value={currentKey}
          onChange={(e) => setCurrentKey(e.target.value)}
          placeholder="tm_live_..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
        <button
          onClick={handleSet}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          設定
        </button>
      </div>
    </div>
  );
}

/* ─── SMTP Settings Panel ─── */
function SmtpSettingsPanel() {
  const [smtp, setSmtp] = useState<SmtpSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form fields
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromName, setFromName] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await settingsApi.getSmtp();
      setSmtp(res.data);
      setSmtpHost(res.data.smtpHost);
      setSmtpPort(res.data.smtpPort);
      setSmtpUser(res.data.smtpUser);
      setSmtpPass(res.data.smtpPass);
      setFromAddress(res.data.fromAddress);
      setFromName(res.data.fromName);
    } catch {
      // not configured yet
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updates: Record<string, string> = {};
      if (smtpHost) updates.smtpHost = smtpHost;
      if (smtpPort) updates.smtpPort = smtpPort;
      if (smtpUser) updates.smtpUser = smtpUser;
      if (smtpPass && smtpPass !== "••••••••") updates.smtpPass = smtpPass;
      if (fromAddress) updates.fromAddress = fromAddress;
      if (fromName) updates.fromName = fromName;

      const res = await settingsApi.updateSmtp(updates);
      setSmtp(res.data);
      setSmtpPass(res.data.smtpPass);
      setMessage({ type: "success", text: "SMTP設定を保存しました" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "保存に失敗しました",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await settingsApi.testConnection();
      setMessage({ type: "success", text: res.message });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "接続テスト失敗",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestSend() {
    if (!testTo) return;
    setSendingTest(true);
    setMessage(null);
    try {
      const res = await settingsApi.testSend(testTo);
      setMessage({ type: "success", text: res.message });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "テスト送信失敗",
      });
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            smtp?.isConfigured
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              smtp?.isConfigured ? "bg-green-500" : "bg-amber-500"
            }`}
          />
          {smtp?.isConfigured ? "設定済み" : "未設定"}
        </span>
      </div>

      {/* SMTP Server settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          SMTPサーバー
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Google Workspaceの場合: smtp.gmail.com / ポート587 /
          アプリパスワードを使用
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ホスト
            </label>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ポート
            </label>
            <input
              type="text"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              placeholder="587"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ユーザー名（メールアドレス）
            </label>
            <input
              type="email"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="info@apptalenthub.co.jp"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード（アプリパスワード）
            </label>
            <input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder="Google Workspaceのアプリパスワード"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Sender settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          送信者情報
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          メールの「差出人」として表示される情報です
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              送信元メールアドレス
            </label>
            <input
              type="email"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="info@apptalenthub.co.jp"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              送信者名
            </label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="AppTalentHub"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          {saving ? "保存中..." : "設定を保存"}
        </button>

        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Server className="w-4 h-4" />
          )}
          {testing ? "テスト中..." : "接続テスト"}
        </button>
      </div>

      {/* Test email */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          テストメール送信
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          設定が正しいか確認するためのテストメールを送信します
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              送信先
            </label>
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <button
            onClick={handleTestSend}
            disabled={sendingTest || !testTo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendingTest ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sendingTest ? "送信中..." : "テスト送信"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── API Keys Panel ─── */
function ApiKeysPanel() {
  const [keyItems, setKeyItems] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  async function loadKeys() {
    if (!getApiKey()) return;
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
          TalentFlow等の外部サービスからAPIを利用するためのキーを作成します
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
