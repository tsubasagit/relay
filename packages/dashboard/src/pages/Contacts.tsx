import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Upload,
  Users,
  Trash2,
  Edit2,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Cloud,
  Send,
  Eye,
  Check,
} from "lucide-react";
import {
  contactsApi,
  templates as templatesApi,
  sendingAddressesApi,
  broadcastsApi,
  type Contact,
  type Template,
  type SendingAddress,
} from "../lib/api";

export default function Contacts() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSendMail, setShowSendMail] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [googleImporting, setGoogleImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await contactsApi.list({ search: search || undefined, limit, offset });
      setItems(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, offset]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // Clear selection when page/search changes
  useEffect(() => {
    setSelected(new Set());
  }, [offset, search]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このコンタクトを削除しますか？")) return;
    try {
      await contactsApi.delete(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => prev - 1);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error(err);
      alert("削除に失敗しました");
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">コンタクト</h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {total}件
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            メール配信先の連絡先を管理します。チェックボックスで選択してメールを送信できます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (!confirm("Google Workspaceの連絡先をインポートしますか？")) return;
              setGoogleImporting(true);
              try {
                const res = await contactsApi.importGoogle();
                alert(`インポート: ${res.data.imported}件, スキップ: ${res.data.skipped}件`);
                load();
              } catch (err) {
                alert(err instanceof Error ? err.message : "インポートに失敗しました");
              } finally {
                setGoogleImporting(false);
              }
            }}
            disabled={googleImporting}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Cloud className="w-4 h-4" />
            {googleImporting ? "取得中..." : "Google Workspace"}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            CSVインポート
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新規追加
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="メールアドレスまたは名前で検索..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-900 font-medium mb-1">
            {search ? "検索結果がありません" : "コンタクトがありません"}
          </p>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
            {search
              ? "別のキーワードで検索してください"
              : "コンタクトはメール配信先となる個人の連絡先です。手動追加、CSVインポート、Google Workspaceから取り込めます。"}
          </p>
          {!search && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              コンタクトを追加
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 px-4 py-3">
                    <button
                      onClick={toggleSelectAll}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        selected.size === items.length && items.length > 0
                          ? "bg-indigo-600 border-indigo-600"
                          : selected.size > 0
                          ? "bg-indigo-200 border-indigo-400"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {selected.size === items.length && items.length > 0 && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                      {selected.size > 0 && selected.size < items.length && (
                        <div className="w-2 h-0.5 bg-indigo-600 rounded" />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    名前
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    ステータス
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    登録日
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 ${
                      selected.has(item.id) ? "bg-indigo-50" : ""
                    }`}
                  >
                    <td className="w-10 px-4 py-3">
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          selected.has(item.id)
                            ? "bg-indigo-600 border-indigo-600"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {selected.has(item.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">{item.email}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {item.name || "-"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.isUnsubscribed
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {item.isUnsubscribed ? "配信停止" : "有効"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditContact(item)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                {offset + 1} - {Math.min(offset + limit, total)} / {total}件
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Selection Action Bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">
              {selected.size}件選択中
            </span>
            <div className="w-px h-5 bg-gray-600" />
            <button
              onClick={() => setShowSendMail(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Send className="w-4 h-4" />
              メール送信
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAdd || editContact) && (
        <ContactModal
          contact={editContact}
          onClose={() => {
            setShowAdd(false);
            setEditContact(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditContact(null);
            load();
          }}
        />
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            load();
          }}
        />
      )}

      {/* Send Mail Modal */}
      {showSendMail && (
        <SendMailModal
          contactIds={[...selected]}
          contactCount={selected.size}
          onClose={() => setShowSendMail(false)}
          onSent={(broadcastId) => {
            setShowSendMail(false);
            setSelected(new Set());
            navigate(`/broadcasts/${broadcastId}`);
          }}
        />
      )}
    </div>
  );
}

function SendMailModal({
  contactIds,
  contactCount,
  onClose,
  onSent,
}: {
  contactIds: string[];
  contactCount: number;
  onClose: () => void;
  onSent: (broadcastId: string) => void;
}) {
  const [templatesList, setTemplatesList] = useState<Template[]>([]);
  const [addressesList, setAddressesList] = useState<SendingAddress[]>([]);
  const [loading, setLoading] = useState(true);

  const [templateId, setTemplateId] = useState("");
  const [fromAddressId, setFromAddressId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([templatesApi.list(), sendingAddressesApi.list()])
      .then(([tmplRes, addrRes]) => {
        setTemplatesList(tmplRes.data);
        setAddressesList(addrRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectedTemplate = templatesList.find((t) => t.id === templateId);

  useEffect(() => {
    if (selectedTemplate) {
      const newVars: Record<string, string> = {};
      for (const v of selectedTemplate.variables || []) {
        newVars[v] = variables[v] || "";
      }
      setVariables(newVars);
    }
  }, [templateId]);

  const templateVars = (selectedTemplate?.variables || []).filter(
    (v) => v !== "email" && v !== "name"
  );

  async function handleSend() {
    if (!templateId || !fromAddressId) {
      setError("テンプレートと送信アドレスを選択してください");
      return;
    }

    if (!confirm(`${contactCount}件のコンタクトにメールを送信しますか？`)) return;

    setSending(true);
    setError("");

    try {
      const res = await broadcastsApi.quickSend({
        contactIds,
        templateId,
        fromAddressId,
        variables: Object.keys(variables).length > 0 ? variables : undefined,
      });
      onSent(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">メール送信</h2>
            <p className="text-sm text-gray-500">{contactCount}件のコンタクトに送信</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  テンプレート *
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">テンプレートを選択...</option>
                  {templatesList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} - {t.subject}
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      <Eye className="w-4 h-4" />
                      {showPreview ? "プレビューを閉じる" : "プレビュー"}
                    </button>
                    {showPreview && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                        <p className="text-xs text-gray-500 mb-1">件名:</p>
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          {selectedTemplate.subject}
                        </p>
                        <p className="text-xs text-gray-500 mb-1">本文:</p>
                        <div
                          className="text-sm prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: selectedTemplate.bodyHtml,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sending Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  送信アドレス *
                </label>
                <select
                  value={fromAddressId}
                  onChange={(e) => setFromAddressId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">送信アドレスを選択...</option>
                  {addressesList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName ? `${a.displayName} <${a.address}>` : a.address}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Variables */}
              {templateVars.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    テンプレート変数
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    ※ {"{{email}}"} と {"{{name}}"} はコンタクト情報から自動挿入
                  </p>
                  <div className="space-y-2">
                    {templateVars.map((v) => (
                      <div key={v}>
                        <label className="block text-xs text-gray-600 mb-0.5">
                          {`{{${v}}}`}
                        </label>
                        <input
                          type="text"
                          value={variables[v] || ""}
                          onChange={(e) =>
                            setVariables((prev) => ({ ...prev, [v]: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !templateId || !fromAddressId || loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? "送信中..." : `${contactCount}件に送信`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(contact?.email || "");
  const [name, setName] = useState(contact?.name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (contact) {
        await contactsApi.update(contact.id, { email, name: name || undefined });
      } else {
        await contactsApi.create({ email, name: name || undefined });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {contact ? "コンタクト編集" : "コンタクト追加"}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              名前
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState("");

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError("");

    try {
      const res = await contactsApi.import(file);
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">CSVインポート</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {result ? (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  インポート完了
                </p>
                <div className="mt-2 text-sm text-green-700 space-y-1">
                  <p>インポート: {result.imported}件</p>
                  <p>スキップ（重複等）: {result.skipped}件</p>
                  <p>合計: {result.total}件</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={onImported}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  閉じる
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  CSVファイルをアップロードしてください。email列は必須です。name列は任意です。その他の列はmetadataとして保存されます。
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || importing}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {importing ? "インポート中..." : "インポート"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
