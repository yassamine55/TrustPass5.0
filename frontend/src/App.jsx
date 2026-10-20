import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Shell, { AdaptiveLayout } from "./components/Shell";
import { Spinner } from "./components/ui";
import RouteErrorBoundary from "./components/RouteErrorBoundary";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Passport = lazy(() => import("./pages/Passport"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Devices = lazy(() => import("./pages/Devices"));
const DeviceNew = lazy(() => import("./pages/DeviceNew"));
const Repairs = lazy(() => import("./pages/Repairs"));
const RepairNew = lazy(() => import("./pages/RepairNew"));
const RepairClaimNew = lazy(() => import("./pages/RepairClaimNew"));
const RepairVerificationRequests = lazy(() => import("./pages/RepairVerificationRequests"));
const Transfers = lazy(() => import("./pages/Transfers"));
const Parts = lazy(() => import("./pages/Parts"));
const Profile = lazy(() => import("./pages/Profile"));
const TechnicalInspections = lazy(() => import("./pages/TechnicalInspections"));
const AdminTechnicalInspections = lazy(() => import("./pages/admin/TechnicalInspections"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminCompanies = lazy(() => import("./pages/admin/Companies"));
const AdminDeviceCertificates = lazy(() => import("./pages/admin/DeviceCertificates"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Connexion" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Shell><RouteErrorBoundary>{children}</RouteErrorBoundary></Shell>;
}
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Connexion" />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}
const Adaptive = ({ children }) => <AdaptiveLayout><RouteErrorBoundary>{children}</RouteErrorBoundary></AdaptiveLayout>;

export default function App() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/passport/:passportId" element={<Adaptive><Passport /></Adaptive>} />

          <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
          <Route path="/devices" element={<Guard roles={["OWNER", "ADMIN"]}><Devices /></Guard>} />
          <Route path="/devices/new" element={<Guard roles={["OWNER"]}><DeviceNew /></Guard>} />
          <Route path="/repairs" element={<Guard roles={["REPAIRER"]}><Repairs /></Guard>} />
          <Route path="/repairs/new" element={<Guard roles={["REPAIRER"]}><RepairNew /></Guard>} />
          <Route path="/repairs/claim" element={<Guard roles={["OWNER"]}><RepairClaimNew /></Guard>} />
          <Route path="/repair-verification-requests" element={<Guard roles={["REPAIRER"]}><RepairVerificationRequests /></Guard>} />
          <Route path="/technical-inspections" element={<Guard roles={["REPAIRER"]}><TechnicalInspections /></Guard>} />
          <Route path="/transfers" element={<Guard roles={["OWNER", "BUYER"]}><Transfers /></Guard>} />
          <Route path="/parts" element={<Guard roles={["BUYER"]}><Parts /></Guard>} />
          <Route path="/profile" element={<Guard><Profile /></Guard>} />
          <Route path="/admin/users" element={<Guard roles={["ADMIN"]}><AdminUsers /></Guard>} />
          <Route path="/admin/companies" element={<Guard roles={["ADMIN"]}><AdminCompanies /></Guard>} />
          <Route path="/admin/device-certificates" element={<Guard roles={["ADMIN"]}><AdminDeviceCertificates /></Guard>} />
          <Route path="/admin/technical-inspections" element={<Guard roles={["ADMIN"]}><AdminTechnicalInspections /></Guard>} />
          <Route path="*" element={<Adaptive><NotFound /></Adaptive>} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}
