import { createHashRouter } from "react-router";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLoginPage from "./pages/AdminLoginPage";

import AuthGuard from "./components/AuthGuard";
import TimesheetPrintView from "./pages/TimesheetPrintView";
import SecurityScanner from "./pages/SecurityScanner";

export const adminRouter = createHashRouter([
  {
    path: "/",
    Component: AdminLoginPage,
  },
  {
    path: "/admin",
    element: <AuthGuard><AdminDashboard /></AuthGuard>,
  },
  {
    path: "/dashboard",
    element: <AuthGuard><AdminDashboard /></AuthGuard>,
  },
  {
    path: "/print-timesheet/:employeeId",
    element: <AuthGuard><TimesheetPrintView /></AuthGuard>,
  },
  {
    path: "/scanner",
    element: <AuthGuard><SecurityScanner /></AuthGuard>,
  },
]);
