import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, DownloadCloud } from 'lucide-react';

const ReportPreview = ({ items, month, year, onClose, onExport }) => {
  const [settings, setSettings] = useState({});
  const API_BASE = window.location.port === '5173' ? 'http://localhost:5050' : '';

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error(err));
  }, []);
  
  const totalRecvVal = items.reduce((sum, item) => sum + (item.received_value || 0), 0);
  const totalDispVal = items.reduce((sum, item) => sum + (item.dispensed_value || 0), 0);
  const totalRemVal = items.reduce((sum, item) => sum + (item.remaining_value || 0), 0);
  const formatVal = (num) => Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatQty = (num) => Number(num || 0).toLocaleString('en-US');

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="report-modal-overlay darkreader-ignore">
      
      {/* Top Action Bar - Hidden during print */}
      <div className="report-action-bar no-print">
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={handlePrint} style={{ fontSize: '1rem', padding: '10px 20px' }}>
            <Printer size={20} /> พิมพ์รายงาน (Print)
          </button>
          <button className="btn btn-secondary" onClick={onExport} style={{ fontSize: '1rem', padding: '10px 20px' }}>
            <DownloadCloud size={20} /> ส่งออก Excel
          </button>
        </div>
        <button className="btn btn-danger" onClick={onClose} style={{ fontSize: '1rem', padding: '10px 20px' }}>
          <X size={20} /> ปิดหน้านี้
        </button>
      </div>

      {/* A4 Paper Container */}
      <div className="report-paper darkreader-ignore" style={{ backgroundColor: '#ffffff', color: '#000000', opacity: 1 }}>
        {/* Header */}
        <div className="report-header">
          <h2>รายงานสรุปคลังเวชภัณฑ์ (ไม่ใช่ยา)</h2>
          <p>ประจำเดือน <strong>{month}</strong> ปีงบประมาณ <strong>{year}</strong></p>
        </div>

        {/* Data Table */}
        <table className="report-table" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
          <thead>
            <tr>
              <th rowSpan="2" style={{ border: '1px solid #333', padding: '8px 6px', width: '40px', textAlign: 'center' }}>ลำดับ</th>
              <th rowSpan="2" style={{ border: '1px solid #333', padding: '8px 6px' }}>รายการเวชภัณฑ์</th>
              <th rowSpan="2" style={{ border: '1px solid #333', padding: '8px 6px' }}>หน่วยนับ</th>
              <th rowSpan="2" style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right' }}>ราคา/หน่วย</th>
              <th rowSpan="2" style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right' }}>ยอดยกมา</th>
              <th colSpan="2" style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'center', backgroundColor: '#e0f2fe' }}>รับเข้าใหม่</th>
              <th colSpan="2" style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'center', backgroundColor: '#fce7f3' }}>จ่ายออก</th>
              <th colSpan="2" style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'center', backgroundColor: '#fef3c7' }}>คงเหลือ</th>
              <th rowSpan="2" style={{ border: '1px solid #333', padding: '8px 6px', width: '80px', textAlign: 'center' }}>วันหมดอายุ</th>
            </tr>
            <tr>
              <th style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#e0f2fe' }}>จำนวน</th>
              <th style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#e0f2fe' }}>มูลค่า</th>
              <th style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#fce7f3' }}>จำนวน</th>
              <th style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#fce7f3' }}>มูลค่า</th>
              <th style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#fef3c7' }}>จำนวน</th>
              <th style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#fef3c7' }}>มูลค่า</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', padding: '20px' }}>ไม่มีข้อมูลเวชภัณฑ์ในเดือนนี้</td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id || index}>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px' }}>{item.name}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px' }}>{item.unit}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right' }}>{item.unit_price ? formatVal(item.unit_price) : '0.00'}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right' }}>{formatQty(item.beginning_balance)}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#f0f9ff' }}>{formatQty(item.received_qty)}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#f0f9ff' }}>{item.received_value ? formatVal(item.received_value) : '0.00'}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#fdf2f8' }}>{formatQty(item.dispensed_qty)}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#fdf2f8' }}>{item.dispensed_value ? formatVal(item.dispensed_value) : '0.00'}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#fffbeb', fontWeight: 'bold' }}>{formatQty(item.remaining_qty)}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'right', backgroundColor: '#fffbeb', fontWeight: 'bold' }}>{item.remaining_value ? formatVal(item.remaining_value) : '0.00'}</td>
                  <td style={{ border: '1px solid #333', padding: '8px 6px', textAlign: 'center' }}>{item.expiry_date || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="6" style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333', padding: '10px 6px', textAlign: 'right', fontWeight: 'bold' }}>รวมมูลค่ารับเข้าใหม่:</td>
              <td style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333', padding: '10px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatVal(totalRecvVal)}</td>
              <td style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333', padding: '10px 6px', textAlign: 'right', fontWeight: 'bold' }}>รวมมูลค่าจ่ายออก:</td>
              <td style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333', padding: '10px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatVal(totalDispVal)}</td>
              <td style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333', padding: '10px 6px', textAlign: 'right', fontWeight: 'bold' }}>รวมมูลค่าคงคลัง:</td>
              <td style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333', padding: '10px 6px', textAlign: 'right', fontWeight: 'bold' }}>{formatVal(totalRemVal)}</td>
              <td style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333', padding: '10px 6px' }}></td>
            </tr>
          </tfoot>
        </table>

        {/* Footer Signatures */}
        <div className="report-signatures">
          <div className="signature-box">
            <p>ลงชื่อ.........................................................</p>
            <p>({settings.preparer_name ? ` ${settings.preparer_name} ` : '.........................................................'})</p>
            <p>ผู้จัดทำรายงาน / ผู้เบิก-จ่าย</p>
          </div>
          <div className="signature-box">
            <p>ลงชื่อ.........................................................</p>
            <p>({settings.reviewer_name ? ` ${settings.reviewer_name} ` : '.........................................................'})</p>
            <p>ผู้ตรวจสอบ / หัวหน้าแผนก</p>
          </div>
          <div className="signature-box">
            <p>ลงชื่อ.........................................................</p>
            <p>({settings.approver_name ? ` ${settings.approver_name} ` : '.........................................................'})</p>
            <p>ผู้อนุมัติ / ผู้อำนวยการ</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReportPreview;
