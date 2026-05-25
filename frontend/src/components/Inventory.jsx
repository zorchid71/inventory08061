import React, { useState, useEffect } from 'react';
import { Search, Upload, Download, Edit, Save, AlertTriangle, CheckCircle, RefreshCw, Layers, Plus, Trash2, Database, ClipboardList, Printer } from 'lucide-react';
import InventoryTransactions from './InventoryTransactions';
import ReportPreview from './ReportPreview';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'master' | 'transactions'
  const API_BASE = window.location.port === '5173' ? 'http://localhost:5050' : '';

  const getCurrentThaiYearMonth = () => {
    const d = new Date();
    const currentYear = d.getFullYear();
    const currentMonth = d.getMonth() + 1;
    let currentFiscalYear = currentYear + 543;
    if (currentMonth >= 10) currentFiscalYear += 1;
    
    const monthsOrder = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const monthAbbr = monthsOrder[d.getMonth()];
    const yearShort = (currentYear + 543).toString().slice(-2);
    return {
      year: currentFiscalYear.toString(),
      month: `${monthAbbr}${yearShort}`
    };
  };

  const initialDate = getCurrentThaiYearMonth();

  // === MONTHLY STOCK STATE ===
  const [selectedYear, setSelectedYear] = useState(initialDate.year);
  const [availableYears, setAvailableYears] = useState([initialDate.year]);
  const [selectedMonth, setSelectedMonth] = useState(initialDate.month);
  const [monthlyItems, setMonthlyItems] = useState([]);
  const [monthlySearch, setMonthlySearch] = useState('');
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);

  // Monthly Edit Modal
  const [editingMonthlyItem, setEditingMonthlyItem] = useState(null);
  const [monthlyEditForm, setMonthlyEditForm] = useState({
    beginning_balance: 0,
    received_qty: 0,
    dispensed_qty: 0,
    unit_price: 0,
    expiry_date: '',
    editor_name: ''
  });

  // === MASTER ITEM CATALOG STATE ===
  const [masterItems, setMasterItems] = useState([]);
  const [masterSearch, setMasterSearch] = useState('');
  const [masterLoading, setMasterLoading] = useState(false);

  // Master Edit Modal
  const [editingMasterItem, setEditingMasterItem] = useState(null);
  const [masterEditForm, setMasterEditForm] = useState({
    id: null,
    name: '',
    unit: '',
    pack_size: '',
    unit_price: 0,
    min_stock: 10,
    report_category: 'เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์',
    expiry_date: '',
    editor_name: ''
  });
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [reportCategories, setReportCategories] = useState(['เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์']);

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`).then(res => res.json()).then(data => {
      if (data.report_categories && Array.isArray(data.report_categories)) {
        setReportCategories(data.report_categories);
      }
    }).catch(err => console.error("Error loading settings in Inventory:", err));
  }, []);

  const generateMonthsForYear = (fiscalYearStr) => {
    const fy = parseInt(fiscalYearStr) || 2569;
    const prevYearShort = (fy - 1).toString().slice(-2);
    const currYearShort = fy.toString().slice(-2);
    return [
      { name: `ต.ค.${prevYearShort}`, value: `ต.ค.${prevYearShort}` },
      { name: `พ.ย.${prevYearShort}`, value: `พ.ย.${prevYearShort}` },
      { name: `ธ.ค.${prevYearShort}`, value: `ธ.ค.${prevYearShort}` },
      { name: `ม.ค.${currYearShort}`, value: `ม.ค.${currYearShort}` },
      { name: `ก.พ.${currYearShort}`, value: `ก.พ.${currYearShort}` },
      { name: `มี.ค.${currYearShort}`, value: `มี.ค.${currYearShort}` },
      { name: `เม.ย.${currYearShort}`, value: `เม.ย.${currYearShort}` },
      { name: `พ.ค.${currYearShort}`, value: `พ.ค.${currYearShort}` },
      { name: `มิ.ย.${currYearShort}`, value: `มิ.ย.${currYearShort}` },
      { name: `ก.ค.${currYearShort}`, value: `ก.ค.${currYearShort}` },
      { name: `ส.ค.${currYearShort}`, value: `ส.ค.${currYearShort}` },
      { name: `ก.ย.${currYearShort}`, value: `ก.ย.${currYearShort}` }
    ];
  };

  const dynamicMonthsList = generateMonthsForYear(selectedYear);

  // === MONTHLY STOCK FUNCTIONS ===
  const fetchMonthlyInventory = async () => {
    setMonthlyLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/inventory/items?year=${selectedYear}&month=${selectedMonth}`);
      const data = await res.json();
      setMonthlyItems(data);
    } catch (err) {
      console.error("Error loading inventory items:", err);
    } finally {
      setMonthlyLoading(false);
    }
  };

  const fetchYears = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/years`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const strYears = data.map(String);
        setAvailableYears(strYears);
        if (!strYears.includes(selectedYear) && !strYears.includes(selectedYear.toString())) {
          setSelectedYear(strYears[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching years:", err);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    if (activeTab === 'monthly') fetchMonthlyInventory();
  }, [selectedYear, selectedMonth, activeTab]);

  useEffect(() => {
    const newMonths = generateMonthsForYear(selectedYear);
    const isValidMonth = newMonths.some(m => m.value === selectedMonth);
    if (!isValidMonth && newMonths.length > 0) {
      setSelectedMonth(newMonths[0].value);
    }
  }, [selectedYear]);

  const handleSaveMonthlyEdit = async () => {
    if (!editingMonthlyItem) return;
    if (!monthlyEditForm.editor_name || !monthlyEditForm.editor_name.trim()) {
      alert("กรุณาระบุชื่อผู้ดำเนินการ (ผู้แก้ไขข้อมูล)");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/inventory/update-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: editingMonthlyItem.item_id,
          fiscal_year: selectedYear,
          month_name: selectedMonth,
          ...monthlyEditForm
        })
      });

      if (res.ok) {
        setEditingMonthlyItem(null);
        fetchMonthlyInventory();
      } else {
        const err = await res.json();
        alert(`เกิดข้อผิดพลาด: ${err.error}`);
      }
    } catch (err) {
      console.error("Edit save error:", err);
    }
  };

  const openMonthlyEditModal = (item) => {
    setEditingMonthlyItem(item);
    setMonthlyEditForm({
      beginning_balance: item.beginning_balance || 0,
      received_qty: item.received_qty || 0,
      dispensed_qty: item.dispensed_qty || 0,
      unit_price: item.unit_price || 0,
      expiry_date: item.expiry_date || '',
      editor_name: ''
    });
  };

  const handleExportExcel = () => {
    window.open(`${API_BASE}/api/inventory/export?year=${selectedYear}&month=${selectedMonth}`, '_blank');
  };

  // === MASTER ITEM CATALOG FUNCTIONS ===
  const fetchMasterItems = async () => {
    setMasterLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/inventory/master-items`);
      const data = await res.json();
      setMasterItems(data);
    } catch (err) {
      console.error("Error loading master items:", err);
    } finally {
      setMasterLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'master') fetchMasterItems();
  }, [activeTab]);

  const handleSaveMasterEdit = async () => {
    if (!masterEditForm.name.trim()) {
      alert("กรุณาระบุชื่อเวชภัณฑ์");
      return;
    }
    if (!masterEditForm.editor_name || !masterEditForm.editor_name.trim()) {
      alert("กรุณาระบุชื่อผู้ดำเนินการ (ผู้แก้ไข/เพิ่มข้อมูล)");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/inventory/master-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(masterEditForm)
      });

      if (res.ok) {
        setIsMasterModalOpen(false);
        fetchMasterItems();
      } else {
        const err = await res.json();
        alert(`เกิดข้อผิดพลาด: ${err.error}`);
      }
    } catch (err) {
      console.error("Edit save error:", err);
    }
  };

  const handleDeleteMasterItem = async (id, name) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบเวชภัณฑ์: ${name} ?`)) return;
    const editor_name = window.prompt(`กรุณาระบุชื่อผู้ดำเนินการลบ สำหรับรายการ "${name}":`);
    if (!editor_name || editor_name.trim() === '') {
      alert("การลบถูกยกเลิก เนื่องจากไม่ได้ระบุชื่อผู้ดำเนินการ");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/inventory/master-items/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editor_name: editor_name.trim() })
      });
      if (res.ok) {
        fetchMasterItems();
      } else {
        const err = await res.json();
        alert(`เกิดข้อผิดพลาด: ${err.error}`);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleRestoreMasterItem = async (id, name) => {
    const editor_name = window.prompt(`กรุณาระบุชื่อผู้ดำเนินการกู้คืน สำหรับรายการ "${name}":\n(ต้องเป็นชื่อเดียวกับคนที่ลบ)`);
    if (!editor_name || editor_name.trim() === '') {
      alert("การกู้คืนถูกยกเลิก เนื่องจากไม่ได้ระบุชื่อผู้ดำเนินการ");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/inventory/master-items/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editor_name: editor_name.trim() })
      });
      if (res.ok) {
        alert("กู้คืนรายการสำเร็จ!");
        fetchMasterItems();
      } else {
        const err = await res.json();
        alert(`กู้คืนไม่สำเร็จ: ${err.error}`);
      }
    } catch (err) {
      console.error("Restore error:", err);
    }
  };

  const openMasterAddModal = () => {
    setEditingMasterItem(null);
    setMasterEditForm({ id: null, name: '', unit: '', pack_size: '', unit_price: 0, min_stock: 10, report_category: reportCategories[0] || 'เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์', expiry_date: '', editor_name: '' });
    setIsMasterModalOpen(true);
  };

  const openMasterEditModal = (item) => {
    setEditingMasterItem(item);
    setMasterEditForm({
      id: item.id,
      name: item.name,
      unit: item.unit || '',
      pack_size: item.pack_size || '',
      unit_price: item.unit_price || 0,
      min_stock: item.min_stock || 10,
      report_category: item.report_category || reportCategories[0] || 'เวชภัณฑ์มิใช่ยา-วัสดุการแพทย์',
      expiry_date: item.expiry_date || '',
      editor_name: ''
    });
    setIsMasterModalOpen(true);
  };

  // Computations
  const filteredMonthlyItems = monthlyItems.filter(item => 
    item.name.toLowerCase().includes(monthlySearch.toLowerCase())
  );
  const totalInventoryValue = filteredMonthlyItems.reduce((sum, item) => sum + (item.remaining_value || 0), 0);
  const totalReceivedValue = filteredMonthlyItems.reduce((sum, item) => sum + (item.received_value || 0), 0);
  const totalDispensedValue = filteredMonthlyItems.reduce((sum, item) => sum + (item.dispensed_value || 0), 0);

  const filteredMasterItems = masterItems.filter(item => 
    item.name.toLowerCase().includes(masterSearch.toLowerCase())
  ).sort((a, b) => {
    // 0 stock items go to the bottom
    const aStock = parseFloat(a.current_stock) || 0;
    const bStock = parseFloat(b.current_stock) || 0;
    if (aStock === 0 && bStock > 0) return 1;
    if (aStock > 0 && bStock === 0) return -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fade-in">
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button 
          className={`btn ${activeTab === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('monthly')}
          style={{ padding: '8px 16px', fontWeight: '600' }}
        >
          <Layers size={18} /> จัดการคลังประจำเดือน
        </button>
        <button 
          className={`btn ${activeTab === 'master' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('master')}
          style={{ padding: '8px 16px', fontWeight: '600', backgroundColor: activeTab === 'master' ? '#8b5cf6' : '', borderColor: activeTab === 'master' ? '#8b5cf6' : '', color: activeTab === 'master' ? 'white' : '' }}
        >
          <Database size={18} /> ทะเบียนเวชภัณฑ์หลัก (Master)
        </button>
        <button 
          className={`btn ${activeTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('transactions')}
          style={{ padding: '8px 16px', fontWeight: '600', backgroundColor: activeTab === 'transactions' ? '#10b981' : '', borderColor: activeTab === 'transactions' ? '#10b981' : '', color: activeTab === 'transactions' ? 'white' : '' }}
        >
          <ClipboardList size={18} /> บันทึกรับ-จ่าย (Transactions)
        </button>
      </div>

      {activeTab === 'monthly' ? (
        // === MONTHLY STOCK VIEW ===
        <>
          {/* Search section */}
          <div style={{ marginBottom: '24px' }}>
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} />
                <span>ค้นหาและเลือกเดือนคลังเวชภัณฑ์</span>
              </h3>
              <div className="filter-panel" style={{ padding: 0, border: 'none', boxShadow: 'none', margin: 0, gap: '12px' }}>
                <div className="filter-group">
                  <label>ปีงบประมาณ</label>
                  <select 
                    className="form-select" 
                    value={selectedYear} 
                    onChange={e => {
                      const newYear = e.target.value;
                      setSelectedYear(newYear);
                      const newMonthsList = generateMonthsForYear(newYear);
                      const currentIndex = dynamicMonthsList.findIndex(m => m.value === selectedMonth);
                      if (currentIndex >= 0) {
                        setSelectedMonth(newMonthsList[currentIndex].value);
                      } else {
                        setSelectedMonth(newMonthsList[0].value);
                      }
                    }}
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y}>ปีงบประมาณ {y}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>ประจำเดือนคลัง</label>
                  <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                    {dynamicMonthsList.map(m => (
                      <option key={m.value} value={m.value}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group" style={{ minWidth: '220px' }}>
                  <label>ค้นหาชื่อเวชภัณฑ์</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ paddingLeft: '36px' }}
                      placeholder="พิมพ์คำค้นหา..." 
                      value={monthlySearch}
                      onChange={e => setMonthlySearch(e.target.value)}
                    />
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '24px' }}>
            <div className="glass-card metric-card primary" style={{ padding: '20px' }}>
              <span className="metric-title">มูลค่าคลังเวชภัณฑ์คงเหลือ</span>
              <div className="metric-value" style={{ color: '#3b82f6', fontSize: '1.8rem', marginTop: '6px' }}>
                ฿{totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <span className="metric-sub">คงยอดรวม ณ สิ้นเดือน {selectedMonth}</span>
            </div>

            <div className="glass-card metric-card success" style={{ padding: '20px' }}>
              <span className="metric-title">มูลค่าการรับใหม่</span>
              <div className="metric-value" style={{ color: '#10b981', fontSize: '1.8rem', marginTop: '6px' }}>
                ฿{totalReceivedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <span className="metric-sub">ยอดเวชภัณฑ์ที่นำเข้ามาเพิ่มในคลัง</span>
            </div>

            <div className="glass-card metric-card danger" style={{ padding: '20px' }}>
              <span className="metric-title">มูลค่าการจ่ายออก (เบิก)</span>
              <div className="metric-value" style={{ color: '#ef4444', fontSize: '1.8rem', marginTop: '6px' }}>
                ฿{totalDispensedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <span className="metric-sub">มูลค่าเวชภัณฑ์ที่ถูกนำไปใช้ในบริการ</span>
            </div>
          </div>

          {/* Main Stock Table */}
          <div className="table-container">
            <div className="table-header">
              <div className="table-title">ตารางควบคุมปริมาณเวชภัณฑ์คงคลัง (พบ {filteredMonthlyItems.length} รายการ)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={fetchMonthlyInventory} disabled={monthlyLoading}>
                  <RefreshCw size={16} /> รีเฟรช
                </button>
                <button className="btn btn-primary" onClick={() => setShowReportPreview(true)} disabled={monthlyItems.length === 0}>
                  <Printer size={16} /> ดูรายงานสรุป (Print Preview)
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fcfdfe' }}>
                    <th style={{ padding: '12px 16px' }}>ชื่อเวชภัณฑ์ (ไม่ใช่ยา)</th>
                    <th style={{ padding: '12px 16px' }}>หน่วย</th>
                    <th style={{ padding: '12px 16px' }}>ขนาดบรรจุ</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>ราคา/หน่วย</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>ยอดยกมา</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>รับเพิ่ม</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>จ่ายออก</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>คงเหลือ</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>มูลค่าคลัง</th>
                    <th style={{ padding: '12px 16px' }}>วันหมดอายุ</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>แก้ไข</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyLoading ? (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                        กำลังดาวน์โหลดข้อมูลสต็อกคลัง...
                      </td>
                    </tr>
                  ) : filteredMonthlyItems.length === 0 ? (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                        ไม่มีข้อมูลเวชภัณฑ์คงเหลือในเดือนนี้
                      </td>
                    </tr>
                  ) : (
                    filteredMonthlyItems.map(row => {
                      const isLowStock = row.remaining_qty <= row.min_stock;
                      return (
                        <tr key={row.item_id}>
                          <td style={{ fontWeight: '600', padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isLowStock && <AlertTriangle size={14} color="#ef4444" title={`จำนวนสินค้าต่ำกว่าจุดเตือน (${row.min_stock})`} />}
                              <span>{row.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>{row.unit}</td>
                          <td style={{ padding: '12px 16px' }}>{row.pack_size}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>฿{row.unit_price}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>{row.beginning_balance}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981' }}>{row.received_qty}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444' }}>{row.dispensed_qty}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: isLowStock ? '#ef4444' : '#0f172a' }}>
                            {row.remaining_qty}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>
                            ฿{row.remaining_value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{row.expiry_date || '-'}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button 
                              className="btn" 
                              style={{ padding: '4px 8px', color: '#3b82f6', background: 'none' }}
                              onClick={() => openMonthlyEditModal(row)}
                            >
                              <Edit size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MONTHLY ADJUSTMENT MODAL */}
          {editingMonthlyItem && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
              <div style={{ background: 'white', width: '90%', maxWidth: '500px', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#0fb97f', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>
                    ปรับปรุงยอดสต็อก: {editingMonthlyItem.name}
                  </h3>
                  <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', fontWeight: '600' }} onClick={() => setEditingMonthlyItem(null)}>
                    &times;
                  </button>
                </div>
                
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="filter-group">
                      <label>ราคาต่อหน่วย</label>
                      <input type="number" className="form-control" value={monthlyEditForm.unit_price} onChange={e => setMonthlyEditForm({ ...monthlyEditForm, unit_price: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="filter-group">
                      <label>ยอดยกมา</label>
                      <input type="number" className="form-control" value={monthlyEditForm.beginning_balance} onChange={e => setMonthlyEditForm({ ...monthlyEditForm, beginning_balance: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="filter-group">
                      <label>รับใหม่ (เพิ่ม)</label>
                      <input type="number" className="form-control" style={{ borderColor: '#10b981' }} value={monthlyEditForm.received_qty} onChange={e => setMonthlyEditForm({ ...monthlyEditForm, received_qty: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="filter-group">
                      <label>จ่ายออก (เบิก)</label>
                      <input type="number" className="form-control" style={{ borderColor: '#ef4444' }} value={monthlyEditForm.dispensed_qty} onChange={e => setMonthlyEditForm({ ...monthlyEditForm, dispensed_qty: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>

                  <div className="filter-group">
                    <label>วันหมดอายุ (ถ้ามี)</label>
                    <input type="text" className="form-control" placeholder="เช่น 30 ก.ย.69" value={monthlyEditForm.expiry_date} onChange={e => setMonthlyEditForm({ ...monthlyEditForm, expiry_date: e.target.value })} />
                  </div>

                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '600' }}>สรุปยอดคงเหลือคำนวณ:</span>{' '}
                    <span style={{ fontWeight: '700', color: '#0fb97f' }}>
                      {monthlyEditForm.beginning_balance + monthlyEditForm.received_qty - monthlyEditForm.dispensed_qty}
                    </span>{' '}
                    หน่วย (มูลค่า ฿
                    {((monthlyEditForm.beginning_balance + monthlyEditForm.received_qty - monthlyEditForm.dispensed_qty) * monthlyEditForm.unit_price).toLocaleString()}
                    )
                  </div>

                  <div className="filter-group" style={{ marginTop: '10px' }}>
                    <label>ชื่อผู้ดำเนินการ (ผู้แก้ไขข้อมูล) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="form-control" value={monthlyEditForm.editor_name} onChange={e => setMonthlyEditForm({ ...monthlyEditForm, editor_name: e.target.value })} placeholder="ระบุชื่อของคุณ..." style={{ borderColor: '#0fb97f' }} />
                  </div>
                </div>

                <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => setEditingMonthlyItem(null)}>ยกเลิก</button>
                  <button className="btn btn-primary" onClick={handleSaveMonthlyEdit}>
                    <Save size={16} /> บันทึกข้อมูล
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'master' ? (
        // === MASTER CATALOG VIEW ===
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Search section */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} />
              <span>ทะเบียนเวชภัณฑ์หลัก (Master Data)</span>
            </h3>
            
            <div className="filter-group" style={{ maxWidth: '400px' }}>
              <label>ค้นหาชื่อเวชภัณฑ์ในระบบ</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ paddingLeft: '36px' }}
                  placeholder="พิมพ์ค้นหารายการ..." 
                  value={masterSearch}
                  onChange={e => setMasterSearch(e.target.value)}
                />
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
              </div>
            </div>
          </div>

          <div className="table-container">
            <div className="table-header">
              <div className="table-title" style={{ color: '#6d28d9' }}>รายการทะเบียนเวชภัณฑ์หลักทั้งหมด (พบ {filteredMasterItems.length} รายการ)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={fetchMasterItems} disabled={masterLoading}>
                  <RefreshCw size={16} /> รีเฟรช
                </button>
                <button className="btn btn-primary" onClick={openMasterAddModal} style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}>
                  <Plus size={16} /> เพิ่มเวชภัณฑ์ใหม่
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f3ff' }}>
                    <th style={{ padding: '12px 16px', color: '#5b21b6' }}>ชื่อเวชภัณฑ์ (ไม่ใช่ยา)</th>
                    <th style={{ padding: '12px 16px', color: '#5b21b6' }}>หน่วยนับ</th>
                    <th style={{ padding: '12px 16px', color: '#5b21b6' }}>ขนาดบรรจุ</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#5b21b6' }}>ราคามาตรฐาน/หน่วย</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: '#5b21b6' }}>วันหมดอายุ (EXP)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#5b21b6' }}>คงเหลือล่าสุด</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#5b21b6' }}>จุดเตือน (Min)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: '#5b21b6' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {masterLoading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                        กำลังดาวน์โหลดข้อมูลทะเบียนเวชภัณฑ์...
                      </td>
                    </tr>
                  ) : filteredMasterItems.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                        ไม่พบข้อมูลทะเบียนเวชภัณฑ์หลัก กรุณาเพิ่มใหม่หรือนำเข้าจากไฟล์ Excel
                      </td>
                    </tr>
                  ) : (
                    filteredMasterItems.map(row => (
                      <tr key={row.id} style={{ opacity: row.is_active === 0 ? 0.5 : 1, background: row.is_active === 0 ? '#f1f5f9' : 'transparent' }}>
                        <td style={{ fontWeight: '600', padding: '12px 16px', textDecoration: row.is_active === 0 ? 'line-through' : 'none' }}>
                          {row.name}
                          {row.is_active === 0 && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#ef4444', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block' }}>ถูกลบโดย {row.deleted_by || 'Unknown'}</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{row.unit || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{row.pack_size || '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>฿{row.unit_price}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {row.expiry_date ? (
                            <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {row.expiry_date}
                            </span>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: parseFloat(row.current_stock) === 0 ? '#ef4444' : '#10b981' }}>{row.current_stock || 0}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444' }}>{row.min_stock}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            {row.is_active === 0 ? (
                              <button className="btn" style={{ padding: '4px 8px', color: '#10b981', background: 'none', border: '1px solid #10b981' }} onClick={() => handleRestoreMasterItem(row.id, row.name)} title="กู้คืนรายการ (Restore)">
                                กู้คืน
                              </button>
                            ) : (
                              <>
                                <button className="btn" style={{ padding: '4px 8px', color: '#8b5cf6', background: 'none' }} onClick={() => openMasterEditModal(row)} title="แก้ไข">
                                  <Edit size={16} />
                                </button>
                                <button className="btn" style={{ padding: '4px 8px', color: '#ef4444', background: 'none' }} onClick={() => handleDeleteMasterItem(row.id, row.name)} title="ลบ">
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MASTER ADD/EDIT MODAL */}
          {isMasterModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
              <div style={{ background: 'white', width: '90%', maxWidth: '500px', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#8b5cf6', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>
                    {editingMasterItem ? 'แก้ไขทะเบียนเวชภัณฑ์' : 'เพิ่มทะเบียนเวชภัณฑ์ใหม่'}
                  </h3>
                  <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', fontWeight: '600' }} onClick={() => setIsMasterModalOpen(false)}>
                    &times;
                  </button>
                </div>
                
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="filter-group">
                    <label>ชื่อเวชภัณฑ์ <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="form-control" value={masterEditForm.name} onChange={e => setMasterEditForm({ ...masterEditForm, name: e.target.value })} placeholder="ระบุชื่อเวชภัณฑ์..." />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="filter-group">
                      <label>หน่วยนับ</label>
                      <input type="text" className="form-control" value={masterEditForm.unit} onChange={e => setMasterEditForm({ ...masterEditForm, unit: e.target.value })} placeholder="เช่น ชิ้น, กล่อง, แผง" />
                    </div>
                    <div className="filter-group">
                      <label>ขนาดบรรจุ</label>
                      <input type="text" className="form-control" value={masterEditForm.pack_size} onChange={e => setMasterEditForm({ ...masterEditForm, pack_size: e.target.value })} placeholder="เช่น 100 ชิ้น/กล่อง" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="filter-group">
                      <label>ราคามาตรฐานต่อหน่วย</label>
                      <input type="number" className="form-control" value={masterEditForm.unit_price} onChange={e => setMasterEditForm({ ...masterEditForm, unit_price: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="filter-group">
                      <label>วันหมดอายุ (EXP)</label>
                      <input type="text" className="form-control" value={masterEditForm.expiry_date} onChange={e => setMasterEditForm({ ...masterEditForm, expiry_date: e.target.value })} placeholder="เช่น 30 ก.ย.69" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="filter-group">
                      <label>จุดเตือนสั่งซื้อ (Min Stock)</label>
                      <input type="number" className="form-control" style={{ borderColor: '#ef4444' }} value={masterEditForm.min_stock} onChange={e => setMasterEditForm({ ...masterEditForm, min_stock: parseInt(e.target.value) || 0 })} />
                    </div>
                    <label>หมวดหมู่รายงาน (GL Report Category)</label>
                    <select className="form-select" value={masterEditForm.report_category} onChange={e => setMasterEditForm({ ...masterEditForm, report_category: e.target.value })}>
                      {reportCategories.map((cat, idx) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group" style={{ marginTop: '10px' }}>
                    <label>ชื่อผู้ดำเนินการ (ผู้แก้ไข/เพิ่มข้อมูล) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" className="form-control" value={masterEditForm.editor_name} onChange={e => setMasterEditForm({ ...masterEditForm, editor_name: e.target.value })} placeholder="ระบุชื่อของคุณ..." style={{ borderColor: '#8b5cf6' }} />
                  </div>
                </div>

                <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => setIsMasterModalOpen(false)}>ยกเลิก</button>
                  <button className="btn btn-primary" onClick={handleSaveMasterEdit} style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}>
                    <Save size={16} /> บันทึกข้อมูล
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'transactions' ? (
        // === TRANSACTIONS VIEW ===
        <InventoryTransactions />
      ) : null}

      {/* REPORT PREVIEW MODAL */}
      {showReportPreview && (
        <ReportPreview 
          items={filteredMonthlyItems} 
          month={selectedMonth} 
          year={selectedYear} 
          onClose={() => setShowReportPreview(false)} 
          onExport={handleExportExcel} 
        />
      )}
    </div>
  );
}
