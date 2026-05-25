import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { Calendar, FileText, Printer, Save, Calculator, Wand2 } from 'lucide-react';

export default function ProcurementPlan() {
  const currentFiscalYear = new Date().getFullYear() + 543 + (new Date().getMonth() >= 9 ? 1 : 0);
  const defaultPlanYear = (currentFiscalYear + 1).toString(); // Plan for NEXT year by default

  const [selectedYear, setSelectedYear] = useState(defaultPlanYear);
  const [data, setData] = useState([]);
  const [pastYears, setPastYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [percentIncrease, setPercentIncrease] = useState(10);
  const [isSaving, setIsSaving] = useState(false);

  

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/procurement/plan?year=${selectedYear}`);
      const json = await res.json();
      setPastYears(json.years || []);
      
      // Initialize internal state for inputs
      const itemsWithState = (json.items || []).map(item => ({
        ...item,
        estimated_usage: item.estimated_usage || 0,
        q1_qty: item.q1_qty || 0,
        q2_qty: item.q2_qty || 0,
        q3_qty: item.q3_qty || 0,
        q4_qty: item.q4_qty || 0,
      }));
      setData(itemsWithState);
    } catch (err) {
      console.error("Error fetching plan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const handleItemChange = (idx, field, value) => {
    const newData = [...data];
    let val = parseFloat(value) || 0;
    if (val < 0) val = 0;
    newData[idx][field] = val;
    setData(newData);
  };

  // Auto-calculate "Estimated Usage" based on max past 3 years + % increase
  const handleAutoEstimate = () => {
    if (!window.confirm(`ระบบจะคำนวณ "ประมาณการใช้" ใหม่ โดยดึงยอดใช้สูงสุดใน 3 ปีที่ผ่านมา บวกเพิ่ม ${percentIncrease}% คุณต้องการทำต่อหรือไม่?`)) return;
    
    const newData = data.map(item => {
      const maxPast = Math.max(item.usage_y1 || 0, item.usage_y2 || 0, item.usage_y3 || 0);
      const newEstimate = Math.ceil(maxPast * (1 + (percentIncrease / 100)));
      return { ...item, estimated_usage: newEstimate };
    });
    setData(newData);
  };

  // Auto-split purchases into 4 quarters
  const handleAutoSplit = () => {
    if (!window.confirm(`ระบบจะนำยอด "ประมาณการซื้อ" ของทุกรายการ มาหารเฉลี่ยลงใน 4 ไตรมาสอัตโนมัติ คุณต้องการทำต่อหรือไม่?`)) return;

    const newData = data.map(item => {
      const needed = Math.max(0, item.estimated_usage - item.current_stock);
      const q = Math.floor(needed / 4);
      const rem = needed % 4;
      return { 
        ...item, 
        q1_qty: q + (rem > 0 ? 1 : 0),
        q2_qty: q + (rem > 1 ? 1 : 0),
        q3_qty: q + (rem > 2 ? 1 : 0),
        q4_qty: q
      };
    });
    setData(newData);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/procurement/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          items: data.map(i => ({
            id: i.id,
            estimated_usage: i.estimated_usage,
            q1_qty: i.q1_qty,
            q2_qty: i.q2_qty,
            q3_qty: i.q3_qty,
            q4_qty: i.q4_qty
          }))
        })
      });
      if (res.ok) {
        alert("บันทึกแผนจัดซื้อเรียบร้อยแล้ว");
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถบันทึกได้ ลองตรวจสอบการเชื่อมต่อ");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Controls */}
      <div className="glass-card print-hide" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Calculator size={20} style={{ color: '#8b5cf6' }} />
              <span>แผนประมาณการใช้และจัดซื้อเวชภัณฑ์ (Annual Procurement Plan)</span>
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              สร้างแผนการจัดซื้อเวชภัณฑ์ล่วงหน้า ระบบจะดึงยอดใช้ย้อนหลัง 3 ปี และยอดยกมาให้อัตโนมัติ เพื่อประกอบการตัดสินใจ
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div className="filter-group">
              <label>แผนสำหรับปีงบประมาณ</label>
              <input 
                type="number" 
                className="form-control" 
                value={selectedYear} 
                onChange={e => setSelectedYear(e.target.value)} 
                style={{ width: '120px' }}
              />
            </div>
            <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
              โหลดข้อมูล
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading || isSaving} style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}>
              <Save size={16} /> บันทึกแผน
            </button>
            <button className="btn btn-primary" onClick={handlePrint} style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>
              <Printer size={16} /> พิมพ์รายงาน
            </button>
          </div>
        </div>

        <div style={{ padding: '16px', background: '#f5f3ff', borderRadius: '10px', border: '1px solid #ddd6fe', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '600', color: '#5b21b6' }}>ผู้ช่วยคำนวณอัตโนมัติ:</span>
            <input 
              type="number" 
              className="form-control" 
              style={{ width: '80px', padding: '6px 10px', height: 'auto' }} 
              value={percentIncrease} 
              onChange={e => setPercentIncrease(parseFloat(e.target.value) || 0)} 
            />
            <span style={{ fontWeight: '500', color: '#5b21b6' }}>% (จากยอดใช้สูงสุด 3 ปี)</span>
          </div>
          <button className="btn btn-secondary" onClick={handleAutoEstimate} style={{ backgroundColor: 'white', color: '#6d28d9', borderColor: '#ddd6fe' }}>
            <Wand2 size={16} /> คำนวณประมาณการใช้
          </button>
          <button className="btn btn-secondary" onClick={handleAutoSplit} style={{ backgroundColor: 'white', color: '#6d28d9', borderColor: '#ddd6fe' }}>
            <Wand2 size={16} /> เฉลี่ยยอดซื้อลง 4 ไตรมาส
          </button>
        </div>
      </div>

      {/* Report Document */}
      <div className="report-print-container" style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', color: 'black', overflowX: 'auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            ประมาณการใช้เวชภัณฑ์ ของ รพ.สต......................................
          </h2>
        </div>

        <table className="procurement-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '1200px' }}>
          <thead>
            <tr>
              <th rowSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '40px' }}>No.</th>
              <th rowSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>รายการยา / เวชภัณฑ์</th>
              <th rowSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '60px' }}>หน่วยนับ</th>
              <th rowSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '60px' }}>ขนาดบรรจุ</th>
              <th colSpan="3" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>อัตราการใช้ย้อนหลัง 3 ปี</th>
              <th rowSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '60px', backgroundColor: '#e0f2fe' }}>ประมาณการ<br/>ใช้ในปี {selectedYear}</th>
              <th rowSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '60px' }}>คงคลัง<br/>ณ สิ้น ก.ย.{parseInt(selectedYear)-1}</th>
              <th rowSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '60px', backgroundColor: '#fce7f3' }}>ประมาณการ<br/>ซื้อในปี {selectedYear}</th>
              <th rowSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '60px' }}>ราคาต่อ<br/>หน่วย</th>
              <th colSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>ไตรมาสที่ 1</th>
              <th colSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>ไตรมาสที่ 2</th>
              <th colSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>ไตรมาสที่ 3</th>
              <th colSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>ไตรมาสที่ 4</th>
              <th rowSpan="2" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '80px' }}>รวมมูลค่า<br/>ทั้งหมด</th>
            </tr>
            <tr>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '45px' }}>ปี {pastYears[0] || '1'}</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '45px' }}>ปี {pastYears[1] || '2'}</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '45px' }}>ปี {pastYears[2] || '3'}</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '45px' }}>จำนวน</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '60px' }}>ราคา</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '45px' }}>จำนวน</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '60px' }}>ราคา</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '45px' }}>จำนวน</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '60px' }}>ราคา</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '45px' }}>จำนวน</th>
              <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', width: '60px' }}>ราคา</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="20" style={{ border: '1px solid #000', padding: '20px', textAlign: 'center' }}>กำลังประมวลผลข้อมูล...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan="20" style={{ border: '1px solid #000', padding: '20px', textAlign: 'center' }}>ไม่พบข้อมูลเวชภัณฑ์ในระบบ</td></tr>
            ) : (
              data.map((row, idx) => {
                const purchaseQty = Math.max(0, row.estimated_usage - row.current_stock);
                const q1Price = row.q1_qty * row.unit_price;
                const q2Price = row.q2_qty * row.unit_price;
                const q3Price = row.q3_qty * row.unit_price;
                const q4Price = row.q4_qty * row.unit_price;
                const totalQty = row.q1_qty + row.q2_qty + row.q3_qty + row.q4_qty;
                const totalPrice = q1Price + q2Price + q3Price + q4Price;
                
                // warning if planned total > estimated purchase
                const isOver = totalQty > purchaseQty;

                return (
                  <tr key={row.id}>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '4px' }}>{row.name}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row.unit || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{row.pack_size || '-'}</td>
                    
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{row.usage_y1 || 0}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{row.usage_y2 || 0}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{row.usage_y3 || 0}</td>
                    
                    <td style={{ border: '1px solid #000', padding: '0', backgroundColor: '#e0f2fe' }}>
                      <input 
                        type="number" 
                        value={row.estimated_usage} 
                        onChange={e => handleItemChange(idx, 'estimated_usage', e.target.value)}
                        className="print-input"
                        style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'right', padding: '4px' }}
                      />
                    </td>
                    
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{row.current_stock || 0}</td>
                    
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', backgroundColor: '#fce7f3', fontWeight: 'bold' }}>
                      {purchaseQty}
                    </td>
                    
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{row.unit_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    
                    {/* Q1 */}
                    <td style={{ border: '1px solid #000', padding: '0' }}>
                      <input 
                        type="number" 
                        value={row.q1_qty} 
                        onChange={e => handleItemChange(idx, 'q1_qty', e.target.value)}
                        className={`print-input ${isOver ? 'error' : ''}`}
                        style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'right', padding: '4px', color: isOver ? 'red' : 'inherit' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{q1Price > 0 ? q1Price.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                    
                    {/* Q2 */}
                    <td style={{ border: '1px solid #000', padding: '0' }}>
                      <input 
                        type="number" 
                        value={row.q2_qty} 
                        onChange={e => handleItemChange(idx, 'q2_qty', e.target.value)}
                        className={`print-input ${isOver ? 'error' : ''}`}
                        style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'right', padding: '4px', color: isOver ? 'red' : 'inherit' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{q2Price > 0 ? q2Price.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                    
                    {/* Q3 */}
                    <td style={{ border: '1px solid #000', padding: '0' }}>
                      <input 
                        type="number" 
                        value={row.q3_qty} 
                        onChange={e => handleItemChange(idx, 'q3_qty', e.target.value)}
                        className={`print-input ${isOver ? 'error' : ''}`}
                        style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'right', padding: '4px', color: isOver ? 'red' : 'inherit' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{q3Price > 0 ? q3Price.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                    
                    {/* Q4 */}
                    <td style={{ border: '1px solid #000', padding: '0' }}>
                      <input 
                        type="number" 
                        value={row.q4_qty} 
                        onChange={e => handleItemChange(idx, 'q4_qty', e.target.value)}
                        className={`print-input ${isOver ? 'error' : ''}`}
                        style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'right', padding: '4px', color: isOver ? 'red' : 'inherit' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{q4Price > 0 ? q4Price.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                    
                    {/* Total Value */}
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>
                      {totalPrice > 0 ? totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                    </td>
                  </tr>
                );
              })
            )}
            
            {/* Grand Total Row */}
            {!loading && data.length > 0 && (
              <tr style={{ backgroundColor: '#fdfcbc', fontWeight: 'bold' }}>
                <td colSpan="12" style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>ยอดรวมจัดซื้อไตรมาสที่ 1</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {data.reduce((sum, row) => sum + (row.q1_qty * row.unit_price), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>ยอดรวมไตรมาสที่ 2</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {data.reduce((sum, row) => sum + (row.q2_qty * row.unit_price), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>ยอดรวมไตรมาสที่ 3</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {data.reduce((sum, row) => sum + (row.q3_qty * row.unit_price), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>ยอดรวมไตรมาสที่ 4</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {data.reduce((sum, row) => sum + (row.q4_qty * row.unit_price), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', color: '#b91c1c' }}>
                  {data.reduce((sum, row) => sum + ((row.q1_qty + row.q2_qty + row.q3_qty + row.q4_qty) * row.unit_price), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: landscape; margin: 10mm; }
          body * { visibility: hidden; }
          .report-print-container, .report-print-container * { visibility: visible; }
          .report-print-container {
            position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-shadow: none;
          }
          .print-hide { display: none !important; }
          .print-input { 
            -moz-appearance: textfield; 
            border: none !important;
            background: transparent !important;
          }
          .print-input::-webkit-outer-spin-button,
          .print-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
        }
      `}} />
    </div>
  );
}
