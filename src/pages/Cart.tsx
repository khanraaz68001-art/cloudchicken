import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const Cart = () => {
  // Load cart from localStorage (same shape as in EcommerceMenu)
  const [cartItems, setCartItems] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cloudcoop_cart');
      if (raw) setCartItems(JSON.parse(raw));
    } catch (e) {
      // ignore parse errors
      setCartItems([]);
    }
    // Redirect to /menu and open the modal — we want to keep cart UX as modal-only
    try {
      navigate('/menu?openCart=1', { replace: true });
    } catch (e) {}
  }, []);

  // persist changes and notify other tabs/components
  useEffect(() => {
    try {
      localStorage.setItem('cloudcoop_cart', JSON.stringify(cartItems));
      window.dispatchEvent(new Event('cart_updated'));
    } catch (e) {
      // ignore
    }
  }, [cartItems]);

  const deliveryFee = 30;
  const subtotal = cartItems.reduce((sum, item) => {
    const pricePerKg = item?.product?.base_price_per_kg ?? item?.price ?? 0;
    const amount = (item.weight_kg ?? 0) * pricePerKg;
    return sum + amount;
  }, 0);
  const total = subtotal + deliveryFee;

  const updateQuantity = (productId?: string, change: number = 0) => {
    if (!productId) return;
    setCartItems(prev => prev
      .map((item: any) => {
        if (item.product?.id === productId) {
          const newQuantity = Math.max(0, (item.quantity || 0) + change);
          if (newQuantity === 0) return null;
          const perPieceWeight = (item.weight_kg || 0) / (item.quantity || 1);
          return { ...item, quantity: newQuantity, weight_kg: perPieceWeight * newQuantity };
        }
        return item;
      })
      .filter(Boolean)
    );
  };

  const removeItem = (productId?: string) => {
    if (!productId) return;
    setCartItems(prev => prev.filter((item: any) => item.product?.id !== productId));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Your cart is empty</h3>
                  <p className="text-muted-foreground mb-6">Add some fresh chicken to get started!</p>
                  <Link to="/menu">
                    <Button>Browse Menu</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              cartItems.map((item: any) => (
                <Card key={item.product?.id || item.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {item.product?.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-24 h-24 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gray-100 rounded-md" />
                      )}

                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{item.product?.name || item.name}</h3>
                        <p className="text-sm text-muted-foreground">{(item.weight_kg ?? 0) >= 1 ? `${(item.weight_kg ?? 0).toFixed(1)}kg` : `${((item.weight_kg ?? 0) * 1000).toFixed(0)}gm`}</p>
                        <p className="text-primary font-semibold mt-1">₹{((item.weight_kg ?? 0) * (item.product?.base_price_per_kg ?? item.price ?? 0)).toFixed(2)}</p>

                        <div className="flex items-center gap-2 mt-3">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product?.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product?.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col justify-between items-end">
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(item.product?.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <p className="font-semibold">₹{((item.weight_kg ?? 0) * (item.product?.base_price_per_kg ?? item.price ?? 0)).toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Order Summary</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span className="font-medium">₹{deliveryFee}</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-primary">₹{total}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Input placeholder="Enter coupon code" />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">Apply Coupon</Button>
                    <Button variant="ghost" className="flex-none" onClick={() => { try { localStorage.removeItem('cloudcoop_cart'); setCartItems([]); window.dispatchEvent(new Event('cart_updated')); } catch(e){} }}>Clear Cart</Button>
                  </div>
                </div>

                <Button className="w-full" size="lg" disabled={cartItems.length === 0}>
                  Proceed to Checkout
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Cart;
