import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Send,
  BarChart3,
  Mail,
  X,
  Globe,
  Server,
  AtSign,
  Building2,
  Key,
  Users,
  Users2,
  Radio,
  Webhook,
  PenSquare,
  History,
  List,
} from "lucide-react";
import { useAuthContext } from "./AuthProvider";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
}

// Free プラン: シンプルなナビ
const freeNavItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "ホーム", end: true },
  { to: "/contacts", icon: Users, label: "コンタクト" },
  { to: "/lists", icon: List, label: "リスト" },
  { to: "/compose", icon: PenSquare, label: "メール作成" },
  { to: "/broadcasts", icon: History, label: "配信履歴" },
];

// Pro プラン: 全ナビ項目
const proNavItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "ダッシュボード", end: true },
  { to: "/contacts", icon: Users, label: "コンタクト" },
  { to: "/compose", icon: PenSquare, label: "メール作成" },
  { to: "/audiences", icon: Users2, label: "オーディエンス" },
  { to: "/broadcasts", icon: Radio, label: "一斉配信" },
  { to: "/templates", icon: FileText, label: "テンプレート" },
  { to: "/logs", icon: Send, label: "配信ログ" },
  { to: "/analytics", icon: BarChart3, label: "分析" },
];

const freeSettingsItems: NavItem[] = [
  { to: "/settings/org", icon: Building2, label: "組織設定" },
  { to: "/settings/addresses", icon: AtSign, label: "送信アドレス" },
  { to: "/settings/providers", icon: Server, label: "プロバイダー" },
];

const proSettingsItems: NavItem[] = [
  { to: "/settings/org", icon: Building2, label: "組織設定" },
  { to: "/settings/domains", icon: Globe, label: "ドメイン" },
  { to: "/settings/addresses", icon: AtSign, label: "送信アドレス" },
  { to: "/settings/providers", icon: Server, label: "プロバイダー" },
  { to: "/settings/keys", icon: Key, label: "APIキー" },
  { to: "/settings/webhooks", icon: Webhook, label: "Webhook" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { currentOrg } = useAuthContext();
  const plan = currentOrg?.plan || "free";
  const isPro = plan !== "free";

  const navItems = isPro ? proNavItems : freeNavItems;
  const settingsItems = isPro ? proSettingsItems : freeSettingsItems;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Relay</h1>
              <p className="text-xs text-gray-400">
                {isPro ? "メール配信管理" : "Gmailから始めるメール一斉配信"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white font-medium"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}

          {settingsItems.length > 0 && (
            <>
              <div className="pt-4 pb-2 px-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  設定
                </p>
              </div>

              {settingsItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-indigo-600 text-white font-medium"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">v0.3.0 {isPro ? "Pro" : "Free"}</p>
        </div>
      </aside>
    </>
  );
}
