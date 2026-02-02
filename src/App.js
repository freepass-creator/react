import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, RotateCw, X, Car, Share2, Copy, Filter, CheckCircle2 } from 'lucide-react';

// --- [CONFIG] ---
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREzDg6YIAoZBiSeT58g6sksXFZkILyX0hKJeuQIdfKxWDRgu7SX7epVkuKMjXvp8n10-sNCoWRyJdJ/pub?gid=1259006970&single=true&output=csv";
const baseColumns = { "상태": "차량_상태", "구분": "차량_구분", "차량번호": "차량_번호", "제조사": "차량_제조사", "모델": "차량_모델명", "주행거리": "차량_현재주행거리" };

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [managerInfo, setManagerInfo] = useState({
    company: localStorage.getItem('erp_company') || '',
    name: localStorage.getItem('erp_name') || ''
  });

  // 데이터 연동 (무삭제 원칙 준수)
  useEffect(() => {
    const fetchERPData = async () => {
      try {
        const res = await fetch(`${CSV_URL}&cb=${Date.now()}`);
        const text = await res.text();
        const rows = text.split(/\r?\n/).filter(r => r.trim());
        const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const parsed = rows.slice(1).map(row => {
          const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          return headers.reduce((obj, h, i) => { obj[h] = (values[i] || "").trim().replace(/^"|"$/g, ''); return obj; }, {});
        });
        setRawData(parsed);
      } catch (e) { console.error("연동 실패", e); }
    };
    fetchERPData();
  }, []);

  const filteredData = useMemo(() => {
    return rawData.filter(item => Object.values(item).some(v => String(v).includes(searchTerm)));
  }, [rawData, searchTerm]);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        <h2>■ 프라이패스 모빌리티 ERP</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input placeholder="검색어 입력..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '5px' }} />
          <button onClick={() => window.location.reload()}><RotateCw size={14} /></button>
        </div>
      </header>

      {/* 차량 목록 테이블 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead style={{ backgroundColor: '#eee' }}>
          <tr>{Object.keys(baseColumns).map(label => <th key={label} style={{ border: '1px solid #ddd', padding: '8px' }}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {filteredData.map((car, idx) => (
            <tr key={idx} onClick={() => setSelectedCar(car)} style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}>
              {Object.values(baseColumns).map(key => <td key={key} style={{ padding: '8px', textAlign: 'center' }}>{car[key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 우측 상세 페이지 Drawer (5단계 섹션 유지) [cite: 2026-01-27] */}
      {selectedCar && (
        <div style={{ position: 'fixed', right: 0, top: 0, width: '450px', height: '100%', backgroundColor: '#fff', boxShadow: '-2px 0 10px rgba(0,0,0,0.1)', padding: '20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>■ 상품 상세 정보</h3>
            <button onClick={() => setSelectedCar(null)}><X /></button>
          </div>
          <hr />
          
          <section>
            <h4>1. 차량 상세 제원</h4>
            <p>차량번호: {selectedCar.차량_번호}</p>
            <p>모델명: {selectedCar.차량_제조사} {selectedCar.차량_모델명}</p>
          </section>

          <section>
            <h4>2. 대여료 정보</h4>
            <p>36개월 대여료: {selectedCar.금액_대여료_36M}원</p>
          </section>

          <section>
            <h4>3. 보험 정보</h4>
            <p>자차 면책금: {selectedCar.보험_자차면책최소}만원</p>
          </section>

          <section>
            <h4>4. 계약 정보</h4>
            <p>약정 주행거리: {selectedCar.계약_약정주행거리}</p>
          </section>

          <section>
            <h4>5. 담당자 정보</h4>
            <input 
              value={managerInfo.name} 
              onChange={(e) => {
                setManagerInfo({...managerInfo, name: e.target.value});
                localStorage.setItem('erp_name', e.target.value);
              }} 
              placeholder="담당자 성명" 
              style={{ width: '100%', padding: '10px' }}
            />
            <button style={{ width: '100%', marginTop: '10px', padding: '10px', backgroundColor: '#333', color: '#fff' }}>전달용 텍스트 복사</button>
          </section>
        </div>
      )}
    </div>
  );
}
