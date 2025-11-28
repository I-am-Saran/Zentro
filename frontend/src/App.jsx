// ✅ src/App.jsx
import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import BugsPage from "./pages/BugsPage";
import TasksList from "./pages/TasksList";
import TaskDetails from "./pages/TaskDetails";
import TaskForm from "./pages/TaskForm";
import UsersPage from "./pages/UsersPage";
import Settings from "./pages/Settings";
import MainLayout from "./layouts/MainLayout";
import Transtracker from './pages/Transtracker';
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import { AuthProvider } from "./hooks/useAuth";

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
            <ProtectedRoute>
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
          <ProtectedRoute>
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
          <ProtectedRoute>
            <MainLayout>
              <TasksList />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/new"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TaskForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/:id"
        element={
          <ProtectedRoute>
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
          <ProtectedRoute>
            <MainLayout>
              <UsersPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* -------------------- SETTINGS -------------------- */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
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
          <ProtectedRoute>
            <MainLayout>
              <Transtracker />
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
