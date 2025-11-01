import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PersistentOrderBar from "@/components/PersistentOrderBar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Menu from "./pages/Menu";
import EcommerceMenu from "./pages/EcommerceMenu";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Cart from "./pages/Cart";
import AdminDashboard from "./pages/AdminDashboard";
import EnhancedAdminDashboard from "./pages/EnhancedAdminDashboard";
import KitchenDashboard from "./pages/KitchenDashboard";
import EnhancedKitchenDashboard from "./pages/EnhancedKitchenDashboard";
import DailySales from "./pages/DailySales";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import OrderTracking from "./pages/OrderTracking";
import About from "./pages/About";
import WhatsAppFloat from "./components/WhatsAppFloat";
import LiveUpdates from "./components/LiveUpdates";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
// Waste management page removed; daily sales replaces it
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <LiveUpdates />
        <BrowserRouter>
          <PersistentOrderBar />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/menu" element={<EcommerceMenu />} />
            <Route path="/menu-old" element={<Menu />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/admin" element={<EnhancedAdminDashboard />} />
            <Route path="/admin-old" element={<AdminDashboard />} />
            <Route path="/kitchen" element={<EnhancedKitchenDashboard />} />
            <Route path="/kitchen-old" element={<KitchenDashboard />} />
            <Route path="/delivery" element={<DeliveryDashboard />} />
            <Route path="/orders" element={<OrderTracking />} />
            {/* waste management removed; use /daily-sales for per-day delivered orders */}
            <Route path="/daily-sales" element={<DailySales />} />
            <Route path="/about" element={<About />} />
            {/* Contact page removed - use floating WhatsApp button instead */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <WhatsAppFloat />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
