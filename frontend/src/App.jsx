// ✅ src/App.jsx
import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import BugsPage from "./pages/BugsPage";
import { TasksList, TaskDetails, TaskForm } from "./pages/Task";
import UsersPage from "./pages/UsersPage";
import PermissionsPage from "./pages/PermissionsPage";
import Settings from "./pages/Settings";
import MainLayout from "./layouts/MainLayout";
import Transtracker from './pages/Transtracker';
import TestingRequests from './pages/TestingRequests';
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import { AuthProvider } from "./hooks/useAuth";
import AgentPage from "./pages/AgentPage";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* -------------------- AUTH -------------------- */}
        <Route path="/login" element={<Login />} />

        {/* -------------------- DASHBOARD -------------------- */}
        <Route
          path="/"
          element={
            <ProtectedRoute moduleName="Dashboard">
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* -------------------- BUGS MODULE -------------------- */}
        <Route
          path="/bugs"
          element={
            <ProtectedRoute moduleName="Bugs">
              <MainLayout>
                <BugsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* -------------------- TASKS MODULE -------------------- */}
        <Route
          path="/tasks"
          element={
            <ProtectedRoute moduleName="Tasks">
              <MainLayout>
                <TasksList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks/new"
          element={
            <ProtectedRoute moduleName="Tasks">
              <MainLayout>
                <TaskForm />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks/:id"
          element={
            <ProtectedRoute moduleName="Tasks">
              <MainLayout>
                <TaskDetails />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* -------------------- USERS -------------------- */}
        <Route
          path="/users"
          element={
            <ProtectedRoute moduleName="Users">
              <MainLayout>
                <UsersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* -------------------- PERMISSIONS -------------------- */}
        <Route
          path="/permissions"
          element={
            <ProtectedRoute moduleName="Permissions">
              <MainLayout>
                <PermissionsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* -------------------- SETTINGS -------------------- */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute moduleName="Settings">
              <MainLayout>
                <Settings />
              </MainLayout>
            </ProtectedRoute>
          }
        />



        {/* -------------------- TRANSTRACKER -------------------- */}
        <Route
          path="/transtracker"
          element={
            <ProtectedRoute moduleName="Transtracker">
              <MainLayout>
                <Transtracker />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* -------------------- TESTING REQUESTS -------------------- */}
        <Route
          path="/testing-requests"
          element={
            <ProtectedRoute moduleName="Testing Request">
              <MainLayout>
                <TestingRequests />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* -------------------- AGENT MODULE -------------------- */}
        <Route
          path="/agent"
          element={
            <ProtectedRoute moduleName="AI Agent">
              <MainLayout>
                <AgentPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* -------------------- FALLBACK -------------------- */}
        <Route
          path="*"
          element={
            <MainLayout>
              <Dashboard />
            </MainLayout>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
