// src/components/PermissionsManager.jsx
import { useState } from "react";
import {
  Card,
  CardBody,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  TabPanel,
  TabsHeader,
  TabsBody,
  Switch,
  Input,
  Select,
  Option
} from "@material-tailwind/react";
import {
  ShieldCheckIcon,
  KeyIcon,
  UserGroupIcon,
  CogIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";
import GlossyButton from "./GlossyButton";
import Toast from "./Toast";
import Modal from "./Modal";
import LoadingSpinner from "./LoadingSpinner";
import { usePermissionsApi } from "../hooks/usePermissionsApi";
import { getPermissionColor } from "../utils/permissionUtils";

export default function PermissionsManager() {
  const [activeTab, setActiveTab] = useState("roles-access");
  
  // UI states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedModule, setSelectedModule] = useState("all");
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  
  
  // Form states
  const [newPermission, setNewPermission] = useState({
    permission_name: "",
    permission_code: "",
    description: "",
    module: "",
    action: "",
    resource: ""
  });

  const { permissions, roles, permissionsByModule, rolePermissions, roleModuleAccess, modules, loading, toast, 
    fetchRolePermissions, fetchRoleModuleAccess, createPermission, toggleRolePermission, toggleRoleModuleAccess, setToast } = usePermissionsApi();

  const fallbackModules = ["Users", "Bugs", "Reports", "Projects", "Settings", "Analytics", "System", "Other"];
  const actions = ["create", "read", "update", "delete", "manage", "view", "export", "import", "assign", "review"];

  const handleCreatePermission = async () => {
    if (!newPermission.permission_name || !newPermission.permission_code || !newPermission.module || !newPermission.action) {
      setToast({ type: "error", message: "Please fill in all required fields" });
      return;
    }
    const success = await createPermission(newPermission);
    if (success) {
      setPermissionModalOpen(false);
      setNewPermission({
        permission_name: "",
        permission_code: "",
        description: "",
        module: "",
        action: "",
        resource: ""
      });
    }
  };

  const handleToggleRolePermission = async (roleId, permissionId, currentStatus) => {
    await toggleRolePermission(roleId, permissionId, currentStatus);
  };

  const handleToggleModulePermissions = async (roleId, moduleName, currentStatus) => {
    const permissionsInModule = permissionsByModule[moduleName];
    if (!permissionsInModule) return;

    for (const permission of permissionsInModule) {
      const isAssigned = rolePermissions[roleId]?.[moduleName]?.some(
        rp => rp.permission.id === permission.id
      );
      if (currentStatus && isAssigned) {
        // If module switch is ON and permission is already assigned, do nothing
        continue;
      } else if (!currentStatus && !isAssigned) {
        // If module switch is OFF and permission is already unassigned, do nothing
        continue;
      } else {
        // Toggle permission if it's not in the desired state
        await toggleRolePermission(roleId, permission.id, isAssigned);
      }
    }

    // Refresh role permissions to update individual switches
    fetchRolePermissions(roleId);
  };



  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = !searchTerm || 
      permission.permission_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.permission_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModule = selectedModule === "all" || permission.module === selectedModule;
    
    return matchesSearch && matchesModule;
  });

  return (
    <div className="p-6 space-y-6">
      {loading && <LoadingSpinner />}
      <Toast 
        type={toast.type} 
        message={toast.message} 
        onClose={() => setToast({ type: "", message: "" })} 
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ShieldCheckIcon className="h-8 w-8 text-primary" />
          <Typography variant="h4" className="text-gray-800">
            Roles & Permissions
          </Typography>
        </div>
        <div className="flex items-center space-x-3">
          <GlossyButton
            variant="gradient"
            size="sm"
            onClick={() => setPermissionModalOpen(true)}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Permission
          </GlossyButton>
        </div>
      </div>

      {/* Tabs */}
      <Card className="border border-gray-200 shadow-sm">
        <CardBody className="p-0">
          <Tabs value={activeTab} className="overflow-visible">
            <TabsHeader>
              <Tab 
                value="roles" 
                onClick={() => setActiveTab("roles")}
                className="flex items-center space-x-2"
              >
                <UserGroupIcon className="h-5 w-5" />
                <span>Role Permissions</span>
              </Tab>
              <Tab 
                value="permissions" 
                onClick={() => setActiveTab("permissions")}
                className="flex items-center space-x-2"
              >
                <KeyIcon className="h-5 w-5" />
                <span>All Permissions</span>
              </Tab>
              <Tab 
                value="roles-access" 
                onClick={() => setActiveTab("roles-access")}
                className="flex items-center space-x-2"
              >
                <CogIcon className="h-5 w-5" />
                <span>Roles Access</span>
              </Tab>
            </TabsHeader>
            <TabsBody>
              <TabPanel value="roles" className="p-6">
                <div className="space-y-6">
                {/* Role Selection */}
                <div className="flex items-center space-x-4">
                  <Typography variant="h6" className="text-gray-700">
                    Select Role:
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                      {roles
                      .filter(role => ["Admin", "DEV", "Developer", "QA", "User"].includes(role.role_name))
                      .map(role => (
                        <Button
                          key={role.id}
                          size="sm"
                          variant={selectedRole?.id === role.id ? "filled" : "outlined"}
                          color={selectedRole?.id === role.id ? "blue" : "gray"}
                          onClick={() => {
                            setSelectedRole(role);
                            fetchRolePermissions(role.id);
                            fetchRoleModuleAccess(role.id);
                          }}
                          className="flex items-center space-x-2"
                        >
                          <span>{role.role_name}</span>
                          <Chip 
                            value={rolePermissions[role.id] ? 
                              Object.values(rolePermissions[role.id]).flat().length : 0} 
                            size="sm" 
                            className="bg-white bg-opacity-20"
                          />
                        </Button>
                      ))}
                  </div>
                </div>

                {/* Role Permissions Grid */}
                {selectedRole && (
                  <div className="space-y-4">
                    {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
                      <Card key={module} className="border border-gray-200">
                        <CardBody className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                              <Typography variant="h6" className="text-gray-800">
                                {module}
                              </Typography>
                              <Chip 
                                value={module} 
                                className={`${getPermissionColor(module)} font-medium`}
                                size="sm"
                              />
                            </div>
                            <Switch
                              checked={
                                selectedRole && modulePermissions.every(permission =>
                                  rolePermissions[selectedRole.id]?.[module]?.some(
                                    rp => rp.permission.id === permission.id
                                  )
                                )
                              }
                              onChange={() => handleToggleModulePermissions(selectedRole.id, module, 
                                selectedRole && modulePermissions.every(permission =>
                                  rolePermissions[selectedRole.id]?.[module]?.some(
                                    rp => rp.permission.id === permission.id
                                  )
                                )
                              )}
                              color="blue"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {modulePermissions.map(permission => {
                              const isAssigned = rolePermissions[selectedRole.id]?.[module]?.some(
                                rp => rp.permission.id === permission.id
                              );
                              
                              return (
                                <div 
                                  key={permission.id}
                                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                  <div className="flex-1">
                                    <Typography variant="small" className="font-medium text-gray-800">
                                      {permission.permission_name}
                                    </Typography>
                                    <Typography variant="small" className="text-gray-500">
                                      {permission.permission_code}
                                    </Typography>
                                  </div>
                                  <Switch
                                    checked={isAssigned}
                                    onChange={() => handleToggleRolePermission(
                                      selectedRole.id, 
                                      permission.id, 
                                      isAssigned
                                    )}
                                    color="blue"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
              </TabPanel>
              <TabPanel value="permissions" className="p-6">
                <div className="space-y-6">
                {/* Search and Filter */}
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search permissions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={selectedModule}
                    onChange={(value) => setSelectedModule(value)}
                    className="w-40"
                  >
                    <Option value="all">All Modules</Option>
                    {modules.map(module => (
                      <Option key={module} value={module}>{module}</Option>
                    ))}
                  </Select>
                </div>

                {/* Permissions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPermissions.map(permission => (
                    <Card key={permission.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                      <CardBody className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <Typography variant="h6" className="text-gray-800 mb-1">
                              {permission.permission_name}
                            </Typography>
                            <Typography variant="small" className="text-gray-500 font-mono">
                              {permission.permission_code}
                            </Typography>
                          </div>
                          <Chip 
                            value={permission.module} 
                            className={`${getPermissionColor(permission.module)} font-medium`}
                            size="sm"
                          />
                        </div>
                        
                        {permission.description && (
                          <Typography variant="small" className="text-gray-600 mb-3">
                            {permission.description}
                          </Typography>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Action: {permission.action}</span>
                          {permission.resource && <span>Resource: {permission.resource}</span>}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
              </TabPanel>
              <TabPanel value="roles-access" className="p-6">
                <div className="space-y-6">
                  <Typography variant="h5" className="text-gray-800 mb-4">
                    Manage Module Access by Role
                  </Typography>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {roles
                      .filter(role => ["Admin", "DEV", "Developer", "QA", "User"].includes(role.role_name))
                      .map(role => (
                        <Card key={role.id} className="border border-gray-200">
                          <CardBody className="p-4">
                            <Typography variant="h6" className="text-gray-800 mb-3">
                              {role.role_name}
                            </Typography>
                            <div className="space-y-2">
                              {(modules && modules.length ? modules : fallbackModules).map(module => (
                                <div key={module} className="flex items-center justify-between">
                                  <Typography variant="small" className="text-gray-700">
                                    {module}
                                  </Typography>
                                  <Switch
                                    checked={roleModuleAccess[role.id]?.includes(module)}
                                    onChange={() => toggleRoleModuleAccess(role.id, module, roleModuleAccess[role.id]?.includes(module))}
                                    color="blue"
                                  />
                                </div>
                              ))}
                            </div>
                          </CardBody>
                        </Card>
                      ))}
                  </div>
                </div>
              </TabPanel>
            </TabsBody>
          </Tabs>
        </CardBody>
      </Card>

      {/* Permission Creation Modal */}
      <Modal
        open={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
        title="Create New Permission"
        onConfirm={handleCreatePermission}
        confirmText="Create Permission"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Permission Name *
            </label>
            <Input
              value={newPermission.permission_name}
              onChange={(e) => setNewPermission({...newPermission, permission_name: e.target.value})}
              placeholder="e.g., Create User"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Permission Code *
            </label>
            <Input
              value={newPermission.permission_code}
              onChange={(e) => setNewPermission({...newPermission, permission_code: e.target.value})}
              placeholder="e.g., users.create"
              className="font-mono"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Module *
            </label>
            <Select
              value={newPermission.module}
              onChange={(value) => setNewPermission({...newPermission, module: value})}
            >
              {modules.map(module => (
                <Option key={module} value={module}>{module}</Option>
              ))}
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action *
            </label>
            <Select
              value={newPermission.action}
              onChange={(value) => setNewPermission({...newPermission, action: value})}
            >
              {actions.map(action => (
                <Option key={action} value={action}>{action}</Option>
              ))}
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resource
            </label>
            <Input
              value={newPermission.resource}
              onChange={(e) => setNewPermission({...newPermission, resource: e.target.value})}
              placeholder="e.g., user, project, bug (optional)"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={newPermission.description}
              onChange={(e) => setNewPermission({...newPermission, description: e.target.value})}
              placeholder="Describe what this permission allows..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6"></div>
      </Modal>
    </div>
  );
}
