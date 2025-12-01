import { useState, useEffect, useCallback } from "react";
import { get, post, del } from "../services/api";

export const usePermissionsApi = () => {
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionsByModule, setPermissionsByModule] = useState({});
  const [rolePermissions, setRolePermissions] = useState({});
  const [roleModuleAccess, setRoleModuleAccess] = useState({});
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ type: "", message: "" });

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: "", message: "" }), 3000);
  }, []);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await get("/api/permissions");
      if (response && response.status === "success") {
        setPermissions(response.data);
        setPermissionsByModule(response.grouped || {});
      } else {
        throw new Error(response?.message || "Failed to fetch permissions");
      }
    } catch (err) {
      setError(err);
      showToast("error", "Failed to fetch permissions");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await get("/api/roles");
      const list = Array.isArray(response) ? response : (response?.data || []);
      setRoles(list || []);
    } catch (err) {
      setError(err);
      showToast("error", "Failed to fetch roles");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchRolePermissions = useCallback(async (roleId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await get(`/api/roles/${roleId}/permissions`);
      if (response && response.status === "success") {
        setRolePermissions(prev => ({
          ...prev,
          [roleId]: response.grouped_permissions || {}
        }));
      } else {
        throw new Error(response?.message || "Failed to fetch role permissions");
      }
    } catch (err) {
      setError(err);
      showToast("error", "Failed to fetch role permissions");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchRoleModuleAccess = useCallback(async (roleId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await get(`/api/roles/${roleId}/modules`);
      const list = Array.isArray(response) ? response : (response?.data || []);
      setRoleModuleAccess(prev => ({
        ...prev,
        [roleId]: list || []
      }));
    } catch (err) {
      setError(err);
      showToast("error", "Failed to fetch role module access");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const createPermission = useCallback(async (permissionData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await post("/api/permissions", permissionData);
      if (response && response.status === "success") {
        showToast("success", "Permission created successfully");
        fetchPermissions(); // Refresh permissions list
        return true;
      } else {
        throw new Error(response?.message || "Failed to create permission");
      }
    } catch (err) {
      setError(err);
      showToast("error", err.message || "Failed to create permission");
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPermissions, showToast]);

  const toggleRolePermission = useCallback(async (roleId, permissionId, currentStatus) => {
    setLoading(true);
    setError(null);
    try {
      if (currentStatus) {
        await del(`/api/roles/${roleId}/permissions/${permissionId}`);
        showToast("success", "Permission removed from role");
      } else {
        await post(`/api/roles/${roleId}/permissions`, {
          permission_id: permissionId,
          is_active: true
        });
        showToast("success", "Permission added to role");
      }
      fetchRolePermissions(roleId); // Refresh role permissions
      return true;
    } catch (err) {
      setError(err);
      showToast("error", "Failed to update role permission");
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchRolePermissions, showToast]);

  const toggleRoleModuleAccess = useCallback(async (roleId, moduleName, currentStatus) => {
    setLoading(true);
    setError(null);
    try {
      const currentModules = roleModuleAccess[roleId] || [];
      let updatedModules;

      if (currentStatus) {
        // If currently has access, remove it
        updatedModules = currentModules.filter(name => name !== moduleName);
      } else {
        // If currently doesn't have access, add it
        updatedModules = [...currentModules, moduleName];
      }

      const response = await post(`/api/roles/${roleId}/modules`, updatedModules);
      if (response && response.status === "success") {
        showToast("success", `Module '${moduleName}' access updated for role`);
        fetchRoleModuleAccess(roleId); // Refresh module access for the role
        return true;
      } else {
        throw new Error(response?.message || "Failed to update role module access");
      }
    } catch (err) {
      setError(err);
      showToast("error", `Failed to update module access for '${moduleName}'`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchRoleModuleAccess, roleModuleAccess, showToast]);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await get("/api/modules");
      const raw = Array.isArray(response) ? response : (response?.data || []);
      const names = raw.map(m => (typeof m === "string" ? m : (m.module_name || m.name))).filter(Boolean);
      setModules(names);
    } catch (err) {
      setError(err);
      showToast("error", "Failed to fetch modules");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPermissions();
    fetchRoles();
    fetchModules();
  }, [fetchPermissions, fetchRoles, fetchModules]);

  return {
    permissions,
    roles,
    permissionsByModule,
    rolePermissions,
    roleModuleAccess,
    modules,
    loading,
    error,
    toast,
    fetchPermissions,
    fetchRoles,
    fetchRolePermissions,
    fetchRoleModuleAccess,
    fetchModules,
    createPermission,
    toggleRolePermission,
    toggleRoleModuleAccess,
    setToast // Allow component to clear toast
  };
};
