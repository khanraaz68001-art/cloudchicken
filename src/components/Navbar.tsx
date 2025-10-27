import { ShoppingCart, User, Menu, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, userProfile, signOut } = useAuth();
  const [cartCount, setCartCount] = useState<number>(0);

  // Initialize cart count from localStorage and subscribe to updates
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('cloudcoop_cart');
        if (!raw) return setCartCount(0);
        const arr = JSON.parse(raw);
        setCartCount(Array.isArray(arr) ? arr.length : 0);
      } catch (e) {
        setCartCount(0);
      }
    };

    read();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cloudcoop_cart') read();
    };
    const onCustom = () => read();
    window.addEventListener('storage', onStorage);
    window.addEventListener('cart_updated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cart_updated', onCustom);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              CLOUD CHICKEN
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/menu" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
              Menu
            </Link>
            {user && (
              <Link to="/orders" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                My Orders
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Admin
              </Link>
            )}
            {(user?.role === 'kitchen' || user?.role === 'admin') && (
              <Link to="/kitchen" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Kitchen
              </Link>
            )}
            {(user?.role === 'delivery' || user?.role === 'admin') && (
              <Link to="/delivery" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Delivery
              </Link>
            )}
            {(user?.role === 'kitchen' || user?.role === 'admin') && (
              <Link to="/daily-sales" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Daily Sales
              </Link>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {/* cart icon removed (cart is shown on menu page) */}
            
            <div className="hidden md:flex items-center space-x-2">
              {user ? (
                <>
                  <span className="text-sm font-medium text-foreground/80">
                    Hi, {user?.name}
                  </span>
                  <Button variant="ghost" size="icon" onClick={signOut}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <Link to="/login">
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
              )}
            </div>

            <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-3 border-t">
            <Link to="/" className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/menu" className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
              Menu
            </Link>
            {user && (
              <Link to="/orders" className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                My Orders
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Admin
              </Link>
            )}
            {(user?.role === 'kitchen' || user?.role === 'admin') && (
              <Link to="/kitchen" className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Kitchen
              </Link>
            )}
            {(user?.role === 'delivery' || user?.role === 'admin') && (
              <Link to="/delivery" className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Delivery
              </Link>
            )}
            {(user?.role === 'kitchen' || user?.role === 'admin') && (
              <Link to="/daily-sales" className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Daily Sales
              </Link>
            )}
            {user ? (
              <>
                <span className="block text-sm font-medium text-foreground/80">
                  Hi, {user?.name}
                </span>
                <button 
                  onClick={signOut}
                  className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};
