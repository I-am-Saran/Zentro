// src/pages/PermissionsPage.jsx
import { useState, useEffect } from "react";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import { ShieldCheckIcon, KeyIcon, UserGroupIcon, CogIcon } from "@heroicons/react/24/outline";
import PermissionsManager from "../components/PermissionsManager";
import BackButton from "../components/BackButton";
import GlossyButton from "../components/GlossyButton";
import { get } from "../services/api";

export default function PermissionsPage() {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await get("/api/permissions/dashboard");
      if (response && response.status === "success") {
        setDashboardStats(response);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BackButton />
              <div className="flex items-center space-x-3">
                <ShieldCheckIcon className="h-8 w-8 text-primary" />
                <Typography variant="h3" className="text-gray-800">
                  Roles & Permissions Management
                </Typography>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <GlossyButton
                variant="outlined"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <CogIcon className="h-4 w-4 mr-2" />
                Refresh
              </GlossyButton>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Stats */}
      {!loading && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Typography variant="small" className="text-blue-600 font-medium">
                      Total Permissions
                    </Typography>
                    <Typography variant="h4" className="text-blue-800 mt-1">
                      {dashboardStats?.statistics?.total_permissions || 0}
                    </Typography>
                  </div>
                  <KeyIcon className="h-10 w-10 text-blue-500" />
                </div>
              </CardBody>
            </Card>

            <Card className="border border-gray-200 bg-gradient-to-br from-green-50 to-green-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Typography variant="small" className="text-green-600 font-medium">
                      Total Roles
                    </Typography>
                    <Typography variant="h4" className="text-green-800 mt-1">
                      {dashboardStats?.statistics?.total_roles || 0}
                    </Typography>
                  </div>
                  <UserGroupIcon className="h-10 w-10 text-green-500" />
                </div>
              </CardBody>
            </Card>

            <Card className="border border-gray-200 bg-gradient-to-br from-purple-50 to-purple-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Typography variant="small" className="text-purple-600 font-medium">
                      Permission Modules
                    </Typography>
                    <Typography variant="h4" className="text-purple-800 mt-1">
                      {dashboardStats?.statistics?.permissions_by_module?.length || 0}
                    </Typography>
                  </div>
                  <ShieldCheckIcon className="h-10 w-10 text-purple-500" />
                </div>
              </CardBody>
            </Card>

            <Card className="border border-gray-200 bg-gradient-to-br from-orange-50 to-orange-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Typography variant="small" className="text-orange-600 font-medium">
                      Role Assignments
                    </Typography>
                    <Typography variant="h4" className="text-orange-800 mt-1">
                      {dashboardStats?.statistics?.role_permission_counts?.reduce(
                        (sum, role) => sum + parseInt(role.count || 0), 
                        0
                      ) || 0}
                    </Typography>
                  </div>
                  <CogIcon className="h-10 w-10 text-orange-500" />
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Recent Activity */}
          {dashboardStats?.recent_assignments && dashboardStats.recent_assignments.length > 0 && (
            <Card className="border border-gray-200 mb-8">
              <CardBody className="p-6">
                <Typography variant="h6" className="text-gray-800 mb-4">
                  Recent Permission Assignments
                </Typography>
                <div className="space-y-3">
                  {dashboardStats.recent_assignments.map((assignment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <Typography variant="small" className="font-medium text-gray-800">
                            {assignment.permissions?.permission_name}
                          </Typography>
                          <Typography variant="small" className="text-gray-500">
                            Assigned to {assignment.roles?.role_name}
                          </Typography>
                        </div>
                      </div>
                      <Typography variant="small" className="text-gray-400">
                        {new Date(assignment.granted_at).toLocaleDateString()}
                      </Typography>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Main Permissions Manager */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <PermissionsManager />
      </div>
    </div>
  );
}
