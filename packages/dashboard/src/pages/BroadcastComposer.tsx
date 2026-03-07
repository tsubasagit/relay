import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Eye } from "lucide-react";
import {
  audiencesApi,
  templates as templatesApi,
  sendingAddressesApi,
  broadcastsApi,
  type Audience,
  type Template,
  type SendingAddress,
} from "../lib/api";

export default function BroadcastComposer() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [audiencesList, setAudiencesList] = useState<Audience[]>([]);
  const [templatesList, setTemplatesList] = useState<Template[]>([]);
  const [addressesList, setAddressesList] = useState<SendingAddress[]>([]);

  const [audienceId, setAudienceId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [fromAddressId, setFromAddressId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    Promise.all([
      audiencesApi.list(),
      templatesApi.list(),
      sendingAddressesApi.list(),
    ])
      .then(([audRes, tmplRes, addrRes]) => {
        setAudiencesList(audRes.data);
        setTemplatesList(tmplRes.data);
        setAddressesList(addrRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectedTemplate = templatesList.find((t) => t.id === templateId);
  const selectedAudience = audiencesList.find((a) => a.id === audienceId);

  // Update variables when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const newVars: Record<string, string> = {};
      for (const v of selectedTemplate.variables || []) {
        // Keep existing value if same variable
        newVars[v] = variables[v] || "";
      }
      setVariables(newVars);
    }
  }, [templateId]);

  async function handleSend() {
    if (!audienceId || !templateId || !fromAddressId) {
      setError("全ての項目を選択してください");
      return;
    }

    if (!confirm(`${selectedAudience?.contactCount || 0}件のコンタクトに配信を開始しますか？`)) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await broadcastsApi.create({
        audienceId,
        templateId,
        fromAddressId,
        variables: Object.keys(variables).length > 0 ? variables : undefined,
      });
      navigate(`/broadcasts/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "配信の開始に失敗しました");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter variables to only show non-system ones (email/name are auto-merged)
  const templateVars = (selectedTemplate?.variables || []).filter(
    (v) => v !== "email" && v !== "name"
  );

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate("/broadcasts")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        配信一覧
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">一斉配信作成</h1>

      {error && (
        <div className="p-3 mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* 1. Audience Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            1. オーディエンス選択
          </h2>
          <select
            value={audienceId}
            onChange={(e) => setAudienceId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">オーディエンスを選択...</option>
            {audiencesList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.contactCount}件)
              </option>
            ))}
          </select>
          {selectedAudience && (
            <p className="text-sm text-gray-500 mt-2">
              {selectedAudience.contactCount}件のコンタクトに送信されます
            </p>
          )}
        </div>

        {/* 2. Template Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            2. テンプレート選択
          </h2>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">テンプレートを選択...</option>
            {templatesList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.subject}
              </option>
            ))}
          </select>
          {selectedTemplate && (
            <div className="mt-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? "プレビューを閉じる" : "プレビュー"}
              </button>
              {showPreview && (
                <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">件名:</p>
                  <p className="text-sm font-medium text-gray-900 mb-3">
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

        {/* 3. Sending Address */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            3. 送信アドレス選択
          </h2>
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

        {/* 4. Template Variables */}
        {templateVars.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              4. テンプレート変数
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              ※ {"{{email}}"} と {"{{name}}"} はコンタクト情報から自動挿入されます
            </p>
            <div className="space-y-3">
              {templateVars.map((v) => (
                <div key={v}>
                  <label className="block text-sm text-gray-700 mb-1">
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

        {/* Send Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending || !audienceId || !templateId || !fromAddressId}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? "配信開始中..." : "配信開始"}
          </button>
        </div>
      </div>
    </div>
  );
}
