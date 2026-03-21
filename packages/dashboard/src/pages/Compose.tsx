import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, Search, List } from "lucide-react";
import {
  contactsApi,
  sendingAddressesApi,
  templates as templatesApi,
  audiencesApi,
  compose,
  type Contact,
  type SendingAddress,
  type Template,
  type Audience,
} from "../lib/api";

export default function Compose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialListId = searchParams.get("listId") || "";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<SendingAddress[]>([]);
  const [templateList, setTemplateList] = useState<Template[]>([]);
  const [lists, setLists] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedListId, setSelectedListId] = useState(initialListId);
  const [fromAddressId, setFromAddressId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      contactsApi.list({ limit: 500 }),
      sendingAddressesApi.list(),
      templatesApi.list(),
      audiencesApi.list(),
    ])
      .then(([c, a, t, l]) => {
        setContacts(c.data);
        setAddresses(a.data);
        setTemplateList(t.data);
        setLists(l.data);
        if (a.data.length > 0) setFromAddressId(a.data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // initialListId が設定されている場合、データロード後にリスト選択を実行
  useEffect(() => {
    if (initialListId && lists.length > 0 && contacts.length > 0) {
      handleListSelect(initialListId);
    }
  }, [initialListId, lists.length, contacts.length]);

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.email.toLowerCase().includes(q) ||
      (c.name && c.name.toLowerCase().includes(q))
    );
  });

  const toggleContact = useCallback((id: string) => {
    setSelectedListId(""); // 手動変更したらリスト選択を解除
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedListId("");
    setSelectedContactIds(new Set(filteredContacts.map((c) => c.id)));
  }, [filteredContacts]);

  const deselectAll = useCallback(() => {
    setSelectedListId("");
    setSelectedContactIds(new Set());
  }, []);

  const handleListSelect = useCallback(
    async (listId: string) => {
      setSelectedListId(listId);
      if (!listId) {
        setSelectedContactIds(new Set());
        return;
      }

      // リストのメンバーを取得して自動選択
      setListLoading(true);
      try {
        const res = await audiencesApi.get(listId, { limit: 500 });
        const memberEmails = new Set(res.data.contacts.map((m) => m.email));
        const matchingIds = contacts
          .filter((c) => memberEmails.has(c.email) && !c.isUnsubscribed)
          .map((c) => c.id);
        setSelectedContactIds(new Set(matchingIds));
      } catch (err) {
        console.error(err);
      } finally {
        setListLoading(false);
      }
    },
    [contacts]
  );

  const onTemplateSelect = useCallback(
    (tmplId: string) => {
      setSelectedTemplateId(tmplId);
      if (tmplId) {
        const tmpl = templateList.find((t) => t.id === tmplId);
        if (tmpl) {
          setSubject(tmpl.subject);
          setBodyHtml(tmpl.bodyHtml);
        }
      }
    },
    [templateList]
  );

  const handleSend = async () => {
    setError("");
    setSuccess("");

    if (selectedContactIds.size === 0) {
      setError("宛先を選択してください");
      return;
    }
    if (!subject.trim()) {
      setError("件名を入力してください");
      return;
    }
    if (!bodyHtml.trim()) {
      setError("本文を入力してください");
      return;
    }

    setSending(true);
    try {
      const res = await compose.send({
        contactIds: Array.from(selectedContactIds),
        fromAddressId: fromAddressId || undefined,
        templateId: selectedTemplateId || undefined,
        subject: selectedTemplateId ? undefined : subject,
        bodyHtml: selectedTemplateId ? undefined : bodyHtml,
      });
      const msg = `${res.data.totalCount}件のメールを送信開始しました（${res.data.subject}）`;
      setSuccess(msg);
      navigate(`/broadcasts/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">メール作成</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* 宛先選択 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            宛先（{selectedContactIds.size}件選択中）
          </label>

          {/* リストから選択 */}
          {lists.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <List className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">リストから選択</span>
              </div>
              <select
                value={selectedListId}
                onChange={(e) => handleListSelect(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">リストを選択...</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}（{l.contactCount}件）
                  </option>
                ))}
              </select>
              {listLoading && (
                <p className="text-xs text-indigo-600 mt-1">メンバーを読み込み中...</p>
              )}
            </div>
          )}

          {/* 区切り線 */}
          {lists.length > 0 && (
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs text-gray-400">または個別に選択</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="コンタクトを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              onClick={selectAll}
              className="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
            >
              全選択
            </button>
            <button
              onClick={deselectAll}
              className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
            >
              全解除
            </button>
          </div>

          {contacts.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              コンタクトがありません。先に
              <a href="/contacts" className="text-indigo-600 hover:underline mx-1">
                コンタクト
              </a>
              を追加してください。
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
              {filteredContacts.map((contact) => {
                const selected = selectedContactIds.has(contact.id);
                return (
                  <label
                    key={contact.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selected ? "bg-indigo-50" : ""
                    } ${contact.isUnsubscribed ? "opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={contact.isUnsubscribed}
                      onChange={() => toggleContact(contact.id)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {contact.name || contact.email}
                      </p>
                      {contact.name && (
                        <p className="text-xs text-gray-500 truncate">
                          {contact.email}
                        </p>
                      )}
                    </div>
                    {contact.isUnsubscribed && (
                      <span className="text-xs text-red-500">配信停止</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* 差出人 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            差出人
          </label>
          {addresses.length <= 1 ? (
            <p className="text-sm text-gray-900">
              {addresses[0]?.displayName
                ? `${addresses[0].displayName} <${addresses[0].address}>`
                : addresses[0]?.address || "送信アドレス未設定"}
            </p>
          ) : (
            <select
              value={fromAddressId}
              onChange={(e) => setFromAddressId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {addresses.map((addr) => (
                <option key={addr.id} value={addr.id}>
                  {addr.displayName
                    ? `${addr.displayName} <${addr.address}>`
                    : addr.address}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* テンプレート選択 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            テンプレート
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => onTemplateSelect(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">直接入力</option>
            {templateList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* 件名・本文 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              件名
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="メールの件名"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              本文（HTML）
            </label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="メール本文を入力してください&#10;&#10;変数を使う場合: {{name}} {{company}} など"
              rows={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* アクション */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            キャンセル
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selectedContactIds.size === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? "送信中..." : `送信（${selectedContactIds.size}件）`}
          </button>
        </div>
      </div>
    </div>
  );
}
