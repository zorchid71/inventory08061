import React, { useState, useEffect } from 'react';
import { PackagePlus, PackageMinus, History, Search, Calendar, Save } from 'lucide-react';

const InventoryTransactions = () => {
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [departmentsSetting, setDepartmentsSetting] = useState([]);

  const [formData, setFormData] = useState({
    item_id: '',
    transaction_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    transaction_type: 'RECEIVE',
    quantity: '',
    unit_price: '',
    department: '',
    note: ''
  });

  useEffect(() => {
    fetchItems();
    fetchTransactions();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.departments) {
        const depts = data.departments.split(/[\n,]+/).map(d => d.trim()).filter(d => d);
        setDepartmentsSetting(depts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/inventory/master-items');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/inventory/transactions?limit=50');
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemNameChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    
    // Auto-select if perfectly matches
    const matchedItem = items.find(i => i.name === val);
    if (matchedItem) {
      setFormData({
        ...formData,
        item_id: matchedItem.id,
        unit_price: matchedItem.unit_price || ''
      });
    } else {
      setFormData({
        ...formData,
        item_id: ''
      });
    }
  };

  const handleItemSelect = (e) => {
    // Fallback for select dropdown if still used
    const selectedId = e.target.value;
    const item = items.find(i => i.id.toString() === selectedId);
    setFormData({
      ...formData,
      item_id: selectedId,
      unit_price: item ? item.unit_price : ''
    });
    if (item) setSearchTerm(item.name);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (!formData.item_id || !formData.quantity || !formData.unit_price) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    const item = items.find(i => i.id.toString() === formData.item_id.toString());
    
    if (formData.transaction_type === 'DISPENSE') {
      const currentStock = item ? item.current_stock : 0;
      if (parseFloat(formData.quantity) > currentStock) {
        alert(`ไม่สามารถจ่ายออกได้ เนื่องจากยอดคงเหลือในคลังมีเพียง ${currentStock}`);
        return;
      }
    }

    const itemName = item ? item.name : 'ไม่ทราบชื่อเวชภัณฑ์';

    const cartItem = {
      ...formData,
      cart_id: Date.now().toString(), // Unique ID for cart row
      itemName,
      quantity: parseFloat(formData.quantity),
      unit_price: parseFloat(formData.unit_price)
    };

    setCart([...cart, cartItem]);
    
    // Reset form for next item
    setFormData({ 
      ...formData, 
      item_id: '',
      quantity: '', 
      unit_price: '',
      note: '' 
    });
    setSearchTerm('');
  };

  const handleEditCartItem = (cartId) => {
    const itemToEdit = cart.find(c => c.cart_id === cartId);
    if (!itemToEdit) return;

    setFormData({
      item_id: itemToEdit.item_id,
      transaction_date: itemToEdit.transaction_date,
      transaction_type: itemToEdit.transaction_type,
      quantity: itemToEdit.quantity,
      unit_price: itemToEdit.unit_price,
      department: itemToEdit.department || '',
      note: itemToEdit.note || ''
    });
    setSearchTerm(itemToEdit.itemName);

    // Remove from cart
    setCart(cart.filter(c => c.cart_id !== cartId));
  };

  const handleDeleteCartItem = (cartId) => {
    setCart(cart.filter(c => c.cart_id !== cartId));
  };

  const handleSaveAll = async () => {
    if (cart.length === 0) return;
    
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    // We use Promise.allSettled to send all POSTs concurrently
    const promises = cart.map(item => 
      fetch('/api/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.item_id,
          transaction_date: item.transaction_date,
          transaction_type: item.transaction_type,
          quantity: item.quantity,
          unit_price: item.unit_price,
          department: item.department,
          note: item.note
        })
      }).then(async res => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed');
        }
        return res;
      })
    );

    const results = await Promise.allSettled(promises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled') successCount++;
      else errorCount++;
    });

    setLoading(false);

    if (errorCount === 0) {
      alert(`บันทึกรายการสำเร็จทั้งหมด ${successCount} รายการ`);
      setCart([]);
      fetchTransactions();
    } else {
      alert(`บันทึกสำเร็จ ${successCount} รายการ, ล้มเหลว ${errorCount} รายการ กรุณาตรวจสอบประวัติ`);
      // Optionally remove successful ones from cart:
      const newCart = cart.filter((_, index) => results[index].status === 'rejected');
      setCart(newCart);
      fetchTransactions();
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dynamicDepartments = [...new Set(transactions.map(t => t.department).filter(d => d && d.trim() !== ''))];
  const uniqueDepartments = departmentsSetting.length > 0 ? departmentsSetting : dynamicDepartments;

  return (
    <div className="transactions-container">
      <div className="grid-2col" style={{ gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        
        {/* Form Section */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PackagePlus size={20} color="#3b82f6" />
            ฟอร์มเพิ่มรายการ
          </h3>

          <form onSubmit={handleAddToCart} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Type */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                type="button"
                className={`btn ${formData.transaction_type === 'RECEIVE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, backgroundColor: formData.transaction_type === 'RECEIVE' ? '#10b981' : '', borderColor: formData.transaction_type === 'RECEIVE' ? '#10b981' : '', color: formData.transaction_type === 'RECEIVE' ? 'white' : '' }}
                onClick={() => setFormData({ ...formData, transaction_type: 'RECEIVE' })}
              >
                <PackagePlus size={18} /> รับเข้าคลัง
              </button>
              <button 
                type="button"
                className={`btn ${formData.transaction_type === 'DISPENSE' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, backgroundColor: formData.transaction_type === 'DISPENSE' ? '#ef4444' : '', borderColor: formData.transaction_type === 'DISPENSE' ? '#ef4444' : '', color: formData.transaction_type === 'DISPENSE' ? 'white' : '' }}
                onClick={() => setFormData({ ...formData, transaction_type: 'DISPENSE' })}
              >
                <PackageMinus size={18} /> จ่ายออก/เบิก
              </button>
            </div>

            {/* Date */}
            <div className="filter-group">
              <label>วันที่ทำรายการ <Calendar size={14} style={{ display: 'inline', marginLeft: '4px' }} /></label>
              <input 
                type="date" 
                className="form-select" 
                value={formData.transaction_date}
                onChange={e => setFormData({ ...formData, transaction_date: e.target.value })}
                required
              />
            </div>

            {/* Item Search & Select */}
            <div className="filter-group">
              <label>ค้นหา / เลือกเวชภัณฑ์</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#6b7280' }} />
                <input 
                  type="text" 
                  list="items-list"
                  className="form-select" 
                  placeholder="พิมพ์ค้นหา หรือเลือกจากรายการ..." 
                  value={searchTerm}
                  onChange={handleItemNameChange}
                  style={{ paddingLeft: '32px' }}
                  required
                />
                <datalist id="items-list">
                  {items.map(item => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </div>
              {!formData.item_id && searchTerm && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>
                  * กรุณาเลือกรายการเวชภัณฑ์ให้ถูกต้องจากรายการ
                </div>
              )}
              {formData.item_id && formData.transaction_type === 'DISPENSE' && (
                <div style={{ color: '#3b82f6', fontSize: '0.85rem', marginTop: '4px', display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#eff6ff', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                  <span>ยอดคงเหลือปัจจุบัน (Current Stock):</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {items.find(i => i.id.toString() === formData.item_id.toString())?.current_stock || 0}
                  </span>
                </div>
              )}
            </div>

            {/* Qty & Price */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="filter-group" style={{ flex: 1 }}>
                <label>จำนวน</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-select" 
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="filter-group" style={{ flex: 1 }}>
                <label>ราคา/หน่วย (บาท)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-select" 
                  value={formData.unit_price}
                  onChange={e => setFormData({ ...formData, unit_price: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Dept & Note */}
            <div className="filter-group">
              <label>แผนก / ผู้เบิก (ถ้ามี)</label>
              <input 
                type="text" 
                list="dept-list"
                className="form-select" 
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
                placeholder="ระบุชื่อตึกหรือบุคคล (พิมพ์หรือเลือก)..."
              />
              <datalist id="dept-list">
                {uniqueDepartments.map(d => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            
            <div className="filter-group">
              <label>หมายเหตุ</label>
              <input 
                type="text" 
                className="form-select" 
                value={formData.note}
                onChange={e => setFormData({ ...formData, note: e.target.value })}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}
            >
              เพิ่มลงรายการรออัปเดต
            </button>
          </form>
        </div>

        {/* Right Section: Cart and History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Cart Section */}
          {cart.length > 0 && (
            <div className="glass-card" style={{ border: '2px solid #3b82f6' }}>
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af' }}>
                <Save size={20} />
                รายการรออัปเดตเข้าคลัง ({cart.length} รายการ)
              </h3>
              
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table className="data-table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>ประเภท</th>
                      <th>รายการ</th>
                      <th style={{ textAlign: 'right' }}>จำนวน</th>
                      <th style={{ textAlign: 'right' }}>ราคารวม</th>
                      <th style={{ textAlign: 'center' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(c => (
                      <tr key={c.cart_id} style={{ backgroundColor: '#f8fafc' }}>
                        <td>{c.transaction_date}</td>
                        <td>
                          {c.transaction_type === 'RECEIVE' ? (
                            <span style={{ color: '#10b981', fontWeight: '600' }}>+ รับเข้า</span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: '600' }}>- จ่ายออก</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: '500' }}>{c.itemName}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{c.department ? `แผนก: ${c.department}` : ''}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{c.quantity}</td>
                        <td style={{ textAlign: 'right' }}>฿{(c.quantity * c.unit_price).toFixed(2)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.8rem', marginRight: '4px' }}
                            onClick={() => handleEditCartItem(c.cart_id)}
                          >
                            แก้ไข
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.8rem', color: '#ef4444', borderColor: '#fee2e2', backgroundColor: '#fef2f2' }}
                            onClick={() => handleDeleteCartItem(c.cart_id)}
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveAll}
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', backgroundColor: '#10b981', borderColor: '#10b981' }}
              >
                {loading ? 'กำลังบันทึกข้อมูล...' : `บันทึกข้อมูลทั้งหมดลงคลัง (${cart.length} รายการ)`}
              </button>
            </div>
          )}

        {/* History Section */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={20} color="#3b82f6" />
            ประวัติการทำรายการล่าสุด
          </h3>
          
          <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
            <table className="data-table" style={{ fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ประเภท</th>
                  <th>รายการ</th>
                  <th style={{ textAlign: 'right' }}>จำนวน</th>
                  <th style={{ textAlign: 'right' }}>ราคารวม</th>
                  <th>ผู้เบิก/หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>ไม่มีประวัติการทำรายการ</td>
                  </tr>
                ) : (
                  transactions.map(t => (
                    <tr key={t.id}>
                      <td>{t.transaction_date}</td>
                      <td>
                        {t.transaction_type === 'RECEIVE' ? (
                          <span style={{ color: '#10b981', fontWeight: '600' }}>+ รับเข้า</span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: '600' }}>- จ่ายออก</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{t.item_name}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>
                        {t.quantity} <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 'normal' }}>{t.unit}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>฿{t.total_value.toFixed(2)}</td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{t.department || '-'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{t.note}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryTransactions;
