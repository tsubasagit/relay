import { useState, useEffect } from "react";
import {
  Mail,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { sendingAddressesApi, type SendingAddress } from "../lib/api";

export default function SendingAddresses() {
  const [addresses, setAddresses] = useState<SendingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAddress, setNewAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadAddresses();
  }, []);

  async function loadAddresses() {
    try {
      const res = await sendingAddressesApi.list();
      setAddresses(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newAddress) return;
    setAdding(true);
    setMessage(null);
    try {
      await sendingAddressesApi.create({
        address: newAddress,
        displayName: displayName || undefined,
      });
      setNewAddress("");
      setDisplayName("");
      loadAddresses();
      setMessage({ type: "success", text: "送信アドレスを追加しました" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "追加に失敗しました" });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("この送信アドレスを削除しますか？")) return;
    try {
      await sendingAddressesApi.delete(id);
      loadAddresses();
    } catch (err) {
      console.error(err);
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
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">送信アドレス</h1>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add address */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          送信アドレス追加
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          メールの「差出人」として表示されるアドレスです。Gmailアドレスはログイン時に自動登録されています。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="noreply@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              表示名（任意）
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="AppTalentHub"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !newAddress}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {adding ? "追加中..." : "追加"}
        </button>
      </div>

      {/* Address List */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          登録済みアドレス
        </h2>
        {addresses.length === 0 ? (
          <p className="text-sm text-gray-500">送信アドレスがまだ登録されていません</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {addresses.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {a.displayName ? `${a.displayName} <${a.address}>` : a.address}
                    </p>
                    <p className="text-xs text-gray-500">
                      {a.domainId === null ? "Gmail" : `ドメイン: ${a.domain}`}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                      a.domainId === null || a.domainStatus === "verified"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {a.domainId === null || a.domainStatus === "verified" ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {a.domainId === null || a.domainStatus === "verified" ? "有効" : "ドメイン未検証"}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
