import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Users, Baby, AlertTriangle, Sparkles, HeartPulse, FileSpreadsheet, Server, Package, ShoppingCart, TrendingUp } from 'lucide-react';

export default function Dashboard({ setActiveTab }) {
  const [health, setHealth] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [masterItemsCount, setMasterItemsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch API Health status
        const healthRes = await apiFetch(`/api/health`);
        const healthJson = await healthRes.json();
        setHealth(healthJson);

        // Fetch Inventory trends
        const trendRes = await apiFetch(`/api/inventory/trends`);
        const trendJson = await trendRes.json();
        setTrendData(trendJson);

        // Fetch Master Items
        const masterRes = await apiFetch(`/api/inventory/master-items`);
        const masterJson = await masterRes.json();
        setMasterItemsCount(masterJson.length || 0);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const currentTrends = trendData || [];

  // Inventory metric summary based on latest month in trend
  const latestTrend = trendData.length > 0 ? trendData[trendData.length - 1] : { total_received: 0, total_dispensed: 0, total_inventory: 0 };

  return (
    <div className="fade-in">
      {/* DB Health Alert Banner */}
      {health && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderRadius: '14px',
          backgroundColor: health.mysql_connected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          border: `1px solid ${health.mysql_connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
          marginBottom: '24px',
          fontSize: '0.9rem'
        }}>
          <Server size={18} color={health.mysql_connected ? '#10b981' : '#f59e0b'} />
          <span style={{ fontWeight: '500' }}>สถานะการเชื่อมต่อ:</span>
          <span style={{
            color: health.mysql_connected ? '#10b981' : '#f59e0b',
            fontWeight: '600',
            backgroundColor: health.mysql_connected ? '#ecfdf5' : '#fffbeb',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.8rem'
          }}>
            {health.database_mode}
          </span>
          <span style={{ color: '#64748b', fontSize: '0.85rem', marginLeft: 'auto' }}>
            IP: {health.mysql_connected ? '192.168.1.200 (HOSxP Database)' : 'Local Mock Interface'}
          </span>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="card-grid">
        <div className="glass-card metric-card primary" onClick={() => setActiveTab('inventory')} style={{ cursor: 'pointer' }}>
          <div className="metric-header">
            <span className="metric-title">รายการเวชภัณฑ์ทั้งหมด</span>
            <div className="metric-icon-wrapper">
              <Package size={20} />
            </div>
          </div>
          <div className="metric-value">
            {masterItemsCount}
          </div>
          <div className="metric-sub">
            รายการเวชภัณฑ์มิใช่ยาในระบบฐานข้อมูล
          </div>
        </div>

        <div className="glass-card metric-card info" onClick={() => setActiveTab('inventory')} style={{ cursor: 'pointer' }}>
          <div className="metric-header">
            <span className="metric-title">มูลค่าคลังเวชภัณฑ์ (ล่าสุด)</span>
            <div className="metric-icon-wrapper">
              <FileSpreadsheet size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: '#3b82f6', fontSize: '1.75rem', paddingTop: '6px' }}>
            {latestTrend.total_inventory > 0 
              ? `฿${Number(latestTrend.total_inventory).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
              : '฿0'
            }
          </div>
          <div className="metric-sub">
            {latestTrend.total_inventory > 0 ? `มูลค่าคลังคงเหลือเดือน ${latestTrend.month_name}` : 'ไม่มีข้อมูลมูลค่าคงคลัง'}
          </div>
        </div>

        <div className="glass-card metric-card success" onClick={() => setActiveTab('inventory')} style={{ cursor: 'pointer' }}>
          <div className="metric-header">
            <span className="metric-title">มูลค่ารับเข้า (ล่าสุด)</span>
            <div className="metric-icon-wrapper">
              <ShoppingCart size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: '#10b981', fontSize: '1.75rem', paddingTop: '8px' }}>
            {latestTrend.total_received > 0 
              ? `฿${Number(latestTrend.total_received).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
              : '฿0'
            }
          </div>
          <div className="metric-sub">
            {latestTrend.total_received > 0 ? `รับเข้าใหม่เดือน ${latestTrend.month_name}` : 'ไม่มีการรับเข้าใหม่'}
          </div>
        </div>

        <div className="glass-card metric-card secondary" onClick={() => setActiveTab('inventory')} style={{ cursor: 'pointer' }}>
          <div className="metric-header">
            <span className="metric-title">มูลค่าเบิกจ่าย (ล่าสุด)</span>
            <div className="metric-icon-wrapper">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: '#f59e0b', fontSize: '1.75rem', paddingTop: '8px' }}>
            {latestTrend.total_dispensed > 0 
              ? `฿${Number(latestTrend.total_dispensed).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
              : '฿0'
            }
          </div>
          <div className="metric-sub">
            {latestTrend.total_dispensed > 0 ? `จ่ายออกเดือน ${latestTrend.month_name}` : 'ไม่มีการเบิกจ่าย'}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ marginTop: '24px' }}>
        {/* Inventory Value Trend */}
        <div className="chart-container" style={{ width: '100%' }}>
          <div className="chart-title">แนวโน้มมูลค่าคลังและการเบิกจ่ายเวชภัณฑ์ที่ไม่ใช่ยา</div>
          <div style={{ width: '100%', height: 380, minHeight: 380 }}>
            {currentTrends.length > 0 ? (
              <ResponsiveContainer width="99%" height={380}>
                <AreaChart data={currentTrends} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInventory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDispensed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month_name" tickLine={false} axisLine={false} style={{ fontSize: '0.8rem', fill: '#64748b' }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: '0.8rem', fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }} 
                    formatter={(value) => [`฿${Number(value).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '0.9rem', paddingTop: '10px' }} />
                  <Area name="มูลค่าคลังคงเหลือ" type="monotone" dataKey="total_inventory" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorInventory)" />
                  <Area name="มูลค่าการรับเข้า" type="monotone" dataKey="total_received" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceived)" />
                  <Area name="มูลค่าการจ่ายออก" type="monotone" dataKey="total_dispensed" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDispensed)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '150px 0' }}>ไม่มีประวัติการทำรายการเวชภัณฑ์ในระบบ</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
