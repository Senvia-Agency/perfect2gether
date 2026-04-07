import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedLayoutRoute } from "@/components/auth/ProtectedLayoutRoute";
import { SuperAdminRoute } from "@/components/auth/SuperAdminRoute";
const PWAInstallButton = lazy(() => import("@/components/pwa/PWAInstallButton").then(m => ({ default: m.PWAInstallButton })));

// Eager: Login is the entry point
import Login from "./pages/Login";

// Lazy: All other pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const Prospects = lazy(() => import("./pages/Prospects"));
const PortalTotalLink = lazy(() => import("./pages/PortalTotalLink"));
const PortalTotalLinkHome = lazy(() => import("./pages/portal-total-link/Home"));
const PortalTotalLinkContratos = lazy(() => import("./pages/portal-total-link/Contratos"));
const PortalTotalLinkIds = lazy(() => import("./pages/portal-total-link/Ids"));
const PortalTotalLinkPendentes = lazy(() => import("./pages/portal-total-link/Pendentes"));
const PortalTotalLinkReclamacoes = lazy(() => import("./pages/portal-total-link/Reclamacoes"));
const PortalTotalLinkRh = lazy(() => import("./pages/portal-total-link/Rh"));
const Clients = lazy(() => import("./pages/Clients"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Settings = lazy(() => import("./pages/Settings"));
const Proposals = lazy(() => import("./pages/Proposals"));
const Sales = lazy(() => import("./pages/Sales"));
const Finance = lazy(() => import("./pages/Finance"));
const FinancePayments = lazy(() => import("./pages/finance/Payments"));
const FinanceInvoices = lazy(() => import("./pages/finance/Invoices"));
const FinanceExpenses = lazy(() => import("./pages/finance/Expenses"));
const Ecommerce = lazy(() => import("./pages/Ecommerce"));
const Marketing = lazy(() => import("./pages/Marketing"));
const MarketingTemplates = lazy(() => import("./pages/marketing/Templates"));
const MarketingCampaigns = lazy(() => import("./pages/marketing/Campaigns"));
const MarketingReports = lazy(() => import("./pages/marketing/Reports"));

const MarketingLists = lazy(() => import("./pages/marketing/Lists"));
const EcommerceProducts = lazy(() => import("./pages/ecommerce/Products"));
const EcommerceOrders = lazy(() => import("./pages/ecommerce/Orders"));
const EcommerceCustomers = lazy(() => import("./pages/ecommerce/Customers"));
const EcommerceInventory = lazy(() => import("./pages/ecommerce/Inventory"));
const EcommerceDiscounts = lazy(() => import("./pages/ecommerce/Discounts"));
const EcommerceReports = lazy(() => import("./pages/ecommerce/Reports"));
const PublicLeadForm = lazy(() => import("./pages/PublicLeadForm"));
const ConversationalLeadForm = lazy(() => import("./pages/ConversationalLeadForm"));
const InviteRegister = lazy(() => import("./pages/InviteRegister"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Install = lazy(() => import("./pages/Install"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SystemAdminDashboard = lazy(() => import("./pages/system-admin/Dashboard"));
const SystemAdminOrganizations = lazy(() => import("./pages/system-admin/Organizations"));
const SystemAdminUsers = lazy(() => import("./pages/system-admin/Users"));
const SystemAdminAnnouncements = lazy(() => import("./pages/system-admin/Announcements"));
const FinanceInternalRequests = lazy(() => import("./pages/finance/InternalRequests"));

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={null}><PWAInstallButton /></Suspense>
            <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/f/:slug" element={<PublicLeadForm />} />
                <Route path="/f/:slug/:formSlug" element={<PublicLeadForm />} />
                <Route path="/c/:slug" element={<ConversationalLeadForm />} />
                <Route path="/c/:slug/:formSlug" element={<ConversationalLeadForm />} />
                <Route path="/invite/:token" element={<InviteRegister />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/install" element={<Install />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />

                {/* Protected Routes (Persistent Layout) */}
                <Route element={<ProtectedLayoutRoute />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/prospects" element={<Prospects />} />
                  <Route path="/portal-total-link" element={<PortalTotalLink />}>
                    <Route index element={<Navigate to="home" replace />} />
                    <Route path="home" element={<PortalTotalLinkHome />} />
                    <Route path="contratos" element={<PortalTotalLinkContratos />} />
                    <Route path="ids" element={<PortalTotalLinkIds />} />
                    <Route path="pendentes" element={<PortalTotalLinkPendentes />} />
                    <Route path="reclamacoes" element={<PortalTotalLinkReclamacoes />} />
                    <Route path="rh" element={<PortalTotalLinkRh />} />
                  </Route>
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/proposals" element={<Proposals />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/financeiro" element={<Finance />} />
                  <Route path="/financeiro/pagamentos" element={<FinancePayments />} />
                  <Route path="/financeiro/faturas" element={<FinanceInvoices />} />
                  <Route path="/financeiro/despesas" element={<FinanceExpenses />} />
                  <Route path="/ecommerce" element={<Ecommerce />} />
                  <Route path="/ecommerce/products" element={<EcommerceProducts />} />
                  <Route path="/ecommerce/orders" element={<EcommerceOrders />} />
                  <Route path="/ecommerce/customers" element={<EcommerceCustomers />} />
                  <Route path="/ecommerce/inventory" element={<EcommerceInventory />} />
                  <Route path="/ecommerce/discounts" element={<EcommerceDiscounts />} />
                  <Route path="/ecommerce/reports" element={<EcommerceReports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/marketing" element={<Marketing />} />
                  <Route path="/marketing/templates" element={<MarketingTemplates />} />
                  <Route path="/marketing/campaigns" element={<MarketingCampaigns />} />
                  <Route path="/marketing/reports" element={<MarketingReports />} />
                  <Route path="/marketing/lists" element={<MarketingLists />} />
                  
                </Route>

                {/* Super Admin Routes */}
                <Route path="/system-admin" element={
                  <SuperAdminRoute>
                    <SystemAdminDashboard />
                  </SuperAdminRoute>
                } />
                <Route path="/system-admin/organizations" element={
                  <SuperAdminRoute>
                    <SystemAdminOrganizations />
                  </SuperAdminRoute>
                } />
                <Route path="/system-admin/users" element={
                  <SuperAdminRoute>
                    <SystemAdminUsers />
                  </SuperAdminRoute>
                } />
                <Route path="/system-admin/announcements" element={
                  <SuperAdminRoute>
                    <SystemAdminAnnouncements />
                  </SuperAdminRoute>
                } />

                {/* Finance sub-routes */}
                <Route element={<ProtectedLayoutRoute />}>
                  <Route path="/financeiro/pedidos" element={<FinanceInternalRequests />} />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
