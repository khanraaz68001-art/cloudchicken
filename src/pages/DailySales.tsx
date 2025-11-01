import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type SaleRow = {
  id: string;
  sale_date: string;
  order_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  created_at?: string | null;
};

export default function DailySales() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [grouped, setGrouped] = useState<Record<string, SaleRow[]>>({});
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSales();
    
    // Set up automatic refresh every 30 seconds for sales data
    const intervalId = setInterval(() => {
      fetchSales();
    }, 30000);

    // Set up real-time subscription for orders table changes that affect sales
    const salesSubscription = supabase
      .channel('sales_updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders'
        }, 
        () => {
          // Refresh sales data when orders change
          fetchSales();
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'daily_sales'
        }, 
        () => {
          // Refresh sales data when daily_sales table changes
          fetchSales();
        }
      )
      .subscribe();

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(salesSubscription);
    };
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('daily_sales').select('*').order('sale_date', { ascending: false });
      if (error) throw error;
  const d = (data || []) as any[];
  // attempt to populate missing customer_name by joining to orders->user_profiles
  const rowsWithMissingNames = d.filter(r => (!r.customer_name || r.customer_name === null) && r.order_id).map(r => r.order_id);
  if (rowsWithMissingNames.length) {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, user_profiles (name)')
        .in('id', rowsWithMissingNames as string[]);
      const nameMap: Record<string, string> = {};
      (orders || []).forEach((o: any) => { if (o && o.id) nameMap[o.id] = o.user_profiles?.name; });
      d.forEach(r => {
        if ((!r.customer_name || r.customer_name === null) && r.order_id && nameMap[r.order_id]) {
          r.customer_name = nameMap[r.order_id];
        }
      });
    } catch (e) {
      // ignore failures here, we'll just show whatever we have
      console.warn('Failed to backfill customer names for daily sales', e);
    }
  }
  setRows(d as SaleRow[]);
      // group client-side
      const g: Record<string, SaleRow[]> = {};
      d.forEach(r => {
        const key = r.sale_date;
        if (!g[key]) g[key] = [];
        g[key].push(r as SaleRow);
      });
  setGrouped(g);
    } catch (e) {
      console.error('Failed to fetch daily sales', e);
    } finally {
      setLoading(false);
    }
  };

  const dates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Daily Sales</h1>
        <div>
          <Button onClick={() => navigate('/kitchen')}>Back to Kitchen</Button>
        </div>
      </div>

      <div className="space-y-6">
        {rows.length === 0 ? (
          <div className="p-6 bg-white rounded border text-center text-gray-600">
            No daily sales recorded. Run the migration <code>supabase/migrations/20251026_create_daily_sales_table.sql</code> and ensure deliveries are marked to populate this table.
          </div>
        ) : (
          dates.map(date => {
            const group = grouped[date] || [];
            const totalQty = group.reduce((s, r) => s + (r.quantity || 0), 0);
            return (
              <Card key={date}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{date}</span>
                    <span className="text-sm text-gray-600">{group.length} sale{group.length !== 1 ? 's' : ''}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto bg-white rounded">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left">Order ID</th>
                          <th className="px-4 py-3 text-left">Product</th>
                          <th className="px-4 py-3 text-left">Qty</th>
                          <th className="px-4 py-3 text-left">Customer</th>
                          <th className="px-4 py-3 text-left">Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.map(r => (
                          <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRowId(r.id)}>
                            <td className="px-4 py-3">{r.order_id}</td>
                            <td className="px-4 py-3">{r.product_name}</td>
                            <td className="px-4 py-3">{r.quantity ?? '-'}</td>
                            <td className="px-4 py-3">{r.customer_name} {r.customer_phone ? `(${r.customer_phone})` : ''}</td>
                            <td className="px-4 py-3">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                          </tr>
                        ))}

                        {/* Totals row for the day */}
                        <tr className="border-t bg-gray-50">
                          <td className="px-4 py-3 font-semibold">Total</td>
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3 font-semibold">{totalQty}</td>
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3" />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Details dialog for a single sale row */}
      <Dialog open={!!selectedRowId} onOpenChange={(o) => { if (!o) setSelectedRowId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sale details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedRowId ? (() => {
              const r = rows.find(x => x.id === selectedRowId);
              if (!r) return <div>No data</div>;
              return (
                <div className="p-3 border rounded">
                  <div><strong>Sale Date:</strong> {r.sale_date}</div>
                  <div><strong>Order:</strong> {r.order_id}</div>
                  <div><strong>Product:</strong> {r.product_name}</div>
                  <div><strong>Qty:</strong> {r.quantity}</div>
                  <div><strong>Customer:</strong> {r.customer_name} {r.customer_phone ? `(${r.customer_phone})` : ''}</div>
                  <div><strong>Recorded at:</strong> {r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</div>
                </div>
              );
            })() : <div>No data</div>}
            <div className="flex justify-end pt-4">
              <Button onClick={() => setSelectedRowId(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
