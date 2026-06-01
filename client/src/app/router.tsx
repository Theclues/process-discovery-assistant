import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { useSession } from "./SessionContext";
import Login from "../pages/Login";
import EngagementHub from "../pages/EngagementHub";
import EmployeePortal from "../pages/EmployeePortal";
import Workspace from "../pages/Workspace";
import OrgOverview from "../pages/OrgOverview";

/** Redirect to the right home based on role. */
function RoleHome() {
  const { identity } = useSession();
  if (!identity) return <Navigate to="/login" replace />;
  if (identity.role === "employee") return <Navigate to="/portal" replace />;
  if (identity.role === "admin") return <Navigate to="/overview" replace />;
  return <Navigate to="/engagements" replace />;
}

/** Guard: requires an authenticated identity (optionally a specific role set). */
function Protected({ roles }: { roles?: ("consultant" | "admin" | "employee")[] }) {
  const { identity } = useSession();
  if (!identity) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(identity.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/", element: <RoleHome /> },
  {
    element: <Protected roles={["consultant"]} />,
    children: [
      { path: "/engagements", element: <EngagementHub /> },
      { path: "/engagements/:engagementId", element: <Workspace /> },
      { path: "/engagements/:engagementId/:view", element: <Workspace /> },
    ],
  },
  {
    element: <Protected roles={["admin"]} />,
    children: [
      { path: "/overview", element: <OrgOverview /> },
      { path: "/overview/:view", element: <OrgOverview /> },
    ],
  },
  {
    element: <Protected roles={["employee"]} />,
    children: [{ path: "/portal", element: <EmployeePortal /> }],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
