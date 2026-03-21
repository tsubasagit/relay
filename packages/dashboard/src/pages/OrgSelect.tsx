import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, ArrowRight } from "lucide-react";
import { useAuthContext } from "../components/AuthProvider";
import { orgs as orgsApi, setOrgId } from "../lib/api";

export default function OrgSelect() {
  const { orgsData, refreshOrgs, switchOrg } = useAuthContext();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSelect(orgId: string) {
    switchOrg(orgId);
    setOrgId(orgId);
    navigate("/");
  }

  async function handleCreate() {
    if (!name || !slug) return;
    setLoading(true);
    setError("");
    try {
      const res = await orgsApi.create({ name, slug });
      await refreshOrgs();
      handleSelect(res.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">
          組織を選択
        </h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          使用する組織を選択するか、新しく作成してください
        </p>

        {orgsData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-4">
            {orgsData.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelect(org.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {org.name}
                    </p>
                    <p className="text-xs text-gray-500">{org.slug}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        )}

        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新しい組織を作成
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">
              組織を作成
            </h2>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                組織名
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="AppTalentHub"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                スラッグ（URL用、英数字とハイフン）
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="apptalenthub"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={loading || !name || !slug}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "作成中..." : "作成"}
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
