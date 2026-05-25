import React, { useState, useEffect } from 'react';
import { Calendar, FileText, Printer, BarChart2 } from 'lucide-react';

export default function Reports() {
  const [reportType, setReportType] = useState('monthly'); // 'monthly' or 'yearly'
  const [selectedYear, setSelectedYear] = useState('');
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_BASE = window.location.port === '5173' ? 'http://localhost:5050' : '';

  const generateMonthsForYear = (fiscalYearStr) => {
    const fy = parseInt(fiscalYearStr) || new Date().getFullYear() + 543;
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

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/inventory/years`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const strYears = data.map(String);
          setAvailableYears(strYears);
          const currentYear = strYears[0];
          setSelectedYear(currentYear);
          
          const months = generateMonthsForYear(currentYear);
          setSelectedMonth(months[0].value);
        }
      } catch (err) {
        console.error("Error fetching years:", err);
      }
    };
    fetchYears();
  }, []);

  useEffect(() => {
    if (!selectedYear) return;

    const fetchReport = async () => {
      setLoading(true);
      try {
        let url = `${API_BASE}/api/reports/gl?year=${selectedYear}`;
        if (reportType === 'monthly' && selectedMonth) {
          url += `&month=${selectedMonth}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        setReportData(data);
      } catch (err) {
        console.error("Error fetching report:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReport();
  }, [selectedYear, selectedMonth, reportType]);

  const dynamicMonthsList = selectedYear ? generateMonthsForYear(selectedYear) : [];

  const handlePrint = () => {
    window.print();
  };

  // Calculate totals for footer
  const sumBeginning = reportData.reduce((sum, row) => sum + (row.beginning_value || 0), 0);
  const sumReceived = reportData.reduce((sum, row) => sum + (row.received_value || 0), 0);
  const sumTotal = reportData.reduce((sum, row) => sum + (row.total_value || 0), 0);
  const sumDispensed = reportData.reduce((sum, row) => sum + (row.dispensed_value || 0), 0);
  const sumRemaining = reportData.reduce((sum, row) => sum + (row.remaining_value || 0), 0);

  return (
    <div className="fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Report Controls (Hidden during printing) */}
      <div className="glass-card print-hide" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} />
          <span>ตัวเลือกรายงาน (Report Filters)</span>
        </h3>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="filter-group">
            <label>ประเภทรายงาน</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className={`btn ${reportType === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setReportType('monthly')}
                style={{ padding: '8px 16px', fontWeight: '500', backgroundColor: reportType === 'monthly' ? '#8b5cf6' : '' }}
              >
                รายงานประจำเดือน
              </button>
              <button 
                className={`btn ${reportType === 'yearly' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setReportType('yearly')}
                style={{ padding: '8px 16px', fontWeight: '500', backgroundColor: reportType === 'yearly' ? '#8b5cf6' : '' }}
              >
                รายงานประจำปี (สรุปทั้งปี)
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label>ปีงบประมาณ</label>
            <select className="form-select" value={selectedYear} onChange={e => {
              const newYear = e.target.value;
              setSelectedYear(newYear);
              if (reportType === 'monthly') {
                const newMonthsList = generateMonthsForYear(newYear);
                const currentIndex = dynamicMonthsList.findIndex(m => m.value === selectedMonth);
                setSelectedMonth(newMonthsList[currentIndex >= 0 ? currentIndex : 0].value);
              }
            }}>
              {availableYears.map(y => (
                <option key={y} value={y}>ปีงบประมาณ {y}</option>
              ))}
            </select>
          </div>

          {reportType === 'monthly' && (
            <div className="filter-group">
              <label>ประจำเดือน</label>
              <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {dynamicMonthsList.map(m => (
                  <option key={m.value} value={m.value}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
            <button className="btn btn-primary" onClick={handlePrint} style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>
              <Printer size={16} /> พิมพ์รายงาน (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Report Document */}
      <div className="report-print-container" style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', minHeight: '800px', color: 'black' }}>
        
        {/* Report Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px' }}>
            รายงานสรุปมูลค่าคงคลังเวชภัณฑ์ (General Ledger)
          </h2>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>
            {reportType === 'monthly' 
              ? `ประจำเดือน ${selectedMonth.replace('.', ' ')} ปีงบประมาณ ${selectedYear}`
              : `ประจำปีงบประมาณ ${selectedYear} (ต.ค.${parseInt(selectedYear)-1} - ก.ย.${selectedYear})`
            }
          </h3>
        </div>

        {/* Report Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '40px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>รายการวัสดุ</th>
              <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', backgroundColor: '#f3f4f6' }}>คงเหลือยอดยกมา</th>
              <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', backgroundColor: '#f3f4f6' }}>รับเข้า</th>
              <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', backgroundColor: '#f3f4f6' }}>รวม</th>
              <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', backgroundColor: '#f3f4f6' }}>จ่ายออก</th>
              <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', backgroundColor: '#f3f4f6' }}>คงเหลือยอดยกไป</th>
              <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ border: '1px solid #000', padding: '20px', textAlign: 'center' }}>กำลังประมวลผลข้อมูล...</td>
              </tr>
            ) : reportData.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ border: '1px solid #000', padding: '20px', textAlign: 'center' }}>ไม่พบข้อมูลในช่วงเวลาที่เลือก</td>
              </tr>
            ) : (
              reportData.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000', padding: '10px' }}>{row.category_name}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{row.beginning_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{row.received_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{row.total_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{row.dispensed_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{row.remaining_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{ border: '1px solid #000', padding: '10px' }}></td>
                </tr>
              ))
            )}
            
            {/* Totals Row */}
            {!loading && reportData.length > 0 && (
              <tr style={{ backgroundColor: '#fdfcbc', fontWeight: 'bold' }}>
                <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>รวมทั้งหมด</td>
                <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{sumBeginning.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{sumReceived.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{sumTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{sumDispensed.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{sumRemaining.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style={{ border: '1px solid #000', padding: '10px' }}></td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Signatures Area */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 20px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '40px' }}>ลงชื่อ.......................................................ผู้จัดทำรายงาน</p>
            <p>(.......................................................)</p>
            <p>ตำแหน่ง.......................................................</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '40px' }}>ลงชื่อ.......................................................ผู้ตรวจสอบ</p>
            <p>(.......................................................)</p>
            <p>ตำแหน่ง.......................................................</p>
          </div>
        </div>
        
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .report-print-container, .report-print-container * {
            visibility: visible;
          }
          .report-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
