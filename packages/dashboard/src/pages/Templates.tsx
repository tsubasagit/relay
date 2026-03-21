import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Trash2 } from "lucide-react";
import { templates as api, type Template } from "../lib/api";

export default function Templates() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await api.list();
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("このテンプレートを削除しますか？")) return;
    try {
      await api.delete(id);
      setItems((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
      alert("削除に失敗しました");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">テンプレート</h1>
        <Link
          to="/templates/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">テンプレートがありません</p>
          <Link
            to="/templates/new"
            className="text-indigo-600 hover:underline text-sm"
          >
            最初のテンプレートを作成
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
            >
              <Link to={`/templates/${item.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.subject}
                    </p>
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-3 ml-4">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.category === "transactional"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {item.category === "transactional"
                    ? "トランザクション"
                    : "マーケティング"}
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
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
  );
}
