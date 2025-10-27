import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getAppSetting } from "@/lib/settings";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

interface Order {
  id: string;
  user_id: string;
  weight_kg: number;
  total_amount: number;
  status: string;
  delivery_address: string;
  created_at: string;
  user_profiles: {
    name: string;
    whatsapp_number: string;
  };
  products?: {
    id: string;
    name: string;
    product_categories: {
      name: string;
    };
  };
  butchered_meat?: {
    id: string;
    weight_kg: number;
  };
}

interface ButcheredMeat {
  id: string;
  weight_kg: number;
  status: string;
  products: {
    name: string;
    product_categories: {
      name: string;
    };
  };
}

const KitchenDashboard = () => {
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [availableMeat, setAvailableMeat] = useState<ButcheredMeat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userProfile?.role === 'kitchen' || userProfile?.role === 'admin') {
      fetchData();
    }
  }, [userProfile]);

  const fetchData = async () => {
    try {
      // Fetch orders that need kitchen attention
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          user_profiles (name, whatsapp_number),
          products (
            id,
            name,
            product_categories (name)
          ),
          butchered_meat (
            id,
            weight_kg
          )
        `)
        .in('status', ['placed', 'accepted', 'cutting', 'packing'])
        .order('created_at', { ascending: true });

      // Fetch available butchered meat
      const { data: meatData } = await supabase
        .from('butchered_meat')
        .select(`
          *,
          products (
            name,
            product_categories (name)
          )
        `)
        .eq('status', 'available')
        .order('butchered_at', { ascending: false });

      setOrders(ordersData || []);
      setAvailableMeat(meatData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data');
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const assignMeatToOrder = async (orderId: string, meatId: string) => {
    setLoading(true);
    try {
      // Update order with meat assignment and change meat status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          butchered_meat_id: meatId,
          status: 'cutting'
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Update butchered meat status to reserved
      const { error: meatError } = await supabase
        .from('butchered_meat')
        .update({ status: 'reserved' })
        .eq('id', meatId);

      if (meatError) throw meatError;

      fetchData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsPacked = async (orderId: string, meatId: string) => {
    setLoading(true);
    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'packing' })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Update meat status
      const { error: meatError } = await supabase
        .from('butchered_meat')
        .update({ status: 'packed' })
        .eq('id', meatId);

      if (meatError) throw meatError;

      fetchData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const markOutForDelivery = async (orderId: string, meatId: string) => {
    setLoading(true);
    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'out_for_delivery' })
        .eq('id', orderId);

      if (orderError) throw orderError;

      fetchData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsAppReminder = async (order: Order) => {
    const shortId = order.id.slice(0,8);
    const productName = order.products?.name || 'chicken';
    const statusLabel = order.status.replace('_', ' ');

    let text = '';

    // fetch configured support number (fallback to placeholder)
    let supportContact = '+91 XXXXX XXXXX';
    try {
      const s = await getAppSetting('support_whatsapp');
      if (s) supportContact = s;
    } catch (e) {
      console.warn('Failed to load support_whatsapp setting', e);
    }

    if (order.status === 'out_for_delivery') {
      text = `Hi ${order.user_profiles.name},\n\nGood news — your Cloud Chicken order #${shortId} (${productName}, ${order.weight_kg}kg, ₹${order.total_amount}) is now out for delivery. Our delivery partner is on the way and should arrive within ~30 minutes.\n\nDelivery address: ${order.delivery_address}\n\nIf you need to change delivery instructions or call, reply here or call ${supportContact}.\n\nThank you for ordering with Cloud Chicken!`;
    } else if (order.status === 'delivered') {
      text = `Hi ${order.user_profiles.name},\n\nYour Cloud Chicken order #${shortId} has been delivered. Order: ${productName} (${order.weight_kg}kg). Total: ₹${order.total_amount}.\n\nWe hope everything is perfect — if there are any issues please reply to this message or call ${supportContact} and we'll make it right.\n\nThanks for choosing Cloud Chicken!`;
    } else {
      text = `Hi ${order.user_profiles.name},\n\nYour Cloud Chicken order #${shortId} is now ${statusLabel}. We'll keep you updated on the progress.\n\nThanks, Cloud Chicken.`;
    }

    const message = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${order.user_profiles.whatsapp_number}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  if (userProfile?.role !== 'kitchen' && userProfile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Alert variant="destructive">
            <AlertDescription>Access denied. Kitchen staff privileges required.</AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Kitchen Dashboard</h1>
          <p className="text-gray-600">Manage orders and meat processing</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">Active Orders</TabsTrigger>
            <TabsTrigger value="meat">Available Meat</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <div className="grid gap-4">
              {orders.map((order) => (
                <Card key={order.id} className="border-l-4 border-l-orange-500">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          Order #{order.id.slice(0, 8)}
                        </CardTitle>
                        <CardDescription>
                          {order.user_profiles.name} • {order.user_profiles.whatsapp_number}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          order.status === 'placed' ? 'destructive' :
                          order.status === 'accepted' ? 'default' :
                          order.status === 'cutting' ? 'secondary' :
                          'outline'
                        }
                      >
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Weight: {order.weight_kg}kg</p>
                          <p>Amount: ₹{order.total_amount}</p>
                        </div>
                        <div>
                          <p className="font-medium">Address:</p>
                          <p className="text-gray-600">{order.delivery_address}</p>
                        </div>
                      </div>

                      {order.products && (
                        <div className="p-2 bg-gray-50 rounded">
                          <p className="text-sm font-medium">Product:</p>
                          <p className="text-sm text-gray-600">
                            {order.products.name} ({order.weight_kg}kg) - {order.products.product_categories.name}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {order.status === 'placed' && (
                          <Button
                            onClick={() => updateOrderStatus(order.id, 'accepted')}
                            disabled={loading}
                            size="sm"
                          >
                            Accept Order
                          </Button>
                        )}

                        {order.status === 'accepted' && !order.butchered_meat && (
                          <div className="w-full">
                            <p className="text-sm font-medium mb-2">Select meat for this order:</p>
                            <div className="flex flex-wrap gap-2">
                              {availableMeat
                                .filter(meat => meat.weight_kg >= order.weight_kg)
                                .map((meat) => (
                                  <Button
                                    key={meat.id}
                                    onClick={() => assignMeatToOrder(order.id, meat.id)}
                                    disabled={loading}
                                    variant="outline"
                                    size="sm"
                                  >
                                    {meat.products.name} ({meat.weight_kg}kg)
                                  </Button>
                                ))
                              }
                            </div>
                          </div>
                        )}

                        {order.status === 'cutting' && order.butchered_meat && (
                          <Button
                            onClick={() => markAsPacked(order.id, order.butchered_meat!.id)}
                            disabled={loading}
                            size="sm"
                          >
                            Mark as Packed
                          </Button>
                        )}

                        {order.status === 'packing' && (
                          <>
                            <Button
                              onClick={() => markOutForDelivery(order.id, order.butchered_meat?.id || '')}
                              disabled={loading}
                              size="sm"
                            >
                              Out for Delivery
                            </Button>
                            <Button
                              onClick={() => sendWhatsAppReminder(order)}
                              variant="outline"
                              size="sm"
                            >
                              Send Reminder
                            </Button>
                          </>
                        )}

                        {(order.status === 'cutting' || order.status === 'packing' || order.status === 'out_for_delivery') && (
                          <Button
                            onClick={() => sendWhatsAppReminder(order)}
                            variant="outline"
                            size="sm"
                          >
                            Send WhatsApp Update
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {orders.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No active orders at the moment</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="meat">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableMeat.map((meat) => (
                <Card key={meat.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{meat.products.name}</CardTitle>
                    <CardDescription>
                      {meat.weight_kg}kg available • {meat.products.product_categories.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="default">Available</Badge>
                  </CardContent>
                </Card>
              ))}

              {availableMeat.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No meat available for processing</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default KitchenDashboard;