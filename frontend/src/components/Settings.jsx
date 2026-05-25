import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { Settings as SettingsIcon, Server, Database, User, Key, Eye, EyeOff, Save, CheckCircle, AlertCircle, RefreshCw, Upload } from 'lucide-react';

export default function Settings() {
  const [form, setForm] = useState({
    host: '',
    database: '',
    username: '',
    password: '',
    preparer_name: '',
    reviewer_name: '',
    approver_name: '',
    departments: '',
    req_director: '',
    req_dispenser: '',
    req_requisitioner: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }
  const [testPassed, setTestPassed] = useState(false); // Enable save only if true
  const [saveStatus, setSaveStatus] = useState(null); // { success: boolean, message: string }
  const [monthlyUploading, setMonthlyUploading] = useState(false);
  const [monthlyDragActive, setMonthlyDragActive] = useState(false);
  const [restoreUploading, setRestoreUploading] = useState(false);

  

  // Load current settings from backend
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await apiFetch(`/api/settings`);
        const json = await res.json();
        setForm(json);
        // If it was already connected, maybe auto-verify? Not strictly necessary.
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    loadSettings();
  }, []);

  // Handle connection test
  const handleTestConnection = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await apiFetch(`/api/settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (res.ok) {
        setTestResult({ success: true, message: json.message });
        setTestPassed(true);
      } else {
        setTestResult({ success: false, message: json.error || 'การเชื่อมต่อผิดพลาด' });
        setTestPassed(false);
      }
    } catch (err) {
      setTestResult({ success: false, message: 'ไม่สามารถเชื่อมต่อ API หลังบ้านได้' });
      setTestPassed(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = () => {
    window.location.href = `/api/settings/backup`;
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('คำเตือน: การกู้คืนข้อมูลจะทำการลบข้อมูลปัจจุบันและแทนที่ด้วยข้อมูลจากไฟล์ Backup ทั้งหมด! คุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?')) {
      e.target.value = '';
      return;
    }

    setRestoreUploading(true);
    const formData = new FormData();
    formData.append('db_file', file);

    try {
      const res = await apiFetch(`/api/settings/restore`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        window.location.reload();
      } else {
        alert("อัปโหลดล้มเหลว: " + data.error);
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการกู้คืนข้อมูล: " + err.message);
    } finally {
      setRestoreUploading(false);
      e.target.value = '';
    }
  };

  // Handle save settings
  const handleSaveSettings = async () => {
    setLoading(true);
    setSaveStatus(null);
    try {
      const res = await apiFetch(`/api/settings/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (res.ok) {
        setSaveStatus({ success: true, message: json.message });
        setForm(prev => ({ ...prev, isConnected: true }));
        setTimeout(() => setSaveStatus(null), 4000); // clear after 4s
      } else {
        setSaveStatus({ success: false, message: json.error || 'การบันทึกข้อมูลล้มเหลว' });
      }
    } catch (err) {
      setSaveStatus({ success: false, message: 'ไม่สามารถเชื่อมต่อ API หลังบ้านได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const confirm = window.confirm("คุณต้องการยกเลิกการเชื่อมต่อกับ HOSxP ใช่หรือไม่?\\n\\n(ระบบจะกลับไปใช้โหมด Standalone อัตโนมัติ)");
    if (!confirm) return;

    setLoading(true);
    setSaveStatus(null);
    setTestResult(null);
    try {
      const res = await apiFetch(`/api/settings/disconnect`, {
        method: 'POST'
      });
      const json = await res.json();
      if (res.ok) {
        setSaveStatus({ success: true, message: json.message });
        setTestPassed(false);
        setForm(prev => ({ ...prev, isConnected: false }));
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        setSaveStatus({ success: false, message: json.error || 'ยกเลิกการเชื่อมต่อล้มเหลว' });
      }
    } catch (err) {
      setSaveStatus({ success: false, message: 'ไม่สามารถเชื่อมต่อ API หลังบ้านได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    const confirm1 = window.confirm("⚠️ คำเตือน: คุณต้องการล้างข้อมูล 'ประวัติการรับ-จ่าย' และ 'ยอดคงเหลือรายเดือน' ใช่หรือไม่?\n\nข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้");
    if (!confirm1) return;

    const confirm2 = window.confirm("คุณต้องการล้างข้อมูล 'รายการเวชภัณฑ์ตั้งต้น' (Master Items) ด้วยหรือไม่?\n\n- กด OK = ล้างข้อมูลทั้งหมดรวมถึงรายการเวชภัณฑ์\n- กด Cancel = ล้างเฉพาะประวัติรับ-จ่าย (เก็บรายการเวชภัณฑ์ไว้)");

    setLoading(true);
    setSaveStatus(null);
    try {
      const res = await apiFetch(`/api/settings/clear-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearMasterItems: confirm2 })
      });
      const json = await res.json();
      if (res.ok) {
        setSaveStatus({ success: true, message: json.message });
        setTimeout(() => setSaveStatus(null), 6000);
      } else {
        setSaveStatus({ success: false, message: json.error || 'การล้างข้อมูลล้มเหลว' });
      }
    } catch (err) {
      setSaveStatus({ success: false, message: 'ไม่สามารถเชื่อมต่อ API หลังบ้านได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleMonthlyFileUpload = async (file) => {
    if (!file) return;
    setMonthlyUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch(`/api/inventory/import`, {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (res.ok) {
        alert(`นำเข้าไฟล์ Excel สต็อกรายเดือนสำเร็จ!\nชีตที่บันทึกสำเร็จ: ${result.results.map(r => `${r.sheetName} (${r.importedItems} รายการ)`).join(', ')}`);
      } else {
        alert(`เกิดข้อผิดพลาดในการอัปโหลด: ${result.error}`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านได้");
    } finally {
      setMonthlyUploading(false);
    }
  };

  const handleMonthlyDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setMonthlyDragActive(true);
    } else if (e.type === "dragleave") {
      setMonthlyDragActive(false);
    }
  };

  const handleMonthlyDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMonthlyDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleMonthlyFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '650px', margin: '0 auto' }}>
      
      {/* Large Connection Status Banner */}
      {form.isConnected !== undefined && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: form.isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `2px solid ${form.isConnected ? '#10b981' : '#ef4444'}`,
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '16px', height: '16px', borderRadius: '50%',
              backgroundColor: form.isConnected ? '#10b981' : '#ef4444',
              boxShadow: `0 0 10px ${form.isConnected ? '#10b981' : '#ef4444'}`
            }}></div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: form.isConnected ? '#047857' : '#b91c1c' }}>
                {form.isConnected ? 'สถานะ: กำลังเชื่อมต่อฐานข้อมูล HOSxP' : 'สถานะ: โหมด Standalone (ตัดการเชื่อมต่อแล้ว)'}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: form.isConnected ? '#065f46' : '#991b1b' }}>
                {form.isConnected 
                  ? 'ระบบกำลังดึงข้อมูลเวชภัณฑ์ ยา และชื่อเจ้าหน้าที่จากฐานข้อมูลโรงพยาบาล'
                  : 'ระบบทำงานแบบออฟไลน์แยกส่วน (ใช้ฐานข้อมูล SQLite ของตัวเอง)'}
              </p>
            </div>
          </div>
          
          {/* Always show disconnect button here for visibility if connected */}
          {form.isConnected && (
            <button 
              type="button" 
              className="btn"
              style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold' }}
              onClick={handleDisconnect}
              disabled={loading}
            >
              ยกเลิกการเชื่อมต่อ
            </button>
          )}
        </div>
      )}

      {/* Title */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <SettingsIcon size={20} style={{ color: 'hsl(var(--primary))' }} />
          <span>ตั้งค่าการเชื่อมต่อฐานข้อมูล HOSxP (MySQL)</span>
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          กรอกข้อมูลเพื่อเชื่อมต่อตรงกับเซิร์ฟเวอร์ MySQL ของโรงพยาบาล หากต้องการเชื่อมต่อใหม่ ให้กรอกข้อมูลด้านล่างแล้วกด "ทดสอบการเชื่อมต่อ"
        </p>
      </div>

      {/* Settings Form */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Host Input */}
        <div className="filter-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Server size={14} />
            <span>โฮสต์เซิร์ฟเวอร์ (MySQL IP / Hostname)</span>
          </label>
          <input 
            type="text" 
            className="form-control"
            placeholder="เช่น 192.168.1.200 หรือ localhost"
            value={form.host}
            onChange={e => { setForm({ ...form, host: e.target.value }); setTestPassed(false); }}
          />
        </div>

        {/* Database Name */}
        <div className="filter-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={14} />
            <span>ชื่อฐานข้อมูล (Database Name)</span>
          </label>
          <input 
            type="text" 
            className="form-control"
            placeholder="เช่น hos"
            value={form.database}
            onChange={e => { setForm({ ...form, database: e.target.value }); setTestPassed(false); }}
          />
        </div>

        {/* Username */}
        <div className="filter-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} />
            <span>ชื่อผู้ใช้ฐานข้อมูล (Username)</span>
          </label>
          <input 
            type="text" 
            className="form-control"
            placeholder="เช่น sa"
            value={form.username}
            onChange={e => { setForm({ ...form, username: e.target.value }); setTestPassed(false); }}
          />
        </div>

        {/* Password */}
        <div className="filter-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Key size={14} />
            <span>รหัสผ่าน (Password)</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? 'text' : 'password'} 
              className="form-control"
              style={{ paddingRight: '40px' }}
              placeholder="••••••••"
              value={form.password}
              onChange={e => { setForm({ ...form, password: e.target.value }); setTestPassed(false); }}
            />
            <button
              type="button"
              style={{
                position: 'absolute',
                right: '12px',
                top: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b'
              }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Report Signature Settings Section */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '16px' }}>ตั้งค่าลายเซ็นท้ายรายงาน</h4>
          
          <div className="filter-group" style={{ marginBottom: '16px' }}>
            <label>ชื่อผู้จัดทำรายงาน / ผู้เบิก-จ่าย</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="เช่น นาย ก. นามสกุล"
              value={form.preparer_name || ''}
              onChange={e => setForm({ ...form, preparer_name: e.target.value })}
            />
          </div>

          <div className="filter-group" style={{ marginBottom: '16px' }}>
            <label>ชื่อผู้ตรวจสอบ / หัวหน้าแผนก</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="เช่น นาย ข. นามสกุล"
              value={form.reviewer_name || ''}
              onChange={e => setForm({ ...form, reviewer_name: e.target.value })}
            />
          </div>

          <div className="filter-group">
            <label>ชื่อผู้อนุมัติ / ผู้อำนวยการ</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="เช่น นาย ค. นามสกุล"
              value={form.approver_name || ''}
              onChange={e => setForm({ ...form, approver_name: e.target.value })}
            />
          </div>
        </div>

        {/* Departments Setting */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '16px' }}>ตั้งค่ารายชื่อแผนก / ผู้เบิก (สำหรับตอนเบิกจ่าย)</h4>
          
          <div className="filter-group">
            <label>กรอกชื่อแผนก (คั่นด้วยลูกน้ำ , หรือขึ้นบรรทัดใหม่)</label>
            <textarea 
              className="form-control"
              placeholder="เช่น แผนกฉุกเฉิน, แผนกผู้ป่วยนอก, ตึกศัลยกรรม"
              rows={4}
              value={form.departments || ''}
              onChange={e => setForm({ ...form, departments: e.target.value })}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Requisition Signatures */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '16px' }}>ตั้งค่าลายเซ็นใบเบิกเวชภัณฑ์</h4>
          
          <div className="filter-group" style={{ marginBottom: '16px' }}>
            <label>ชื่อผู้เบิก</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="เช่น นาย/นางสาว..."
              value={form.req_requisitioner || ''}
              onChange={e => setForm({ ...form, req_requisitioner: e.target.value })}
            />
          </div>

          <div className="filter-group" style={{ marginBottom: '16px' }}>
            <label>ชื่อผู้จ่าย (เจ้าหน้าที่คลัง/เภสัชกร)</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="เช่น นาย/นางสาว..."
              value={form.req_dispenser || ''}
              onChange={e => setForm({ ...form, req_dispenser: e.target.value })}
            />
          </div>

          <div className="filter-group">
            <label>ชื่อผู้อนุมัติ (ผู้อำนวยการ รพ.สต.)</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="เช่น นาย/นางสาว..."
              value={form.req_director || ''}
              onChange={e => setForm({ ...form, req_director: e.target.value })}
            />
          </div>
        </div>

        {/* Badges feedback */}
        {testResult && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: testResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            fontSize: '0.85rem',
            color: testResult.success ? '#10b981' : '#ef4444',
            fontWeight: '600'
          }}>
            {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}

        {saveStatus && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: saveStatus.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${saveStatus.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            fontSize: '0.85rem',
            color: saveStatus.success ? '#10b981' : '#ef4444',
            fontWeight: '600'
          }}>
            {saveStatus.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{saveStatus.message}</span>
          </div>
        )}

        {/* Buttons Action */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', justifyContent: 'flex-end' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleTestConnection}
            disabled={loading}
          >
            {loading ? <RefreshCw className="animate-spin" size={16} /> : null}
            <span>ทดสอบการเชื่อมต่อ</span>
          </button>
          
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleSaveSettings}
            disabled={loading || !testPassed}
            style={{ opacity: (!testPassed || loading) ? 0.6 : 1 }}
          >
            <Save size={16} />
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>
      </div>

      {/* Monthly Import Box */}
      <div className="glass-card" style={{ marginTop: '24px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px' }}>นำเข้าข้อมูลคลังเวชภัณฑ์ประจำเดือน</h4>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
          อัปโหลดไฟล์ Excel ของคลังย่อย (ชื่อชีตเป็นชื่อเดือน เช่น ต.ค.68) ระบบจะทำการสร้างรายการเวชภัณฑ์และอัปเดตสต็อกให้อัตโนมัติ
        </p>
        <div 
          className="file-upload-container" 
          style={{ border: monthlyDragActive ? '2px dashed hsl(var(--primary))' : '2px dashed #cbd5e1', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '8px' }}
          onDragEnter={handleMonthlyDrag}
          onDragOver={handleMonthlyDrag}
          onDragLeave={handleMonthlyDrag}
          onDrop={handleMonthlyDrop}
        >
          <Upload className="file-upload-icon" />
          <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>
            {monthlyUploading ? 'กำลังนำเข้าข้อมูล...' : 'ลากไฟล์ Excel สต็อกรายเดือนมาวางที่นี่'}
          </div>
          <input 
            type="file" 
            accept=".xlsx" 
            style={{ display: 'none' }} 
            id="excel-monthly-settings-input"
            onChange={e => e.target.files && handleMonthlyFileUpload(e.target.files[0])}
          />
          <button 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.8rem', marginTop: '12px' }}
            onClick={() => document.getElementById('excel-monthly-settings-input').click()}
          >
            เลือกไฟล์สต็อกรายเดือน
          </button>
        </div>
      </div>
      
      {/* Local SQLite Database Info & Danger Zone */}
      <div className="glass-card" style={{ marginTop: '24px', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '12px' }}>การจัดการข้อมูลระบบ (Data Management):</h4>
        
        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
          <div>• ฐานข้อมูลคลังเวชภัณฑ์: <code>backend/inventory.db</code></div>
          <div>• ฐานข้อมูลมีความปลอดภัยสูงและทำงานแยกส่วน ไม่เขียนข้อมูลลงในตารางหลักของ HOSxP</div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ fontSize: '0.85rem', padding: '8px 16px', backgroundColor: '#e0f2fe', color: '#0284c7', borderColor: '#bae6fd' }}
            onClick={handleBackup}
          >
            <Save size={16} />
            <span>สำรองข้อมูล (Backup)</span>
          </button>

          <label 
            className={`btn btn-secondary ${restoreUploading ? 'opacity-50' : ''}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px', backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fde68a', cursor: restoreUploading ? 'wait' : 'pointer' }}
          >
            <Upload size={16} />
            <span>{restoreUploading ? 'กำลังกู้คืน...' : 'กู้คืนข้อมูล (Restore)'}</span>
            <input type="file" accept=".db" style={{ display: 'none' }} onChange={handleRestore} disabled={restoreUploading} />
          </label>

          <button 
            type="button" 
            className="btn" 
            style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #f87171', fontSize: '0.85rem', padding: '8px 16px' }}
            onClick={handleClearData}
            disabled={loading}
          >
            <AlertCircle size={16} />
            <span>ล้างข้อมูลทดสอบ (Clear Test Data)</span>
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px' }}>
          * แนะนำให้สำรองข้อมูล (Backup) ทุกครั้งก่อนทำการแก้ไขหรือทดสอบระบบครั้งใหญ่
        </p>
      </div>
    </div>
  );
}
