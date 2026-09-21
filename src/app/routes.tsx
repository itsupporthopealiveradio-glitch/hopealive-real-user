import { createHashRouter } from "react-router";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import SecurityVerification from "./pages/SecurityVerification";
import ClockConfirmation from "./pages/ClockConfirmation";
import ActiveClock from "./pages/ActiveClock";
import AttendanceDashboard from "./pages/AttendanceDashboard";
import FaceOnboarding from "./pages/FaceOnboarding";
import SecurityDashboard from "./pages/SecurityDashboard";
import GuestInvitePage from "./pages/GuestInvitePage";
import TimesheetPrintView from "./pages/TimesheetPrintView";

import AuthGuard from "./components/AuthGuard";

export const router = createHashRouter([
  {
    path: "/",
    Component: LoginPage,
  },
  {
    path: "/dashboard",
    element: <AuthGuard><Dashboard /></AuthGuard>,
  },
  {
    path: "/verify",
    element: <AuthGuard><SecurityVerification /></AuthGuard>,
  },
  {
    path: "/face-onboarding",
    element: <AuthGuard><FaceOnboarding /></AuthGuard>,
  },
  {
    path: "/confirmation",
    element: <AuthGuard><ClockConfirmation /></AuthGuard>,
  },
  {
    path: "/active-clock",
    element: <AuthGuard><ActiveClock /></AuthGuard>,
  },
  {
    path: "/attendance",
    element: <AuthGuard><AttendanceDashboard /></AuthGuard>,
  },
  {
    path: "/security",
    element: <AuthGuard><SecurityDashboard /></AuthGuard>,
  },
  {
    path: "/invite/:token",
    Component: GuestInvitePage,
  },
  {
    path: "/print-timesheet/:employeeId",
    element: <AuthGuard><TimesheetPrintView /></AuthGuard>,
  },
]);
