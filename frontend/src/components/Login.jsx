import React, { useState } from 'react';
import { Lock, User, LogIn, Server } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function Login({ setToken }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { password }
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      } else {
        setError(data.error || 'รหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      setError(err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: '"Prompt", sans-serif'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '24px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0fb97f 0%, #0b8a5e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '28px',
            fontWeight: 'bold',
            boxShadow: '0 10px 15px -3px rgba(15, 185, 127, 0.3)'
          }}>
            H
          </div>
        </div>

        <h2 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: '24px', fontWeight: '600' }}>Smart HOSxP</h2>
        <p style={{ margin: '0 0 32px 0', color: '#6b7280', fontSize: '14px' }}>เข้าสู่ระบบจัดการคลังเวชภัณฑ์</p>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            color: '#ef4444',
            padding: '12px',
            borderRadius: '12px',
            marginBottom: '24px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Lock size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '16px', top: '14px', color: '#9ca3af' }}>
              <Lock size={20} />
            </div>
            <input
              type="password"
              placeholder="รหัสผ่านผู้ดูแลระบบ"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                borderRadius: '14px',
                border: '1px solid #e5e7eb',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: loading ? '#9ca3af' : '#0fb97f',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s',
              boxShadow: loading ? 'none' : '0 4px 6px -1px rgba(15, 185, 127, 0.2)'
            }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : (
              <>
                <LogIn size={20} />
                เข้าสู่ระบบ
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
