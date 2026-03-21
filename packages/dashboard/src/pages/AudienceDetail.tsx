import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  UserMinus,
  Users2,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from "lucide-react";
import {
  audiencesApi,
  contactsApi,
  type AudienceDetail as AudienceDetailType,
  type AudienceMember,
  type Contact,
} from "../lib/api";

export default function AudienceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [audience, setAudience] = useState<AudienceDetailType | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const limit = 50;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await audiencesApi.get(id, { limit, offset });
      setAudience(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, offset]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemoveContact(contactId: string) {
    if (!id) return;
    if (!confirm("このコンタクトをオーディエンスから除去しますか？")) return;
    try {
      await audiencesApi.removeContact(id, contactId);
      load();
    } catch (err) {
      console.error(err);
      alert("除去に失敗しました");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!audience) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">オーディエンスが見つかりません</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate("/audiences")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        オーディエンス一覧
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{audience.name}</h1>
          {audience.description && (
            <p className="text-gray-500 mt-1">{audience.description}</p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            {audience.contactCount}件のコンタクト
          </p>
        </div>
        <button
          onClick={() => setShowAddContacts(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          コンタクト追加
        </button>
      </div>

      {audience.contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">メンバーがいません</p>
          <button
            onClick={() => setShowAddContacts(true)}
            className="text-indigo-600 hover:underline text-sm"
          >
            コンタクトを追加
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
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
                    追加日
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audience.contacts.map((member: AudienceMember) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {member.email}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {member.name || "-"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          member.isUnsubscribed
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {member.isUnsubscribed ? "配信停止" : "有効"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {new Date(member.addedAt).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleRemoveContact(member.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="除去"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
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

      {showAddContacts && (
        <AddContactsModal
          audienceId={id!}
          existingContactIds={audience.contacts.map((c: AudienceMember) => c.id)}
          onClose={() => setShowAddContacts(false)}
          onAdded={() => {
            setShowAddContacts(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddContactsModal({
  audienceId,
  existingContactIds,
  onClose,
  onAdded,
}: {
  audienceId: string;
  existingContactIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const existingSet = new Set(existingContactIds);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!search) {
        setContacts([]);
        return;
      }
      setLoading(true);
      try {
        const res = await contactsApi.list({ search, limit: 20 });
        setContacts(res.data.filter((c) => !existingSet.has(c.id)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function toggleContact(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await audiencesApi.addContacts(audienceId, [...selected]);
      onAdded();
    } catch (err) {
      console.error(err);
      alert("追加に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            コンタクト追加
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="コンタクトを検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
          {selected.size > 0 && (
            <p className="text-sm text-indigo-600 mt-2">{selected.size}件選択中</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {search ? "該当するコンタクトがありません" : "検索してコンタクトを探してください"}
            </p>
          ) : (
            <div className="space-y-1">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => toggleContact(contact.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    selected.has(contact.id)
                      ? "bg-indigo-50 border border-indigo-200"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                      selected.has(contact.id)
                        ? "bg-indigo-600 border-indigo-600"
                        : "border-gray-300"
                    }`}
                  >
                    {selected.has(contact.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {contact.email}
                    </p>
                    {contact.name && (
                      <p className="text-xs text-gray-500">{contact.name}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
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
            onClick={handleAdd}
            disabled={selected.size === 0 || saving}
            className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "追加中..." : `${selected.size}件追加`}
          </button>
        </div>
      </div>
    </div>
  );
}
