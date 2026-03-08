import { useState, useEffect, useCallback } from "react";
import { auth, orgs, setOrgId, getOrgId, type User, type OrgWithRole } from "../lib/api";

export interface AuthState {
  user: User | null;
  orgsData: OrgWithRole[];
  currentOrg: OrgWithRole | null;
  loading: boolean;
  isAuthenticated: boolean;
  switchOrg: (orgId: string) => void;
  logout: () => Promise<void>;
  refreshOrgs: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [orgsData, setOrgsData] = useState<OrgWithRole[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrgWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAuth = useCallback(async () => {
    try {
      const [userRes, orgsRes] = await Promise.all([auth.me(), orgs.list()]);
      setUser(userRes.data);
      setOrgsData(orgsRes.data);

      // Restore or pick org
      const savedOrgId = getOrgId();
      const savedOrg = orgsRes.data.find((o) => o.id === savedOrgId);
      if (savedOrg) {
        setCurrentOrg(savedOrg);
      } else if (orgsRes.data.length > 0) {
        setCurrentOrg(orgsRes.data[0]);
        setOrgId(orgsRes.data[0].id);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  const switchOrg = useCallback(
    (orgId: string) => {
      const org = orgsData.find((o) => o.id === orgId);
      if (org) {
        setCurrentOrg(org);
        setOrgId(orgId);
      }
    },
    [orgsData]
  );

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
    setOrgsData([]);
    setCurrentOrg(null);
    localStorage.removeItem("relay_org_id");
    window.location.href = "/login";
  }, []);

  const refreshOrgs = useCallback(async () => {
    const res = await orgs.list();
    setOrgsData(res.data);
  }, []);

  return {
    user,
    orgsData,
    currentOrg,
    loading,
    isAuthenticated: !!user,
    switchOrg,
    logout,
    refreshOrgs,
  };
}
