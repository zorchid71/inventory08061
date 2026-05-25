import React, { useState } from 'react';
import { LayoutDashboard, Archive, Calendar, Settings as SettingsIcon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Settings from './components/Settings';
import Reports from './components/Reports';
import ProcurementPlan from './components/ProcurementPlan';
import PurchaseRequest from './components/PurchaseRequest';
import Requisition from './components/Requisition';
import Report301 from './components/Report301';
import { Package, FileBarChart, Calculator, FileSignature, ChevronDown, ChevronRight, Boxes, FileText } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isInventoryMenuOpen, setIsInventoryMenuOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'inventory':
        return <Inventory />;
      case 'requisition':
        return <Requisition />;
      case 'report301':
        return <Report301 />;
      case 'reports':
        return <Reports />;
      case 'procurement':
        return <ProcurementPlan />;
      case 'purchase_request':
        return <PurchaseRequest />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'ภาพรวมระบบคลังเวชภัณฑ์', sub: 'สถิติและสถานะคลังเวชภัณฑ์ล่าสุดแบบเรียลไทม์' };
      case 'inventory':
        return { title: 'ระบบจัดการคลังเวชภัณฑ์ (ไม่ใช่ยา)', sub: 'อัปโหลดนำเข้า ควบคุมสต็อกคงคลังประจำเดือน และประวัติยกยอดสะสมข้ามปี' };
      case 'report301':
        return { title: 'รายงาน รบ.301 (บัญชีคุมรายตัว)', sub: 'แสดงรายละเอียดรายการเวชภัณฑ์และยอดคงเหลือรายตัว' };
      case 'reports':
        return { title: 'ระบบรายงานสรุปผล (GL)', sub: 'รายงานสรุปมูลค่าคงคลังประจำเดือนและประจำปี แยกตามหมวดหมู่' };
      case 'procurement':
        return { title: 'ระบบแผนประมาณการจัดซื้อ', sub: 'สร้างแผนจัดซื้อล่วงหน้ารายไตรมาส พร้อมระบบช่วยคำนวณจากสถิติย้อนหลัง' };
      case 'purchase_request':
        return { title: 'ระบบขออนุมัติจัดซื้อ (หน้า 2)', sub: 'สร้างแบบฟอร์มขออนุมัติในหลักการจัดซื้อ โดยดึงรายการจากแผนรายไตรมาส' };
      case 'settings':
        return { title: 'ตั้งค่าการเชื่อมต่อฐานข้อมูล HOSxP', sub: 'ปรับแต่งไอพี ชื่อฐานข้อมูล และบัญชีผู้ใช้สำหรับการเชื่อมต่อตรง' };
      default:
        return { title: 'แดชบอร์ดหลัก', sub: 'ภาพรวมข้อมูลสุขภาพ' };
    }
  };

  const headerInfo = getHeaderTitle();

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">H</div>
          <div className="sidebar-logo-text">Smart HOSxP</div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-header">ระบบภาพรวม</div>
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>แดชบอร์ด</span>
          </div>

          <div 
            className="nav-item nav-dropdown-toggle" 
            onClick={() => setIsInventoryMenuOpen(!isInventoryMenuOpen)}
            style={{ fontWeight: '600', color: isInventoryMenuOpen ? '#fff' : '#a3b3cc', marginBottom: '8px', marginTop: '16px' }}
          >
            <Boxes size={18} style={{ color: '#0fb97f' }} />
            <span style={{ flex: 1 }}>ระบบเวชภัณฑ์ไม่ใช่ยา</span>
            <ChevronDown size={16} style={{ transform: isInventoryMenuOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: '0.3s' }} />
          </div>

          <div className={`nav-submenu ${isInventoryMenuOpen ? 'open' : ''}`}>
            <div 
              className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <Package size={18} />
              <span>คลังเวชภัณฑ์ (ไม่ใช่ยา)</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'requisition' ? 'active' : ''}`}
              onClick={() => setActiveTab('requisition')}
            >
              <FileText size={18} />
              <span>เบิกเวชภัณฑ์</span>
            </div>
            
            <div 
              className={`nav-item ${activeTab === 'report301' ? 'active' : ''}`}
              onClick={() => setActiveTab('report301')}
            >
              <FileText size={18} />
              <span>รายงาน รบ.301 (บัญชีคุมรายตัว)</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'procurement' ? 'active' : ''}`}
              onClick={() => setActiveTab('procurement')}
            >
              <Calculator size={18} />
              <span>แผนประมาณการจัดซื้อ</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'purchase_request' ? 'active' : ''}`}
              onClick={() => setActiveTab('purchase_request')}
            >
              <FileSignature size={18} />
              <span>ขออนุมัติจัดซื้อ (หน้า 2)</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <FileBarChart size={18} />
              <span>รายงานสรุปผล (GL)</span>
            </div>
          </div>

          <div className="nav-group-header" style={{ marginTop: '24px' }}>ระบบจัดการ</div>
          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={18} />
            <span>ตั้งค่าการเชื่อมต่อ</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div>รพ.สต. บ้านหนองพัน</div>
          <div style={{ fontSize: '0.7rem', marginTop: '4px', color: '#475569' }}>Version 2.0 (Local App)</div>
        </div>
      </div>

      {/* Main Panel */}
      <main className="main-content">
        <header className="content-header">
          <div className="header-title">
            <h1>{headerInfo.title}</h1>
            <p>{headerInfo.sub}</p>
          </div>
          <div className="header-status-badge">
            <Calendar size={14} style={{ color: '#0fb97f' }} />
            <span>ข้อมูล ณ ปีงบประมาณ {new Date().getMonth() >= 9 ? new Date().getFullYear() + 544 : new Date().getFullYear() + 543}</span>
          </div>
        </header>

        {/* Dynamic Content */}
        {renderContent()}
      </main>
    </div>
  );
}
