import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route , Outlet, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import UserLogin from "./pages/auth/UserLogin";
import UserRegister from "./pages/auth/UserRegister";
import AdminLogin from "./pages/auth/AdminLogin";
import AdminRegister from "./pages/auth/AdminRegister";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import UserDashboard from "./pages/user/Dashboard";
import UserBookings from "./pages/user/Bookings";
import MyVehicles from './pages/user/MyVehicles';
import SlotSelectionPage from "@/pages/user/SlotSelection";
import PaymentPage from "@/pages/user/Payment"
import TicketPage from "@/pages/user/TicketPage"
import TransactionsPage from "@/pages/user/TransactionsPage"
import SetupProfile from "@/pages/user/SetupProfile";
import DashboardLayout  from "@/components/layout/DashboardLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminStationPage from "./pages/admin/Station";
import AdminSlotPage from "./pages/admin/Slot";
import StationManage from "./pages/admin/StationManage";
import SuperAdminPage from "./pages/admin/SuperAdmin";
import SuperAdminLogin from "./pages/auth/SuperAdminLogin";
import UserProfilePage from "@/pages/user/ProfilePage";
import UserSettings from "@/pages/user/Settings";
import AdminProfilePage from "@/pages/admin/ProfilePage";
import AdminSettings from "@/pages/admin/Settings";
import AddFundsPage from "./pages/user/AddFundsPage";
import HostWalletPage from "./pages/admin/HostWallet";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          
          {/* User Auth */}
          <Route path="/login" element={<UserLogin />} />
          <Route path="/register" element={<UserRegister />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/user/vehicles" element={<MyVehicles />} />
          
          {/* First-time setup */}
          <Route path="/setup-profile" element={<SetupProfile />} />

          <Route
              path="/booking/:stationId/slots"
              element={<SlotSelectionPage />}
            />

            <Route
              path="/booking/payment"
              element={<PaymentPage />}
            />
            <Route
              path="/booking/ticket/:bookingId"
              element={<TicketPage />}
            />
          
          <Route
              path="/dashboard"
              element={
                <DashboardLayout userType="user">
                  <Outlet />
                </DashboardLayout>
              }
            >
              <Route index element={<UserDashboard />} />
              <Route path="bookings" element={<UserBookings />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="wallet" element={<AddFundsPage />} />
              <Route path="profile" element={<UserProfilePage />} />
              <Route path="settings" element={<UserSettings />} />
            </Route>
          
          

          {/* Admin Auth */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/register" element={<AdminRegister />} />
          <Route path="/superadmin/login" element={<SuperAdminLogin />} />
          
          {/* Admin Dashboard (wrapped) */}
          <Route
            path="/admin"
            element={
              <DashboardLayout userType="admin">
                <Outlet />
              </DashboardLayout>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="stations" element={<AdminStationPage />} />
            <Route path="stations/:stationId/manage" element={<StationManage />} />
            <Route path="slots" element={<AdminSlotPage />} />
            <Route path="wallet" element={<HostWalletPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          
          {/* Superadmin Dashboard (separate layout — no admin nav) */}
          <Route
            path="/superadmin"
            element={
              <DashboardLayout userType="superadmin">
                <Outlet />
              </DashboardLayout>
            }
          >
            <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="dashboard" element={<SuperAdminPage />} />
          </Route>
           
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
