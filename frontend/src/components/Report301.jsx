import React, { useState, useEffect } from 'react';
import { FileText, Printer, Search } from 'lucide-react';

const Report301 = () => {
  const API_BASE = window.location.port === '5173' ? 'http://localhost:5050' : '';
  const [items, setItems] = useState([]);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [year, setYear] = useState('2568');
  
  // reportData is now an array of report objects
  const [reportsData, setReportsData] = useState(null);
  const [loading, setLoading] = useState(false);

  const formatVal = (num) => Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatQty = (num) => Number(num || 0).toLocaleString('en-US');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/master-items`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemTextChange = (e) => {
    const val = e.target.value;
    setSelectedItemName(val);
    const item = items.find(i => {
      const displayVal = i.sequence_no ? `[${i.sequence_no}] ${i.name}` : i.name;
      return displayVal === val || i.name === val;
    });
    if (item) {
      setSelectedItemId(item.id);
    } else {
      setSelectedItemId('');
    }
  };

  const fetchReport = async () => {
    if (!selectedItemId) {
      alert('กรุณาเลือกเวชภัณฑ์ที่ต้องการ');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/inventory/report301?year=${year}&item_id=${selectedItemId}`);
      const data = await res.json();
      if (res.ok) {
        setReportsData([data]);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/inventory/report301/all?year=${year}`);
      const data = await res.json();
      if (res.ok) {
        setReportsData(data);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container" style={{ padding: '20px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>รายงาน รบ 301 (บัญชีคุมรายตัว)</h2>
      
      {/* Search Filter - Hide on print */}
      <div className="card hide-on-print" style={{ marginBottom: '20px', padding: '20px', display: 'flex', gap: '15px', alignItems: 'flex-end', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ปีงบประมาณ</label>
          <select className="form-control" value={year} onChange={e => setYear(e.target.value)}>
            <option value="2567">2567</option>
            <option value="2568">2568</option>
            <option value="2569">2569</option>
            <option value="2570">2570</option>
          </select>
        </div>
        <div style={{ flex: 3 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>รายการเวชภัณฑ์</label>
          <input 
            type="text" 
            className="form-control" 
            list="master-items-list"
            placeholder="พิมพ์เพื่อค้นหารายการ..."
            value={selectedItemName} 
            onChange={handleItemTextChange}
          />
          <datalist id="master-items-list">
            {items.map(i => {
              const displayVal = i.sequence_no ? `[${i.sequence_no}] ${i.name}` : i.name;
              return <option key={i.id} value={displayVal} />;
            })}
          </datalist>
        </div>
        <div>
          <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
            <Search size={18} />
            ค้นหารายการที่เลือก
          </button>
          <button className="btn btn-secondary" onClick={fetchAllReports} disabled={loading} style={{ marginLeft: '10px' }}>
            <FileText size={18} />
            ดูทั้งหมด (Print All)
          </button>
        </div>
        {reportsData && (
          <div>
            <button className="btn btn-success" onClick={handlePrint} style={{ backgroundColor: '#10b981', color: 'white' }}>
              <Printer size={18} />
              สั่งพิมพ์
            </button>
          </div>
        )}
      </div>

      {/* PRINT CONTAINER */}
      {reportsData && (
        <div className="print-container">
          <style>
            {`
              @media print {
                @page { size: A4 landscape; margin: 15mm; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .hide-on-print { display: none !important; }
                .print-container { width: 100%; box-shadow: none !important; border: none !important; padding: 0 !important; }
                .report-table th, .report-table td { border: 1px solid #000 !important; }
                .page-break { page-break-after: always; }
                .page-break:last-child { page-break-after: auto; }
              }
              .report-table { width: 100%; border-collapse: collapse; font-size: 14px; text-align: center; }
              .report-table th, .report-table td { border: 1px solid #ccc; padding: 6px; }
              .report-table th { font-weight: bold; }
            `}
          </style>

          {reportsData.map((report, rIndex) => (
            <div key={rIndex} className="page-break" style={{ width: '100%', margin: '0 auto', fontFamily: 'sans-serif', marginBottom: '40px' }}>
              <div style={{ marginBottom: '10px' }}>แบบ รบ 301</div>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0' }}>บัญชีรับ – จ่าย เวชภัณฑ์และสิ่งของ</h3>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px', fontSize: '16px' }}>
                <span>ลำดับที่ {report.item.sequence_no || '-'}</span>
                <span style={{ fontWeight: 'bold' }}>ชื่อเวชภัณฑ์หรือสิ่งของ: {report.item.name}</span>
                <span>หน่วยนับ: {report.item.unit}</span>
              </div>
              
              <div style={{ marginBottom: '20px', fontSize: '16px' }}>
                <span>ชื่อสำนักงาน รพ.สต.บ้านหนองพันท้าว ตำบลพงตึก อำเภอท่ามะกา จังหวัดกาญจนบุรี</span>
              </div>

              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>เดือน</th>
                    <th style={{ width: '8%' }}>ยอดยกมา</th>
                    <th style={{ width: '10%' }}>วันที่รับใหม่</th>
                    <th style={{ width: '8%' }}>จำนวน</th>
                    <th style={{ width: '10%' }}>มูลค่ารับใหม่</th>
                    <th style={{ width: '10%' }}>วันที่จ่าย</th>
                    <th style={{ width: '8%' }}>จำนวน</th>
                    <th style={{ width: '10%' }}>มูลค่าจ่ายออก</th>
                    <th style={{ width: '8%' }}>คงเหลือ</th>
                    <th style={{ width: '10%' }}>มูลค่าคงเหลือ</th>
                    <th style={{ width: '10%' }}>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.month_name}</td>
                      <td>{row.beginning_balance !== null ? formatQty(row.beginning_balance) : ''}</td>
                      <td>{row.received_date || ''}</td>
                      <td>{row.received_qty !== null ? formatQty(row.received_qty) : ''}</td>
                      <td>{row.received_value !== null ? formatVal(row.received_value) : ''}</td>
                      <td>{row.dispensed_date || ''}</td>
                      <td>{row.dispensed_qty !== null ? formatQty(row.dispensed_qty) : ''}</td>
                      <td>{row.dispensed_value !== null ? formatVal(row.dispensed_value) : ''}</td>
                      <td>{row.remaining_qty !== null ? formatQty(row.remaining_qty) : ''}</td>
                      <td>{row.remaining_value !== null ? formatVal(row.remaining_value) : ''}</td>
                      <td>{row.note || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '20px', fontSize: '14px', textAlign: 'center' }}>
                วันที่เบิกเวชภัณฑ์ จากคลังใน   จันทร์แรกของสัปดาห์
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Report301;
