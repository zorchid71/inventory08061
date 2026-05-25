import React, { useState, useEffect } from 'react';
import { FileText, Printer, Plus, Trash2, Download, Save, ArrowLeft, Eye } from 'lucide-react';

export default function PurchaseRequest() {
  const currentFiscalYear = new Date().getFullYear() + 543 + (new Date().getMonth() >= 9 ? 1 : 0);
  const API_BASE = window.location.port === '5173' ? 'http://localhost:5050' : '';

  const [view, setView] = useState('list'); // 'list', 'create', 'print'
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [selectedYear, setSelectedYear] = useState(currentFiscalYear.toString());
  const [selectedQuarter, setSelectedQuarter] = useState('1');
  const [items, setItems] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [docDate, setDocDate] = useState('');
  const [docNo, setDocNo] = useState('');

  // Print State
  const [printData, setPrintData] = useState(null);

  useEffect(() => {
    if (view === 'list') {
      fetchRequests();
    } else if (view === 'create') {
      fetchMasterItems();
    }
  }, [view]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/purchase_requests`);
      const data = await res.json();
      setRequests(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterItems = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/master-items`);
      const data = await res.json();
      setMasterItems(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadFromPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/procurement/plan?year=${selectedYear}`);
      const json = await res.json();
      const planItems = json.items || [];
      
      const qKey = `q${selectedQuarter}_qty`;
      const filtered = planItems.filter(i => i[qKey] > 0).map(i => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        unit_price: i.unit_price,
        req_qty: i[qKey]
      }));
      
      setItems(filtered);
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถดึงข้อมูลแผนจัดซื้อได้");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (idx) => {
    const newItems = [...items];
    newItems.splice(idx, 1);
    setItems(newItems);
  };

  const handleQtyChange = (idx, val) => {
    const newItems = [...items];
    newItems[idx].req_qty = parseFloat(val) || 0;
    setItems(newItems);
  };

  const handleAddItem = (e) => {
    const itemId = parseInt(e.target.value);
    if (!itemId) return;
    
    const masterItem = masterItems.find(i => i.id === itemId);
    if (masterItem) {
      if (!items.find(i => i.id === itemId)) {
        setItems([...items, {
          id: masterItem.id,
          name: masterItem.name,
          unit: masterItem.unit,
          unit_price: masterItem.unit_price,
          req_qty: 1
        }]);
      }
    }
    e.target.value = ""; 
  };

  const handleSave = async () => {
    if (!docDate) {
      alert("กรุณาระบุ วันที่ลงรับ/วันที่ขออนุมัติ");
      return;
    }
    if (items.length === 0) {
      alert("กรุณาเพิ่มรายการเวชภัณฑ์อย่างน้อย 1 รายการ");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/purchase_requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_no: docNo,
          doc_date: docDate,
          items: items.map(i => ({ id: i.id, qty: i.req_qty, unit_price: i.unit_price }))
        })
      });

      if (res.ok) {
        alert("บันทึกใบขออนุมัติจัดซื้อสำเร็จ");
        setView('list');
        // reset form
        setItems([]);
        setDocNo('');
        setDocDate('');
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถบันทึกได้");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("คุณต้องการลบประวัติใบขอซื้อนี้ใช่หรือไม่?")) return;
    try {
      await fetch(`${API_BASE}/api/purchase_requests/${id}`, { method: 'DELETE' });
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/purchase_requests/${id}`);
      const data = await res.json();
      setPrintData({ ...data, is_preview: false });
      setView('print');
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถดึงข้อมูลเพื่อพิมพ์ได้");
    }
  };

  const handlePreview = () => {
    // Generate printData from current form state
    const currentTotal = items.reduce((sum, item) => sum + (item.req_qty * item.unit_price), 0);
    setPrintData({
      is_preview: true,
      doc_no: docNo,
      doc_date: docDate,
      total_amount: currentTotal,
      items: items.map(i => ({ name: i.name, qty: i.req_qty, unit: i.unit, unit_price: i.unit_price }))
    });
    setView('print');
  };

  const executePrint = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // RENDER VIEWS
  // -------------------------------------------------------------

  if (view === 'print' && printData) {
    const pItems = printData.items || [];
    const grandTotal = printData.total_amount || 0;

    return (
      <div className="fade-in">
        <div className="glass-card print-hide" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-secondary" onClick={() => setView(printData.is_preview ? 'create' : 'list')}>
            <ArrowLeft size={16} /> กลับหน้า{printData.is_preview ? 'บันทึก' : 'รายการ'}
          </button>
          <button className="btn btn-primary" onClick={executePrint} style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>
            <Printer size={16} /> พิมพ์แบบฟอร์ม
          </button>
        </div>

        <div className="report-print-container" style={{ background: 'white', padding: '40px 60px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', color: 'black', fontFamily: '"Sarabun", "TH Sarabun New", sans-serif' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              รายการจัดซื้อยาและเวชภัณฑ์มิใช่ยา จํานวน {pItems.length} รายการ ดังนี้
            </h2>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.1rem' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', width: '60px' }}>ลําดับที่</th>
                <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>รายการ</th>
                <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', width: '100px' }}>จํานวน</th>
                <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', width: '100px' }}>หน่วย</th>
                <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', width: '120px' }}>ราคา/หน่วย</th>
                <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', width: '120px' }}>ราคารวม</th>
              </tr>
            </thead>
            <tbody>
              {pItems.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>{row.name}</td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{row.qty}</td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{row.unit || '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{row.unit_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>{(row.qty * row.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
              
              <tr style={{ fontWeight: 'bold' }}>
                <td colSpan="5" style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>รวมทั้งสิ้น</td>
                <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>
                  {grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
              </tr>
            </tbody>
          </table>

          {printData.doc_date && (
            <div style={{ marginTop: '40px', fontSize: '1.1rem' }}>
              ลงรับ {printData.doc_date}
            </div>
          )}
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: portrait; margin: 15mm; }
            body * { visibility: hidden; }
            .report-print-container, .report-print-container * { visibility: visible; }
            .report-print-container {
              position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-shadow: none;
            }
            .print-hide { display: none !important; }
          }
        `}} />
      </div>
    );
  }

  if (view === 'create') {
    const currentTotal = items.reduce((sum, item) => sum + (item.req_qty * item.unit_price), 0);

    return (
      <div className="fade-in" style={{ paddingBottom: '40px' }}>
        <div className="glass-card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <FileText size={20} style={{ color: '#d946ef' }} />
                <span>บันทึกใบขออนุมัติจัดซื้อ (ใหม่)</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                ดึงรายการจากแผนไตรมาส หรือเลือกรายการเอง เพื่อสร้างและบันทึกประวัติใบขอซื้อ
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setView('list')}>
                <ArrowLeft size={16} /> ยกเลิก
              </button>
              <button className="btn btn-secondary" onClick={handlePreview} style={{ backgroundColor: '#fdf4ff', color: '#d946ef', borderColor: '#f0abfc' }}>
                <Eye size={16} /> ดูตัวอย่างหน้า 2
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{ backgroundColor: '#d946ef', borderColor: '#d946ef' }}>
                <Save size={16} /> บันทึกประวัติใบขอซื้อ
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div className="filter-group">
              <label>เลขที่เอกสาร (ถ้ามี)</label>
              <input type="text" className="form-control" value={docNo} onChange={e => setDocNo(e.target.value)} placeholder="เช่น กจ ๕๑๐..." />
            </div>
            <div className="filter-group">
              <label>วันที่ลงรับ / ขออนุมัติ <span style={{color:'red'}}>*</span></label>
              <input type="text" className="form-control" value={docDate} onChange={e => setDocDate(e.target.value)} placeholder="เช่น 18 ธค.66" />
            </div>
          </div>

          <div style={{ padding: '16px', background: '#fdf4ff', borderRadius: '10px', border: '1px solid #fae8ff', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="filter-group" style={{ flex: 1 }}>
              <label style={{ color: '#86198f', fontWeight: '600' }}>ตัวช่วย: ดึงรายการจากแผนอัตโนมัติ</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="number" className="form-control" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ width: '80px' }} placeholder="ปี" />
                <select className="form-control" value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} style={{ width: '100px' }}>
                  <option value="1">ไตรมาส 1</option>
                  <option value="2">ไตรมาส 2</option>
                  <option value="3">ไตรมาส 3</option>
                  <option value="4">ไตรมาส 4</option>
                </select>
                <button className="btn btn-secondary" onClick={loadFromPlan} disabled={loading} style={{ backgroundColor: 'white', color: '#d946ef', borderColor: '#f0abfc' }}>
                  <Download size={16} /> ดึงข้อมูล
                </button>
              </div>
            </div>

            <div className="filter-group" style={{ flex: 1, minWidth: '300px' }}>
              <label style={{ color: '#0f172a', fontWeight: '600' }}>หรือ พิมพ์เลือกรายการเองทีละตัว</label>
              <select className="form-control" onChange={handleAddItem} defaultValue="" style={{ width: '100%' }}>
                <option value="" disabled>-- ค้นหาและเลือกเวชภัณฑ์ --</option>
                {masterItems.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ลําดับ</th>
                <th>รายการเวชภัณฑ์</th>
                <th style={{ width: '100px' }}>จํานวน</th>
                <th style={{ width: '100px' }}>หน่วย</th>
                <th style={{ width: '120px', textAlign: 'right' }}>ราคา/หน่วย</th>
                <th style={{ width: '120px', textAlign: 'right' }}>ราคารวม</th>
                <th style={{ width: '60px', textAlign: 'center' }}>ลบ</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>ยังไม่มีรายการจัดซื้อ โปรดดึงข้อมูลจากแผน หรือเลือกเพิ่มรายการเอง</td></tr>
              ) : (
                items.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{row.name}</td>
                    <td>
                      <input 
                        type="number" 
                        value={row.req_qty} 
                        onChange={e => handleQtyChange(idx, e.target.value)}
                        className="form-control"
                        style={{ width: '100%', textAlign: 'center', padding: '4px' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>{row.unit || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{row.unit_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ textAlign: 'right', fontWeight: '500' }}>{(row.req_qty * row.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn" style={{ padding: '4px', color: '#ef4444' }} onClick={() => handleRemove(idx)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {items.length > 0 && (
                <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                  <td colSpan="5" style={{ textAlign: 'right', padding: '12px' }}>ยอดรวมทั้งสิ้น</td>
                  <td style={{ textAlign: 'right', padding: '12px', color: '#0f172a' }}>
                    {currentTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // DEFAULT VIEW: LIST
  return (
    <div className="fade-in">
      <div className="glass-card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} style={{ color: '#d946ef' }} />
            ประวัติแบบฟอร์มขออนุมัติจัดซื้อ
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
            ประวัติการทำรายการขออนุมัติจัดซื้อ สามารถดูย้อนหลังและสั่งพิมพ์ได้
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setView('create')} style={{ backgroundColor: '#d946ef', borderColor: '#d946ef' }}>
          <Plus size={16} /> สร้างใบขอซื้อใหม่
        </button>
      </div>

      <div className="glass-card" style={{ padding: '0' }}>
        {loading && requests.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>ยังไม่มีประวัติการทำรายการใบขออนุมัติจัดซื้อ</div>
        ) : (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '80px', textAlign: 'center' }}>ID</th>
                <th>วันที่ลงรับ/ขออนุมัติ</th>
                <th>เลขที่เอกสาร</th>
                <th>วันที่บันทึก (System Date)</th>
                <th style={{ textAlign: 'right' }}>ยอดเงินรวม (บาท)</th>
                <th style={{ width: '160px', textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td style={{ textAlign: 'center', color: '#64748b' }}>#{r.id}</td>
                  <td style={{ fontWeight: '500' }}>{r.doc_date}</td>
                  <td>{r.doc_no || '-'}</td>
                  <td style={{ color: '#64748b', fontSize: '0.9em' }}>{new Date(r.created_at).toLocaleString('th-TH')}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                    {r.total_amount ? r.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.85rem' }} onClick={() => handlePrint(r.id)}>
                        <Printer size={14} style={{ marginRight: '4px' }} /> พิมพ์หน้า 2
                      </button>
                      <button className="btn" style={{ padding: '4px', color: '#ef4444' }} onClick={() => handleDelete(r.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
