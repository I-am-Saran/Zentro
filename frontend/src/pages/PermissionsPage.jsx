// src/pages/PermissionsPage.jsx (rebuilt)
import { useEffect, useState } from "react";
import { Card, CardBody, Typography, Switch, Button } from "@material-tailwind/react";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import BackButton from "../components/BackButton";
import { supabase } from "../supabaseClient";

export default function PermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [roleAccess, setRoleAccess] = useState({}); // { roleId: [moduleName] }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({}); // { roleId: boolean }
  const [modulesByName, setModulesByName] = useState({});

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data: rawRoles, error: rolesError } = await supabase
          .from("roles")
          .select("*");
        const safeRoles = rolesError ? [] : (rawRoles || []);
        const filtered = safeRoles.filter(r => ["Admin", "QA", "DEV", "User"].includes(String(r.role_name)));
        setRoles(filtered);

        const { data: rawModules, error: modulesError } = await supabase
          .from("modules")
          .select("id,module_name");
        const safeModules = modulesError ? [] : (rawModules || []);
        const idMap = {};
        const nameMap = {};
        const names = [];
        for (const m of safeModules) {
          if (m && m.id != null) {
            const name = m.module_name || m.name;
            if (name) {
              idMap[m.id] = name;
              nameMap[name] = m.id;
              names.push(name);
            }
          }
        }
        setModules(names);
        setModulesByName(nameMap);

        // fetch access per role
        const accessMap = {};
        for (const role of filtered) {
          try {
            const { data: accessRows, error: accessErr } = await supabase
              .from("role_module_access")
              .select("module_id")
              .eq("role_id", role.id);
            const ids = accessErr ? [] : (accessRows || []).map(r => r.module_id).filter(Boolean);
            accessMap[role.id] = ids.map(id => idMap[id]).filter(Boolean);
          } catch {
            accessMap[role.id] = [];
          }
        }
        setRoleAccess(accessMap);
      } catch (e) {
        console.error("Permissions init failed", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const toggleModule = async (roleId, moduleName) => {
    const current = roleAccess[roleId] || [];
    const has = current.includes(moduleName);
    const updated = has ? current.filter(n => n !== moduleName) : [...current, moduleName];
    setSaving(prev => ({ ...prev, [roleId]: true }));
    try {
      const idsToAdd = updated
        .map((name) => modulesByName[name])
        .filter((id) => id !== undefined && id !== null);

      await supabase.from("role_module_access").delete().eq("role_id", roleId);

      if (idsToAdd.length) {
        const payload = idsToAdd.map((module_id) => ({ role_id: roleId, module_id }));
        const { error: insErr } = await supabase.from("role_module_access").insert(payload);
        if (insErr) throw insErr;
      }
      setRoleAccess(prev => ({ ...prev, [roleId]: updated }));
    } catch (e) {
      console.error("Failed to update role access", e);
    } finally {
      setSaving(prev => ({ ...prev, [roleId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BackButton />
              <div className="flex items-center space-x-3">
                <ShieldCheckIcon className="h-8 w-8 text-primary" />
                <Typography variant="h3" className="text-gray-800">
                  Permissions
                </Typography>
              </div>
            </div>
            <Button variant="outlined" size="sm" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Card className="border border-gray-200">
          <CardBody className="p-6">
            <Typography variant="h5" className="text-gray-800 mb-4">
              Role → Modules Access
            </Typography>

            {loading ? (
              <div className="py-8 text-gray-600">Loading…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map((role) => {
                  const roleName = String(role.role_name);
                  const isAdmin = roleName.toLowerCase() === "admin";
                  return (
                    <Card key={role.id} className="border border-gray-200">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Typography variant="h6" className="text-gray-800">
                            {roleName}
                          </Typography>
                          {isAdmin && (
                            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">All modules</span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {modules.map((m) => {
                            const checked = isAdmin ? true : (roleAccess[role.id] || []).includes(m);
                            return (
                              <div key={`${role.id}-${m}`} className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">{m}</span>
                                <Switch
                                  checked={checked}
                                  onChange={() => toggleModule(role.id, m)}
                                  color="blue"
                                  disabled={isAdmin || saving[role.id]}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
