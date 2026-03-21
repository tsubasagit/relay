import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Loader2,
  Copy,
  Check,
  Shield,
} from "lucide-react";
import { useAuthContext } from "../components/AuthProvider";
import { orgs as orgsApi, type OrgMember } from "../lib/api";

export default function OrgSettings() {
  const { currentOrg } = useAuthContext();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    loadMembers();
  }, [currentOrg?.id]);

  async function loadMembers() {
    if (!currentOrg) return;
    try {
      const res = await orgsApi.members(currentOrg.id);
      setMembers(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!currentOrg || !inviteEmail) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await orgsApi.invite(currentOrg.id, inviteEmail, inviteRole);
      setInviteToken(res.data.token);
      setInviteEmail("");
      setMessage({ type: "success", text: `${res.data.email} に招待を作成しました` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "招待に失敗しました" });
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!currentOrg || !confirm("このメンバーを削除しますか？")) return;
    try {
      await orgsApi.removeMember(currentOrg.id, memberId);
      loadMembers();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!currentOrg) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">組織設定</h1>

      {/* Org Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {currentOrg.name}
        </h2>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>スラッグ: {currentOrg.slug}</span>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
            {currentOrg.plan}
          </span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
            {currentOrg.role}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Invite Member */}
      {currentOrg.role === "admin" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            メンバー招待
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            招待リンクを生成し、メールで共有してください
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="new-member@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ロール
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="member">メンバー</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {inviting ? "招待中..." : "招待"}
            </button>
          </div>
          {inviteToken && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800 mb-2">
                招待リンク（7日間有効）:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-white px-2 py-1 rounded border break-all">
                  {window.location.origin}/invite/{inviteToken}
                </code>
                <button
                  onClick={() => handleCopy(`${window.location.origin}/invite/${inviteToken}`)}
                  className="p-1.5 text-amber-700 hover:bg-amber-100 rounded"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members List */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <Users className="w-5 h-5 inline-block mr-2 text-gray-400" />
          メンバー一覧
        </h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {m.avatarUrl ? (
                    <img
                      src={m.avatarUrl}
                      alt={m.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                      {m.name[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded ${
                      m.role === "admin"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {m.role === "admin" && <Shield className="w-3 h-3 inline mr-0.5" />}
                    {m.role === "admin" ? "管理者" : "メンバー"}
                  </span>
                </div>
                {currentOrg.role === "admin" && (
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="削除"
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
