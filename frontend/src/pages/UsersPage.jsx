// src/pages/UsersPage.jsx
import { useState, useEffect } from "react";
import { Card, CardBody, Typography, Button, Chip, IconButton, Tooltip } from "@material-tailwind/react";
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  PlusIcon, 
  EnvelopeIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  KeyIcon
} from "@heroicons/react/24/outline";
import GlossyButton from "../components/GlossyButton";
import Toast from "../components/Toast";
import Modal from "../components/Modal";
import LoadingSpinner from "../components/LoadingSpinner";
import { post, get, put, del as delReq } from "../services/api";
// removed unused navigate
import BackButton from "../components/BackButton";

export default function UsersPage() {

  // ============================
  // View Modes
  // ============================
  const [view, setView] = useState("list"); // list | create | invite | edit

  // ============================
  // Shared States
  // ============================
  const [toast, setToast] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);

  // ============================
  // Advanced Filtering & Search
  // ============================
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    role: "",
    department: "",
    status: "",
    accountType: ""
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy] = useState("created_at");
  const [sortOrder] = useState("desc");

  // ============================
  // Pagination
  // ============================
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // ============================
  // Modal States
  // ============================
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // ============================
  // Form States
  // ============================
  const [departments] = useState(["IT", "QA", "Finance", "HR", "Marketing", "Sales", "Others"]);
  const [roles] = useState(["Admin", "QA", "DEV", "PM", "User"]);
  const [accountTypes] = useState(["Local", "SSO"]);

  // ============================
  // Create User Form
  // ============================
  const [createForm, setCreateForm] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
    role: "User",
    department: "",
    phone_number: "",
    is_active: true
  });
  const [createErrors, setCreateErrors] = useState({});
  const [creating, setCreating] = useState(false);

  // ============================
  // Edit User Form
  // ============================
  const [editForm, setEditForm] = useState({
    username: "",
    full_name: "",
    email: "",
    role: "",
    department: "",
    phone_number: "",
    is_active: true
  });
  const [editErrors, setEditErrors] = useState({});
  const [editing, setEditing] = useState(false);

  // ============================
  // Invite User Form
  // ============================
  const [inviteForm, setInviteForm] = useState({
    full_name: "",
    email: "",
    role: "User",
    department: ""
  });
  const [inviteErrors, setInviteErrors] = useState({});
  const [inviting, setInviting] = useState(false);

  // ============================
  // Data Fetching
  // ============================
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search: searchTerm,
        role: filters.role,
        department: filters.department,
        status: filters.status,
        accountType: filters.accountType,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: currentPage,
        limit: pageSize
      });

      const response = await get(`/api/users?${params}`);
      if (response && response.data) {
        setUsers(response.data);
        setTotalPages(response.pagination?.pages || 1);
        setTotalUsers(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setToast({ type: "error", message: "Failed to fetch users" });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await get("/api/users/stats");
      if (response && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [searchTerm, filters, sortBy, sortOrder, currentPage, pageSize]);

  // ============================
  // Form Validation
  // ============================
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) ? "" : "Please enter a valid email address";
  };

  const validateUsername = (username) => {
    if (!username) return "Username is required";
    if (username.length < 3) return "Username must be at least 3 characters";
    if (!/^\w+$/.test(username)) return "Username can only contain letters, numbers, and underscores";
    return "";
  };

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return "Password must contain at least one lowercase letter, one uppercase letter, and one number";
    }
    return "";
  };

  // ============================
  // Form Handlers
  // ============================
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const errors = {};

    errors.username = validateUsername(createForm.username);
    errors.email = validateEmail(createForm.email);
    errors.password = validatePassword(createForm.password);

    if (Object.values(errors).some(error => error)) {
      setCreateErrors(errors);
      return;
    }

    try {
      setCreating(true);
      const payload = {
        ...createForm,
        username: createForm.username.trim(),
        email: createForm.email.trim().toLowerCase()
      };

      const response = await post("/api/users", payload);
      if (response && response.status === "success") {
        setToast({ type: "success", message: "User created successfully" });
        setView("list");
        resetCreateForm();
        fetchUsers();
      }
    } catch (error) {
      setToast({ type: "error", message: error.message || "Failed to create user" });
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    const errors = {};

    errors.username = validateUsername(editForm.username);
    errors.email = validateEmail(editForm.email);

    if (Object.values(errors).some(error => error)) {
      setEditErrors(errors);
      return;
    }

    try {
      setEditing(true);
      const payload = {
        ...editForm,
        username: editForm.username.trim(),
        email: editForm.email.trim().toLowerCase()
      };

      const response = await put(`/api/users/${selectedUser.id}`, payload);
      if (response && response.status === "success") {
        setToast({ type: "success", message: "User updated successfully" });
        setEditModalOpen(false);
        fetchUsers();
      }
    } catch (error) {
      setToast({ type: "error", message: error.message || "Failed to update user" });
    } finally {
      setEditing(false);
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    const errors = {};

    errors.email = validateEmail(inviteForm.email);
    if (!inviteForm.full_name) errors.full_name = "Full name is required";

    if (Object.values(errors).some(error => error)) {
      setInviteErrors(errors);
      return;
    }

    try {
      setInviting(true);
      const payload = {
        ...inviteForm,
        email: inviteForm.email.trim().toLowerCase()
      };

      const response = await post("/api/invite", payload);
      if (response && response.status === "success") {
        setToast({ type: "success", message: "Invitation sent successfully" });
        setView("list");
        resetInviteForm();
      }
    } catch (error) {
      setToast({ type: "error", message: error.message || "Failed to send invitation" });
    } finally {
      setInviting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const newStatus = !user.is_active;
      const response = await post(`/api/users/${user.id}/status`, { is_active: newStatus });
      
      if (response && response.status === "success") {
        const statusText = newStatus ? "activated" : "deactivated";
        setToast({ type: "success", message: `User ${statusText} successfully` });
        fetchUsers();
      }
    } catch (error) {
      setToast({ type: "error", message: error.message || "Failed to update user status" });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await delReq(`/api/users/${selectedUser.id}`);
      if (response && response.status === "success") {
        setToast({ type: "success", message: "User deleted successfully" });
        fetchUsers();
      }
    } catch (error) {
      setToast({ type: "error", message: error.message || "Failed to delete user" });
    } finally {
      setConfirmOpen(false);
      setSelectedUser(null);
    }
  };

  // ============================
  // Utility Functions
  // ============================
  const resetCreateForm = () => {
    setCreateForm({
      username: "",
      full_name: "",
      email: "",
      password: "",
      role: "User",
      department: "",
      phone_number: "",
      is_active: true
    });
    setCreateErrors({});
  };

  const resetInviteForm = () => {
    setInviteForm({
      full_name: "",
      email: "",
      role: "User",
      department: ""
    });
    setInviteErrors({});
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      username: user.username || "",
      full_name: user.full_name || "",
      email: user.email || "",
      role: user.role || "User",
      department: user.department || "",
      phone_number: user.phone_number || "",
      is_active: user.is_active !== false
    });
    setEditModalOpen(true);
  };

  // ============================
  // Statistics Cards
  // ============================
  const renderStatsCards = () => {
    if (!stats) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Typography variant="small" className="text-blue-600 font-medium">Total Users</Typography>
                <Typography variant="h4" className="text-blue-900">{stats.total_users || 0}</Typography>
              </div>
              <UserIcon className="h-8 w-8 text-blue-500" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Typography variant="small" className="text-green-600 font-medium">Active Users</Typography>
                <Typography variant="h4" className="text-green-900">{stats.active_users || 0}</Typography>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Typography variant="small" className="text-purple-600 font-medium">SSO Users</Typography>
                <Typography variant="h4" className="text-purple-900">{stats.account_types?.sso || 0}</Typography>
              </div>
              <KeyIcon className="h-8 w-8 text-purple-500" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Typography variant="small" className="text-orange-600 font-medium">Departments</Typography>
                <Typography variant="h4" className="text-orange-900">{Object.keys(stats.department_distribution || {}).length}</Typography>
              </div>
              <BuildingOfficeIcon className="h-8 w-8 text-orange-500" />
            </div>
          </CardBody>
        </Card>
      </div>
    );
  };

  // ============================
  // Filters Section
  // ============================
  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <Card className="mb-4 bg-gray-50 border border-gray-200">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={filters.role}
                onChange={(e) => setFilters({...filters, role: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                {roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({...filters, department: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
              <select
                value={filters.accountType}
                onChange={(e) => setFilters({...filters, accountType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {accountTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="text"
                size="sm"
                onClick={() => setFilters({ role: "", department: "", status: "", accountType: "" })}
                className="text-gray-600"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };

  // ============================
  // Users Table
  // ============================
  const renderUsersTable = () => {
    if (loading) {
      return (
        <Card className="glass-panel">
          <CardBody className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </CardBody>
        </Card>
      );
    }

    return (
      <Card className="glass-panel overflow-hidden">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-primary/95 to-primaryLight/95 text-white">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Account</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-borderLight/60 odd:bg-white even:bg-[#F8FBFA] hover:bg-accent/10 transition-all duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                            {user.display_name?.charAt(0).toUpperCase() || "U"}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.display_name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Chip 
                        value={user.role} 
                        className={`text-xs ${
                          user.role === "Admin" ? "bg-red-100 text-red-800" :
                          user.role === "QA" ? "bg-blue-100 text-blue-800" :
                          user.role === "DEV" ? "bg-green-100 text-green-800" :
                          user.role === "PM" ? "bg-purple-100 text-purple-800" :
                          "bg-gray-100 text-gray-800"
                        }`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.department || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Chip 
                        value={user.is_active ? "Active" : "Inactive"}
                        className={`text-xs ${
                          user.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.account_type === "SSO" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          SSO
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Local
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.phone_number || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Tooltip content="Edit User">
                          <IconButton
                            variant="text"
                            size="sm"
                            onClick={() => openEditModal(user)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip content={user.is_active ? "Deactivate User" : "Activate User"}>
                          <IconButton
                            variant="text"
                            size="sm"
                            onClick={() => handleToggleStatus(user)}
                            className={user.is_active ? "text-green-600 hover:text-green-800" : "text-red-600 hover:text-red-800"}
                          >
                            {user.is_active ? (
                              <CheckCircleIcon className="h-4 w-4" />
                            ) : (
                              <XCircleIcon className="h-4 w-4" />
                            )}
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip content="Delete User">
                          <IconButton
                            variant="text"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setConfirmOpen(true);
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 bg-white border-t border-borderLight flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} results
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="text-gray-600"
                >
                  Previous
                </Button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "filled" : "text"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={currentPage === pageNum ? "bg-primary text-white" : "text-gray-600"}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="text-gray-600"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // ============================
  // Create User Form
  // ============================
  const renderCreateForm = () => (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <Card className="shadow-lg">
        <CardBody className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Typography variant="h5" className="text-gray-900">Create New User</Typography>
            <Button
              variant="text"
              onClick={() => setView("list")}
              className="text-gray-600 hover:text-gray-800"
            >
              Back to Users
            </Button>
          </div>

          <Toast type={toast.type} message={toast.message} />

          <form onSubmit={handleCreateUser} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username *</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                  required
                />
                {createErrors.username && (
                  <p className="mt-1 text-sm text-red-600">{createErrors.username}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({...createForm, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email address"
                  required
                />
                {createErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{createErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                  required
                />
                {createErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{createErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({...createForm, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={createForm.department}
                  onChange={(e) => setCreateForm({...createForm, department: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={createForm.phone_number}
                  onChange={(e) => setCreateForm({...createForm, phone_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createForm.is_active}
                    onChange={(e) => setCreateForm({...createForm, is_active: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outlined"
                onClick={() => setView("list")}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {creating ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );

  // ============================
  // Edit User Modal
  // ============================
  const renderEditModal = () => (
    <Modal
      open={editModalOpen}
      onClose={() => setEditModalOpen(false)}
      title="Edit User"
      size="lg"
    >
      <form onSubmit={handleEditUser} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
            <input
              type="text"
              value={editForm.username}
              onChange={(e) => setEditForm({...editForm, username: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {editErrors.username && (
              <p className="mt-1 text-sm text-red-600">{editErrors.username}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={editForm.full_name}
              onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({...editForm, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {editErrors.email && (
              <p className="mt-1 text-sm text-red-600">{editErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({...editForm, role: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={editForm.department}
              onChange={(e) => setEditForm({...editForm, department: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={editForm.phone_number}
              onChange={(e) => setEditForm({...editForm, phone_number: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={(e) => setEditForm({...editForm, is_active: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Active</span>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outlined"
            onClick={() => setEditModalOpen(false)}
            className="border-gray-300 text-gray-700"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={editing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {editing ? "Updating..." : "Update User"}
          </Button>
        </div>
      </form>
    </Modal>
  );

  // ============================
  // Delete Confirmation Modal
  // ============================
  const renderDeleteModal = () => (
    <Modal
      open={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      title="Confirm Delete"
      confirmText="Delete"
      onConfirm={handleDeleteUser}
      confirmButtonClass="bg-red-600 hover:bg-red-700"
    >
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <TrashIcon className="h-6 w-6 text-red-600" />
        </div>
        <Typography variant="h6" className="text-gray-900 mb-2">
          Delete User
        </Typography>
        <Typography className="text-gray-600 mb-4">
          Are you sure you want to delete <span className="font-semibold">{selectedUser?.display_name}</span>? 
          This action cannot be undone.
        </Typography>
      </div>
    </Modal>
  );

  // ============================
  // Main Render
  // ============================
  return (
    <div className="min-h-screen bg-gray-50">
      <Toast type={toast.type} message={toast.message} />

      {view === "list" && (
        <div className="mx-auto max-w-7xl px-6 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <BackButton />
                <Typography variant="h4" className="text-2xl font-black bg-gradient-to-r from-primary via-accent to-primaryLight bg-clip-text text-transparent">User Management</Typography>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2"
                >
                  <FunnelIcon className="h-4 w-4" />
                  Filters
                </Button>
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => setView("invite")}
                  className="flex items-center gap-2"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  Invite User
                </Button>
                <Button
                  variant="filled"
                  size="sm"
                  onClick={() => setView("create")}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create User
                </Button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search users by name or email..."
              />
            </div>
          </div>

          {/* Statistics Cards */}
          {renderStatsCards()}

          {/* Filters */}
          {renderFilters()}

          {/* Users Table */}
          {renderUsersTable()}

          {/* Modals */}
          {renderEditModal()}
          {renderDeleteModal()}
        </div>
      )}

      {view === "create" && renderCreateForm()}
      {view === "invite" && (
        <div className="mx-auto max-w-4xl px-6 py-6">
          <Card className="shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-6">
                <Typography variant="h5" className="text-gray-900">Invite User</Typography>
                <Button
                  variant="text"
                  onClick={() => setView("list")}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Back to Users
                </Button>
              </div>

              <Toast type={toast.type} message={toast.message} />

              <form onSubmit={handleInviteUser} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={inviteForm.full_name}
                      onChange={(e) => setInviteForm({...inviteForm, full_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter full name"
                      required
                    />
                    {inviteErrors.full_name && (
                      <p className="mt-1 text-sm text-red-600">{inviteErrors.full_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter email address"
                      required
                    />
                    {inviteErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{inviteErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({...inviteForm, role: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <select
                      value={inviteForm.department}
                      onChange={(e) => setInviteForm({...inviteForm, department: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <EnvelopeIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <Typography variant="small" className="text-blue-800 font-medium">
                        Invitation Process
                      </Typography>
                      <Typography variant="small" className="text-blue-700 mt-1">
                        The user will receive an email invitation with instructions to set up their account. They will be able to choose between SSO login (if configured) or create a password for local authentication.
                      </Typography>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => setView("list")}
                    className="border-gray-300 text-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {inviting ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
