import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, ArrowLeft, Printer, Search, PlusCircle, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

export default function Requisition() {
  const [view, setView] = useState('list'); // 'list', 'create', 'print'
  const [requisitions, setRequisitions] = useState([]);
  const [items, setItems] = useState([]); // Master items
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentReq, setCurrentReq] = useState(null); // For print view
  const [transactionIds, setTransactionIds] = useState([]);

  // Form State
  const [reqNumber, setReqNumber] = useState('');
  const [reqDate, setReqDate] = useState('');
  const [purpose, setPurpose] = useState('เพื่อใช้ในการบริการส่งเสริม ป้องกัน รักษา และฟื้นฟู');
  const [reqDirector, setReqDirector] = useState('');
  const [reqDispenser, setReqDispenser] = useState('');
  const [reqRequisitioner, setReqRequisitioner] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); // { item_id, item_name, unit, qty }

  const API_BASE = window.location.port === '5173' ? 'http://localhost:5050' : '';
  const printRef = useRef();

  useEffect(() => {
    fetchRequisitions();
    fetchSettings();
    fetchMasterItems();
  }, []);

  const fetchRequisitions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/requisitions`);
      const data = await res.json();
      setRequisitions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMasterItems = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/master-items`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNew = async () => {
    // Fetch next number
    try {
      const res = await fetch(`${API_BASE}/api/requisitions/next-number`);
      const data = await res.json();
      setReqNumber(data.req_number || '');
    } catch (err) {
      setReqNumber('001/2569');
    }

    const today = new Date().toISOString().split('T')[0];
    setReqDate(today);
    setReqDirector(settings.req_director || '');
    setReqDispenser(settings.req_dispenser || '');
    setReqRequisitioner(settings.req_requisitioner || '');
    setSelectedItems([]);
    setTransactionIds([]);
    setView('create');
  };

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { item_id: '', item_name: '', unit: '', requested_qty: 1 }]);
  };

  const handleItemTextChange = (index, value) => {
    const newItems = [...selectedItems];
    newItems[index].item_name = value;
    
    // Auto-fill ID and unit if matched
    const item = items.find(i => i.name === value);
    if (item) {
      newItems[index].item_id = item.id;
      newItems[index].unit = item.unit;
    } else {
      newItems[index].item_id = '';
      newItems[index].unit = '';
    }
    setSelectedItems(newItems);
  };

  const handleRemoveItem = (index) => {
    const newItems = [...selectedItems];
    newItems.splice(index, 1);
    setSelectedItems(newItems);
  };

  const handlePreview = () => {
    if (selectedItems.length === 0 || !selectedItems[0].item_name) {
      alert("กรุณาเพิ่มเวชภัณฑ์อย่างน้อย 1 รายการ");
      return;
    }
    
    const invalidItem = selectedItems.find(i => !i.item_id);
    if (invalidItem) {
      alert("มีรายการเวชภัณฑ์ที่ไม่ถูกต้อง (กรุณาเลือกจากรายการที่ค้นหาเจอเท่านั้น)");
      return;
    }

    const mockReq = {
      req_number: reqNumber,
      req_date: reqDate,
      purpose: purpose,
      director_name: reqDirector,
      dispenser_name: reqDispenser,
      requisitioner_name: reqRequisitioner,
      items: selectedItems
    };
    setCurrentReq(mockReq);
    setView('preview');
  };

  const handleSubmit = async () => {

    setLoading(true);
    try {
      const payload = {
        req_number: reqNumber,
        req_date: reqDate,
        purpose: purpose,
        director_name: reqDirector,
        dispenser_name: reqDispenser,
        requisitioner_name: reqRequisitioner,
        items: selectedItems.map(i => ({ item_id: i.item_id, requested_qty: i.requested_qty })),
        transaction_ids: transactionIds
      };

      const res = await fetch(`${API_BASE}/api/requisitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert("บันทึกใบเบิกสำเร็จ!");
        fetchRequisitions();
        // Go to print view after saving
        setCurrentReq({
          ...payload,
          items: selectedItems
        });
        setView('print');
      } else {
        alert("เกิดข้อผิดพลาด: " + data.error);
      }
    } catch (err) {
      alert("เชื่อมต่อขัดข้อง: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const openPrintView = (req) => {
    setCurrentReq(req);
    setView('print');
  };

  const formatDateThai = (isoDate) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  };

  return (
    <div className="fade-in">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'hsl(var(--primary))', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={24} />
            ระบบเบิกเวชภัณฑ์
          </h2>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            จัดการประวัติการเบิกและพิมพ์ใบเบิกเวชภัณฑ์
          </p>
        </div>
        
        {view === 'list' && (
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={18} />
            สร้างใบเบิกใหม่
          </button>
        )}
        {(view === 'create' || view === 'print') && (
          <button className="btn btn-secondary" onClick={() => setView('list')}>
            <ArrowLeft size={18} />
            กลับไปหน้ารวม
          </button>
        )}
      </div>

      {/* VIEW: LIST */}
      {view === 'list' && (
        <div className="glass-card">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', color: '#64748b' }}>วันที่เบิก</th>
                <th style={{ padding: '12px 16px', color: '#64748b' }}>เลขที่ใบเบิก</th>
                <th style={{ padding: '12px 16px', color: '#64748b' }}>ผู้เบิก</th>
                <th style={{ padding: '12px 16px', color: '#64748b' }}>รายการ</th>
                <th style={{ padding: '12px 16px', color: '#64748b' }}>สถานะ</th>
                <th style={{ padding: '12px 16px', color: '#64748b', textAlign: 'right' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>{formatDateThai(req.req_date)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600' }}>{req.req_number}</td>
                  <td style={{ padding: '12px 16px' }}>{req.requisitioner_name}</td>
                  <td style={{ padding: '12px 16px' }}>{req.items?.length || 0} รายการ</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => openPrintView(req)}>
                      <Printer size={14} />
                      พิมพ์
                    </button>
                  </td>
                </tr>
              ))}
              {requisitions.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                    ยังไม่มีประวัติการเบิก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW: CREATE */}
      {view === 'create' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0' }}>สร้างใบเบิกเวชภัณฑ์ใหม่</h3>
            <button 
              type="button" 
              className="btn" 
              style={{ backgroundColor: '#10b981', color: '#fff' }}
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/api/requisitions/unbilled`);
                  const data = await res.json();
                  if (!data || data.length === 0) {
                    alert('ไม่มีรายการจ่ายออกที่ค้างอยู่ (ทุกรายการถูกนำไปทำใบเบิกหมดแล้ว)');
                    return;
                  }
                  const grouped = {};
                  const txIds = [];
                  data.forEach(tx => {
                    txIds.push(tx.id);
                    if (grouped[tx.item_id]) {
                      grouped[tx.item_id].requested_qty += tx.quantity;
                    } else {
                      grouped[tx.item_id] = {
                        item_id: tx.item_id,
                        item_name: tx.item_name,
                        unit: tx.unit,
                        requested_qty: tx.quantity
                      };
                    }
                  });
                  setSelectedItems(Object.values(grouped));
                  setTransactionIds(txIds);
                  alert(`ดึงข้อมูลสำเร็จ! พบรายการจ่ายออกที่ค้างอยู่ ${data.length} รายการ (จัดกลุ่มรวมเป็น ${Object.keys(grouped).length} เวชภัณฑ์)`);
                } catch (err) {
                  alert('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + err.message);
                }
              }}
            >
              ดึงรายการเบิกรายวันที่ยังไม่ทำบิล
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div className="filter-group">
              <label>เลขที่ใบเบิก</label>
              <input type="text" className="form-control" value={reqNumber} onChange={e => setReqNumber(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>วันที่เบิก</label>
              <input type="date" className="form-control" value={reqDate} onChange={e => setReqDate(e.target.value)} />
            </div>
            <div className="filter-group" style={{ gridColumn: '1 / -1' }}>
              <label>วัตถุประสงค์</label>
              <input type="text" className="form-control" value={purpose} onChange={e => setPurpose(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>ชื่อผู้เบิก</label>
              <input type="text" className="form-control" value={reqRequisitioner} onChange={e => setReqRequisitioner(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>ชื่อผู้จ่าย</label>
              <input type="text" className="form-control" value={reqDispenser} onChange={e => setReqDispenser(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>ชื่อผู้อนุมัติ</label>
              <input type="text" className="form-control" value={reqDirector} onChange={e => setReqDirector(e.target.value)} />
            </div>
          </div>

          <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>รายการเวชภัณฑ์</h4>
          
          <table style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '8px', textAlign: 'left', width: '5%' }}>ลำดับ</th>
                <th style={{ padding: '8px', textAlign: 'left', width: '55%' }}>รายการเวชภัณฑ์</th>
                <th style={{ padding: '8px', textAlign: 'center', width: '15%' }}>จำนวนเบิก</th>
                <th style={{ padding: '8px', textAlign: 'left', width: '15%' }}>หน่วยนับ</th>
                <th style={{ padding: '8px', textAlign: 'center', width: '10%' }}>ลบ</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ padding: '8px' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      list="master-items-list"
                      placeholder="พิมพ์เพื่อค้นหารายการ..."
                      value={item.item_name} 
                      onChange={(e) => handleItemTextChange(idx, e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input 
                      type="number" 
                      className="form-control" 
                      min="1" 
                      value={item.requested_qty} 
                      onChange={(e) => {
                        const newItems = [...selectedItems];
                        newItems[idx].requested_qty = e.target.value;
                        setSelectedItems(newItems);
                      }} 
                      style={{ textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    {item.unit || '-'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button className="btn" style={{ padding: '6px', color: '#ef4444', background: '#fee2e2' }} onClick={() => handleRemoveItem(idx)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="btn btn-secondary" style={{ marginBottom: '24px' }} onClick={handleAddItem}>
            <PlusCircle size={16} />
            เพิ่มรายการ
          </button>

          <datalist id="master-items-list">
            {items.map(i => (
              <option key={i.id} value={i.name} />
            ))}
          </datalist>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <button className="btn btn-primary" onClick={handlePreview}>
              <Search size={18} />
              ตรวจสอบข้อมูล (Preview)
            </button>
          </div>
        </div>
      )}

      {/* VIEW: PREVIEW & PRINT */}
      {(view === 'preview' || view === 'print') && currentReq && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            {view === 'preview' ? (
              <>
                <button className="btn btn-secondary" onClick={() => setView('create')}>
                  <ArrowLeft size={18} />
                  กลับไปแก้ไข
                </button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                  <FileText size={18} />
                  บันทึกและพิมพ์ (Save & Print)
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => setView('list')}>
                  <ArrowLeft size={18} />
                  กลับไปหน้ารวม
                </button>
                <button className="btn btn-primary" onClick={handlePrint}>
                  <Printer size={18} />
                  สั่งพิมพ์ (Print)
                </button>
              </>
            )}
          </div>
          
          <div className="print-container" style={{ display: 'flex', justifyContent: 'center' }}>
            <div 
              ref={printRef} 
              style={{ 
                width: '210mm', 
                minHeight: '297mm', 
                padding: '20mm', 
                backgroundColor: 'white', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                color: 'black',
                fontFamily: '"Sarabun", "TH Sarabun New", sans-serif'
              }}
            >
              {/* PRINT HEADER */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0' }}>ใบเบิกเวชภัณฑ์</h2>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '32px', fontSize: '18px' }}>
                <div style={{ marginBottom: '4px' }}>ใบเบิกเลขที่ {currentReq.req_number || '....................'}</div>
                <div>วันที่ {formatDateThai(currentReq.req_date)}</div>
              </div>

              <div style={{ fontSize: '18px', marginBottom: '20px', lineHeight: '1.6' }}>
                <div><strong>เรียน</strong> ผู้อำนวยการโรงพยาบาลส่งเสริมสุขภาพตำบลบ้านหนองพันท้าว</div>
                <div>ขอเบิก เวชภัณฑ์ยา เวชภัณฑ์มิใช่ยา วัสดุ วัสดุทันตกรรม ตามรายการต่อไปนี้ เพื่อใช้ในการบริการส่งเสริม ป้องกัน รักษา และฟื้นฟู</div>
              </div>

              {/* PRINT TABLE */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px', fontSize: '16px' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid black', padding: '8px', width: '10%', textAlign: 'center' }}>ลำดับ</th>
                    <th style={{ border: '1px solid black', padding: '8px', width: '50%', textAlign: 'center' }}>รายการ</th>
                    <th style={{ border: '1px solid black', padding: '8px', width: '20%', textAlign: 'center' }}>จำนวนเบิก</th>
                    <th style={{ border: '1px solid black', padding: '8px', width: '20%', textAlign: 'center' }}>หน่วยนับ</th>
                  </tr>
                </thead>
                <tbody>
                  {currentReq.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid black', padding: '8px' }}>{item.item_name}</td>
                      <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{Number(item.requested_qty || 0).toLocaleString('en-US')}</td>
                      <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{item.unit}</td>
                    </tr>
                  ))}
                  {/* Empty rows for padding if needed */}
                  {[...Array(Math.max(0, 10 - (currentReq.items?.length || 0)))].map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td style={{ border: '1px solid black', padding: '8px', height: '32px' }}></td>
                      <td style={{ border: '1px solid black', padding: '8px' }}></td>
                      <td style={{ border: '1px solid black', padding: '8px' }}></td>
                      <td style={{ border: '1px solid black', padding: '8px' }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* PRINT SIGNATURES */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', fontSize: '18px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '40px', whiteSpace: 'nowrap' }}>ลงชื่อ......................................................ผู้เบิก</div>
                  <div>({currentReq.requisitioner_name || '......................................................'})</div>
                  <div>ตำแหน่ง......................................................</div>
                  <div style={{ marginTop: '10px' }}>........../........../..........</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '40px', whiteSpace: 'nowrap' }}>ลงชื่อ......................................................ผู้จ่าย</div>
                  <div>({currentReq.dispenser_name || '......................................................'})</div>
                  <div>ตำแหน่ง......................................................</div>
                  <div style={{ marginTop: '10px' }}>........../........../..........</div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '30px' }}>
                  <div style={{ marginBottom: '40px', whiteSpace: 'nowrap' }}>ลงชื่อ......................................................ผู้รับ</div>
                  <div>(......................................................)</div>
                  <div>ตำแหน่ง......................................................</div>
                  <div style={{ marginTop: '10px' }}>........../........../..........</div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '30px' }}>
                  <div style={{ marginBottom: '40px', whiteSpace: 'nowrap' }}>ลงชื่อ......................................................ผู้อนุมัติ</div>
                  <div>({currentReq.director_name || '......................................................'})</div>
                  <div>ผอ.รพ.สต.บ้านหนองพันท้าว</div>
                  <div style={{ marginTop: '10px' }}>........../........../..........</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
