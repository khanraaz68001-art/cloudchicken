import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import OrderProgress from "@/components/OrderProgress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  base_price_per_kg?: number;
  image_url?: string | null;
  image_base64?: string | null;
  image_mime?: string | null;
  category_name?: string | null;
}

const Menu = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  // stock summary removed: we don't show stock on the menu and will accept orders regardless
  const [orderForm, setOrderForm] = useState({
    product_id: "",
    weight_kg: "",
    address: userProfile?.address || ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string|null, name: string }>>([]);
  const [cartCount, setCartCount] = useState<number>(0);
  type AddressDraft = { house_flat: string; location: string; landmark: string };

  const parseProfileAddress = (addr: any): AddressDraft => {
    try {
      if (!addr) return { house_flat: '', location: '', landmark: '' };
      if (typeof addr === 'string') {
        // try parse JSON first
        try {
          const parsed = JSON.parse(addr);
          if (parsed && typeof parsed === 'object') return {
            house_flat: parsed.house_flat || '',
            location: parsed.location || '',
            landmark: parsed.landmark || ''
          };
        } catch (e) {
          // not JSON — treat entire string as location
          return { house_flat: '', location: addr, landmark: '' };
        }
      }
      if (typeof addr === 'object') {
        return {
          house_flat: addr.house_flat || '',
          location: addr.location || '',
          landmark: addr.landmark || ''
        };
      }
    } catch (e) {
      // fallthrough
    }
    return { house_flat: '', location: '', landmark: '' };
  };

  const formatAddressForDisplay = (d: AddressDraft) => {
    const parts = [] as string[];
    if (d.house_flat && d.house_flat.trim()) parts.push(d.house_flat.trim());
    if (d.location && d.location.trim()) parts.push(d.location.trim());
    if (d.landmark && d.landmark.trim()) parts.push(d.landmark.trim());
    return parts.join(', ');
  };

  const [addressDraft, setAddressDraft] = useState<AddressDraft>(parseProfileAddress(userProfile?.address));
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  useEffect(() => {
    // Try to show cached products quickly while we fetch fresh data
    try {
      const cached = sessionStorage.getItem('cloudcoop_products');
      if (cached) {
        const parsed = JSON.parse(cached) as Product[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          setProductsLoading(false);
        }
      }
    } catch (e) { /* ignore cache parse errors */ }

    fetchMenuData();
    
    // Set up real-time subscriptions for products and categories
    const productsSubscription = supabase
      .channel('products_changes_menu_simple')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'products'
        }, 
        () => {
          // Refresh products when they change
          fetchMenuData();
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'product_categories'
        }, 
        () => {
          // Refresh products when categories change
          fetchMenuData();
        }
      )
      .subscribe();

    // Cleanup function
    return () => {
      supabase.removeChannel(productsSubscription);
    };
  }, []);

  useEffect(() => {
    // derive categories from products
    const map = new Map<string|null, string>();
    products.forEach(p => {
      const id = (p as any).category_id || null;
      const name = (p as any).category_name || 'Other';
      if (!map.has(id)) map.set(id, name);
    });
    const arr = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    setCategories(arr);
  }, [products]);

  useEffect(() => {
    // read cart count from localStorage (cloudcoop_cart expected to be array)
    const read = () => {
      try {
        const raw = localStorage.getItem('cloudcoop_cart');
        if (!raw) { setCartCount(0); return; }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCartCount(parsed.length);
        else setCartCount(0);
      } catch (e) { setCartCount(0); }
    };
    read();
    const onUpdate = () => read();
    window.addEventListener('cart_updated', onUpdate);
    return () => window.removeEventListener('cart_updated', onUpdate);
  }, []);

  // using DB-backed address from user_profiles.address instead of localStorage

  useEffect(() => {
    if (userProfile?.address) {
      const parsed = parseProfileAddress(userProfile.address);
      setAddressDraft(parsed);
      setOrderForm(prev => ({ ...prev, address: formatAddressForDisplay(parsed) }));
    }
  }, [userProfile]);

  const fetchMenuData = async () => {
    setProductsLoading(true);
    try {
      // Fetch products (use view that includes base64 image data if available)
      try {
        const { data: productsData, error: prodErr } = await supabase
          .from('products_with_image')
          .select('*')
          .order('sort_order', { ascending: true });
        if (!prodErr && productsData) {
          setProducts(productsData || []);
          try { sessionStorage.setItem('cloudcoop_products', JSON.stringify(productsData || [])); } catch (e) {}
        } else {
          throw prodErr || new Error('no data from view');
        }
      } catch (err) {
        console.warn('products_with_image not available, falling back to products table', err);
        const { data: pData, error: pErr } = await supabase
          .from('products')
          .select('id, category_id, name, description, base_price_per_kg, image_url, is_available')
          .order('sort_order', { ascending: true });
        if (!pErr && pData) setProducts(pData || []);
        try { sessionStorage.setItem('cloudcoop_products', JSON.stringify(pData || [])); } catch (e) {}
      }

      // intentionally skip fetching stock summary
    } catch (error) {
      console.error('Error fetching menu data:', error);
      setError('Failed to load menu');
    }
    finally {
      setProductsLoading(false);
    }
  };

  const calculatePrice = (product: Product | undefined, weight: number) => {
    const ratePerKg = product?.base_price_per_kg || 0;
    return Math.round((ratePerKg || 0) * weight);
  };

  // Quick add to cart helper: adds one piece of default weight (0.5kg) for the product
  const addToCartQuick = (product: Product, perPieceKg = 0.5) => {
    try {
      const raw = localStorage.getItem('cloudcoop_cart');
      const cart = raw ? JSON.parse(raw) : [] as any[];

      // find existing item with same product id and same per-piece weight
      const idx = cart.findIndex((it: any) => it.product?.id === product.id && Math.abs(((it.weight_kg || 0) / (it.quantity || 1)) - perPieceKg) < 1e-6);
      if (idx >= 0) {
        cart[idx].quantity = (cart[idx].quantity || 1) + 1;
        cart[idx].weight_kg = (cart[idx].weight_kg || perPieceKg) + perPieceKg;
      } else {
        cart.push({ product, quantity: 1, weight_kg: perPieceKg });
      }

      localStorage.setItem('cloudcoop_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart_updated'));
      // update local state quickly
      setCartCount(Array.isArray(cart) ? cart.length : 0);
    } catch (e) {
      console.warn('Failed to add to cart', e);
    }
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError("");

    try {
  const selectedProduct = products.find(p => p.id === orderForm.product_id);
  if (!selectedProduct) throw new Error("Please select a product");

  const weight = parseFloat(orderForm.weight_kg);
  const totalAmount = calculatePrice(selectedProduct, weight);

      // Try creating the order normally and return the new row
      const { data: insertedData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          product_id: selectedProduct.id,
          weight_kg: weight,
          total_amount: totalAmount,
          delivery_address: orderForm.address,
          status: 'pending'
        })
        .select()
        .single();

      // If a stock-related error occurs on the server (some DB setups block orders when stock is 0),
      // retry with a server-side FORCE RPC that inserts the order regardless of stock checks.
      if (orderError) {
        const msg = (orderError.message || '').toLowerCase();
        if (msg.includes('stock') || msg.includes('no stock') || msg.includes('out of stock')) {
          // attempt force-insert via RPC (requires migration to create this RPC)
            try {
              const { data: rpcData, error: rpcErr } = await supabase.rpc('create_order_force', {
                p_user_id: user.id,
                p_product_id: selectedProduct.id,
                p_weight_kg: weight,
                p_total_amount: totalAmount,
                p_delivery_address: orderForm.address
              });
              if (rpcErr) throw rpcErr;
              // rpcData may contain the created order; capture id if present
              const newId = rpcData?.id || (rpcData && rpcData[0]?.id) || null;
              if (newId) {
                setPlacedOrderId(newId as string);
                window.dispatchEvent(new CustomEvent('order_placed', { detail: { orderId: newId } }));
              }
            } catch (rpcEx: any) {
              throw rpcEx;
            }
        } else {
          throw orderError;
        }
      }

      // if insertedData exists, capture order id and show progress
      if (insertedData && insertedData.id) {
        setPlacedOrderId(insertedData.id as string);
        window.dispatchEvent(new CustomEvent('order_placed', { detail: { orderId: insertedData.id } }));
      }

      // Reset form
      setOrderForm({
        product_id: "",
        weight_kg: "",
        address: orderForm.address
      });

      // if user chose to save address via modal earlier, persist it now
      if (saveAsDefault && user && orderForm.address) {
        try {
          // Save structured address if we have a draft, otherwise save the raw string
          const payload = addressDraft && (addressDraft.location || addressDraft.house_flat || addressDraft.landmark)
            ? JSON.stringify(addressDraft)
            : orderForm.address;
          await supabase
            .from('user_profiles')
            .update({ address: payload })
            .eq('id', user.id);
          try { await refreshUserProfile(); } catch (e) { /* ignore */ }
        } catch (e) {
          console.warn('Failed to save default address', e);
        }
      }

  // Show inline progress UI instead of blocking alert
  // (Order progress component will animate open)
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Dev verification banner (only shown in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800 text-center">
              Dev banner: Menu component loaded (UI edits applied)
            </div>
          )}

          {/* Cart summary at top */}
          <div className="mb-6">
            <div className="p-3 bg-white rounded shadow flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Cart</div>
                <div className="text-xs text-gray-500">{cartCount} item{cartCount !== 1 ? 's' : ''}</div>
              </div>
                <div>
                <Button onClick={() => navigate('/menu?openCart=1')}>View Cart</Button>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
              {/* Available Products */}
            <div>
              {/* Show products grouped by category in 2-column grids */}
              {productsLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={`skel-${i}`} className="p-3 animate-pulse">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 bg-gray-200 rounded" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-2/3" />
                            <div className="h-3 bg-gray-200 rounded w-1/3" />
                          </div>
                          <div className="w-12 h-6 bg-gray-200 rounded" />
                        </div>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                        <div className="h-8 bg-gray-200 rounded w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="text-center text-muted-foreground">No products available.</div>
              ) : categories.length > 0 ? (
                categories.map(cat => {
                  const prods = products.filter(p => ((p as any).category_id || null) === cat.id);
                  if (!prods || prods.length === 0) return null;
                  return (
                    <section key={String(cat.id)} className="mb-6">
                      <h3 className="text-xl font-semibold">{cat.name}</h3>
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        {prods.map(product => (
                          <Card key={product.id} className="hover:shadow-md transition-shadow p-2">
                            <CardHeader>
                              <div className="flex items-start gap-3">
                                {/* smaller product image */}
                                {product.image_url ? (
                                  <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
                                ) : product.image_base64 ? (
                                  <img src={`data:${product.image_mime || 'image/png'};base64,${product.image_base64}`} alt={product.name} className="w-12 h-12 object-cover rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
                                ) : (
                                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center"><img src="/placeholder.svg" className="w-6 h-6" alt="placeholder"/></div>
                                )}

                                <div className="flex-1">
                                  <CardTitle className="text-sm">{product.name}</CardTitle>
                                  <CardDescription className="text-xs text-gray-500">{product.category_name}</CardDescription>
                                </div>
                                <div className="ml-2">
                                  <Badge variant="secondary" className="text-xs">₹{product.base_price_per_kg || 0}/kg</Badge>
                                </div>
                              </div>
                            </CardHeader>
                              <CardContent className="p-2 text-sm">
                                <p className="text-sm text-gray-600">{product.description}</p>
                                <div className="mt-2">
                                  <Button size="sm" onClick={() => addToCartQuick(product)} className="w-full">Add</Button>
                                </div>
                              </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>
                  );
                })
              ) : (
                // fallback: show all products if categories couldn't be derived
                <div className="grid grid-cols-2 gap-4">
                  {products.map(product => (
                    <Card key={product.id} className="hover:shadow-md transition-shadow p-2">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded" />
                          ) : product.image_base64 ? (
                            <img src={`data:${product.image_mime || 'image/png'};base64,${product.image_base64}`} alt={product.name} className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center"><img src="/placeholder.svg" className="w-6 h-6" alt="placeholder"/></div>
                          )}
                          <div className="flex-1">
                            <CardTitle className="text-sm">{product.name}</CardTitle>
                            <CardDescription className="text-xs text-gray-500">{product.category_name}</CardDescription>
                          </div>
                          <div className="ml-2">
                            <Badge variant="secondary" className="text-xs">₹{product.base_price_per_kg || 0}/kg</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-2 text-sm">
                        <p className="text-sm text-gray-600">{product.description}</p>
                        <div className="mt-2">
                          <Button size="sm" onClick={() => addToCartQuick(product)} className="w-full">Add</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Order Form */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Place Your Order</h2>
              
              {!user && (
                <Alert className="mb-6">
                  <AlertDescription>
                    Please <Button variant="link" className="p-0" onClick={() => navigate('/login')}>
                      login
                    </Button> to place an order.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Order Details</CardTitle>
                  <CardDescription>Specify your requirements</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleOrder} className="space-y-4">
                    <div>
                      <Label htmlFor="product">Select Product</Label>
                      <select
                        id="product"
                        value={orderForm.product_id}
                        onChange={(e) => setOrderForm({ ...orderForm, product_id: e.target.value })}
                        className="w-full p-2 border rounded mt-1"
                        required
                        disabled={!user}
                      >
                        <option value="">Select a product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} {product.category_name ? `(${product.category_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="weight">Weight (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="e.g., 1.5"
                        value={orderForm.weight_kg}
                        onChange={(e) => setOrderForm({ ...orderForm, weight_kg: e.target.value })}
                        required
                        disabled={!user}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="address">Delivery Address</Label>
                        <div>
                          <div className="flex items-center gap-2">
                            <button type="button" className="text-sm text-primary underline" onClick={() => { setAddressDraft(parseProfileAddress(orderForm.address || userProfile?.address || '')); setShowAddressModal(true); }}>
                              Add / Use different address
                            </button>
                            <button type="button" className="text-sm px-2 py-1 border rounded text-white bg-primary" onClick={async () => {
                              if (!user) { navigate('/login'); return; }
                              try {
                                const payload = addressDraft && (addressDraft.location || addressDraft.house_flat || addressDraft.landmark)
                                  ? JSON.stringify(addressDraft)
                                  : orderForm.address;
                                const { error: updErr } = await supabase.from('user_profiles').update({ address: payload }).eq('id', user.id);
                                if (updErr) throw updErr;
                                try { await refreshUserProfile(); } catch (e) { /* ignore */ }
                                setSaveMessage('Saved as default address');
                                setTimeout(() => setSaveMessage(''), 3000);
                              } catch (err) {
                                console.warn('Failed to save address', err);
                                setError('Failed to save address');
                              }
                            }}>Save</button>
                          </div>
                        </div>
                      </div>
                      <textarea
                        id="address"
                        className="w-full p-2 border rounded mt-1"
                        rows={3}
                        placeholder="Enter your complete delivery address"
                        value={orderForm.address}
                        onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                        onBlur={async () => {
                          // If user typed an address and it's different from the saved profile address,
                          // save it as the default (when saveAsDefault is checked).
                          try {
                            if (user && saveAsDefault && orderForm.address && orderForm.address !== (typeof userProfile?.address === 'string' ? userProfile.address : JSON.stringify(userProfile?.address))) {
                              await supabase.from('user_profiles').update({ address: orderForm.address }).eq('id', user.id);
                              try { await refreshUserProfile(); } catch (e) { /* ignore */ }
                              setSaveMessage('Saved as default address');
                              setTimeout(() => setSaveMessage(''), 3000);
                            }
                          } catch (err) {
                            console.warn('Failed to auto-save address from textarea', err);
                          }
                        }}
                        required
                        disabled={!user}
                      />

                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={async () => {
                          if (!user) { navigate('/login'); return; }
                          try {
                            const payload = addressDraft && (addressDraft.location || addressDraft.house_flat || addressDraft.landmark)
                              ? JSON.stringify(addressDraft)
                              : orderForm.address;
                            const { error: updErr } = await supabase.from('user_profiles').update({ address: payload }).eq('id', user.id);
                            if (updErr) throw updErr;
                            try { await refreshUserProfile(); } catch (e) { /* ignore */ }
                            setSaveMessage('Saved as default address');
                            setTimeout(() => setSaveMessage(''), 3000);
                          } catch (err) {
                            console.warn('Failed to save address', err);
                            setError('Failed to save address');
                          }
                        }}>Save address</Button>
                        {saveMessage && <div className="text-sm text-green-600">{saveMessage}</div>}
                      </div>
                    </div>

                    {orderForm.product_id && orderForm.weight_kg && (
                      <div className="p-4 bg-gray-50 rounded">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total Amount:</span>
                          <span className="text-2xl font-bold text-primary">
                            ₹{calculatePrice(
                              products.find(p => p.id === orderForm.product_id)!,
                              parseFloat(orderForm.weight_kg) || 0
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="text-blue-600 font-semibold text-sm">💰 Payment Method</div>
                      </div>
                      <div className="text-sm text-blue-700 mt-1">
                        This order is <strong>Cash on Delivery (COD)</strong>. Payment will be collected at the time of delivery.
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loading || !user}
                    >
                      {loading ? "Placing Order..." : "Place Order"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      {/* Address Modal */}
      <Dialog open={showAddressModal} onOpenChange={(open) => setShowAddressModal(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add / Use Address</DialogTitle>
            <DialogDescription>Manage your delivery address for order placement</DialogDescription>
          </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Saved Address (from profile)</label>
                <div className="mt-2">
                {userProfile?.address ? (
                  (() => {
                    const saved = parseProfileAddress(userProfile.address);
                    const formatted = formatAddressForDisplay(saved);
                    return (
                      <div className="flex items-start justify-between bg-gray-50 p-2 rounded">
                        <div className="text-sm break-words">{formatted || String(userProfile.address)}</div>
                        <div className="flex items-center gap-2">
                          <button className="text-sm text-primary underline" onClick={() => { setAddressDraft(saved); setOrderForm(prev => ({ ...prev, address: formatted })); setShowAddressModal(false); }}>Use</button>
                          <button className="text-sm text-red-500" onClick={async () => {
                            try {
                              await supabase.from('user_profiles').update({ address: null }).eq('id', user?.id);
                              setAddressDraft({ house_flat: '', location: '', landmark: '' });
                              setOrderForm(prev => ({ ...prev, address: '' }));
                              try { await refreshUserProfile(); } catch (e) { /* ignore */ }
                            } catch (err) {
                              console.warn('Failed to remove profile address', err);
                            }
                          }}>Remove</button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-sm text-muted-foreground">No saved profile address</div>
                )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-sm font-medium">House / Flat No.</label>
                  <Input className="w-full mt-1" value={addressDraft.house_flat} onChange={(e) => setAddressDraft({ ...addressDraft, house_flat: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Input className="w-full mt-1" value={addressDraft.location} onChange={(e) => setAddressDraft({ ...addressDraft, location: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Landmark</label>
                  <Input className="w-full mt-1" value={addressDraft.landmark} onChange={(e) => setAddressDraft({ ...addressDraft, landmark: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input id="saveDefault" type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} />
                <label htmlFor="saveDefault" className="text-sm">Save as default address (also saved locally)</label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddressModal(false)}>Cancel</Button>
                <Button onClick={async () => {
                  const formatted = formatAddressForDisplay(addressDraft);
                  setOrderForm(prev => ({ ...prev, address: formatted }));
                  if (saveAsDefault && user) {
                    try {
                      await supabase.from('user_profiles').update({ address: JSON.stringify(addressDraft) }).eq('id', user.id);
                      try { await refreshUserProfile(); } catch (e) { /* ignore */ }
                    } catch (err) {
                      console.warn('Failed to save address', err);
                    }
                  }
                  // server-side save handled above; no local persistence needed
                  setShowAddressModal(false);
                }}>Use Address</Button>
              </div>
            </div>
        </DialogContent>
      </Dialog>
      {placedOrderId && (
        <OrderProgress orderId={placedOrderId} onClose={() => setPlacedOrderId(null)} />
      )}

      <Footer />
    </div>
  );
};

export default Menu;
