import { useState, useEffect } from "react";
import {
  Globe,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { domainsApi, type Domain, type DnsInstruction } from "../lib/api";

export default function Domains() {
  const [domainList, setDomainList] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [dnsInfo, setDnsInfo] = useState<DnsInstruction | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadDomains();
  }, []);

  async function loadDomains() {
    try {
      const res = await domainsApi.list();
      setDomainList(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newDomain) return;
    setAdding(true);
    setMessage(null);
    setDnsInfo(null);
    try {
      const res = await domainsApi.create(newDomain);
      setDnsInfo(res.dnsInstructions);
      setNewDomain("");
      loadDomains();
      setMessage({ type: "success", text: "ドメインを登録しました。DNSレコードを設定してください。" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "登録に失敗しました" });
    } finally {
      setAdding(false);
    }
  }

  async function handleVerify(id: string) {
    setVerifying(id);
    setMessage(null);
    try {
      const res = await domainsApi.verify(id);
      setMessage({ type: "success", text: res.message });
      loadDomains();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "検証に失敗しました" });
    } finally {
      setVerifying(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このドメインを削除しますか？")) return;
    try {
      await domainsApi.delete(id);
      loadDomains();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ドメイン管理</h1>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Add domain */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          ドメイン登録
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          メール送信に使用するドメインを登録し、DNS検証を行います
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="example.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newDomain}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {adding ? "登録中..." : "登録"}
          </button>
        </div>
      </div>

      {/* DNS Instructions */}
      {dnsInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            DNS設定手順
          </h3>
          <p className="text-sm text-blue-800 mb-3">
            {dnsInfo.description}
          </p>
          <div className="bg-white rounded-lg p-3 border border-blue-200 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">タイプ:</span>
              <span className="font-mono font-medium">{dnsInfo.type}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">名前:</span>
              <span className="font-mono font-medium">{dnsInfo.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">値:</span>
              <code className="flex-1 font-mono text-xs bg-gray-50 px-2 py-1 rounded break-all">
                {dnsInfo.value}
              </code>
              <button
                onClick={() => handleCopy(dnsInfo.value)}
                className="p-1 hover:bg-blue-100 rounded"
              >
                {copied ? <Check className="w-4 h-4 text-blue-600" /> : <Copy className="w-4 h-4 text-blue-400" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domain List */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          登録済みドメイン
        </h2>
        {domainList.length === 0 ? (
          <p className="text-sm text-gray-500">ドメインがまだ登録されていません</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {domainList.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {d.domain}
                    </p>
                    <p className="text-xs text-gray-500">
                      登録: {new Date(d.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                      d.status === "verified"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {d.status === "verified" ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    {d.status === "verified" ? "検証済み" : "未検証"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {d.status === "pending" && (
                    <button
                      onClick={() => handleVerify(d.id)}
                      disabled={verifying === d.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    >
                      {verifying === d.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      検証
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
