import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, RotateCw, X, Car, Copy, CheckCircle2, ChevronRight } from 'lucide-react';

// --- [CSS STYLES] --- (현대적인 ERP 스타일 적용)
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
  .erp-root { font-family: 'Noto Sans KR', sans-serif; background-color: #f8fafc; color: #1e293b; min-height: 100vh; }
  .main-header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 50; }
  .search-box { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 15px; width: 300px; border-radius: 6px; outline: none; transition: 0.2s; }
  .search-box:focus { border-color: #3b82f6; background: #fff; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
  .table-card { background: #fff; margin: 20px; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  table { width: 100%; border-collapse: collapse; text-align: center; font-size: 13px; }
  thead { background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
  th { padding: 15px; color: #64748b; font-weight: 700; }
  td { padding: 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: 0.1s; }
  tr:hover td { background-color: #f0f9ff; }
  .drawer { position: fixed; right: 0; top: 0; width: 480px; height: 100%; background: #fff; box-shadow: -10px 0 30px rgba(0,0,0,0.1); z-index: 100; display: flex; flex-direction: column; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .drawer-header { padding: 25px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #1e293b; color: #fff; }
  .section-card { padding: 25px; border-bottom: 1px solid #f1f5f9; }
  .section-title { font-size: 14px; font-weight: 900; color: #3b82f6; margin-bottom: 15px; display: flex; items-center; gap: 8px; }
  .badge { padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; }
  .badge-blue { background: #eff6ff; color: #1d4ed8; }
`;

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREzDg6YIAoZBiSeT58g6sksXFZkILyX0hKJeuQIdfKxWDRgu7SX7epVkuKMjXvp8n10-sNCoWRyJdJ/pub?gid=1259006970&single=true&output=csv";

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
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
      } catch (e) { console.error("연동 에러", e); }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return rawData.filter(item => Object.values(item).some(v => String(v).includes(searchTerm)));
  }, [rawData, searchTerm]);

  return (
    <div className="erp-root">
      <style>{styles}</style>
      
      <header className="main-header">
        <h1 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>■ 프리패스모빌리티 ERP</h1>
        <div style={{ display: 'flex', gap: '15px' }}>
          <input className="search-box" placeholder="매물 통합 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button onClick={() => window.location.reload()} style={{ cursor: 'pointer', border: 'none', background: 'none' }}><RotateCw size={20} color="#64748b" /></button>
        </div>
      </header>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>상태</th><th>차량번호</th><th>제조사</th><th>모델명</th><th>주행거리</th><th>대여료(36M)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((car, idx) => (
              <tr key={idx} onClick={() => setSelectedCar(car)}>
                <td><span className="badge badge-blue">{car.차량_상태}</span></td>
                <td style={{ fontWeight: 700 }}>{car.차량_번호}</td>
                <td>{car.차량_제조사}</td>
                <td style={{ textAlign: 'left', fontWeight: 700 }}>{car.차량_모델명}</td>
                <td style={{ textAlign: 'right', paddingRight: '20px' }}>{Number(car.차량_현재주행거리 || 0).toLocaleString()}km</td>
                <td style={{ color: '#2563eb', fontWeight: 900 }}>{car.금액_대여료_36M}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCar && (
        <div className="drawer">
          <div className="drawer-header">
            <h3 style={{ margin: 0 }}>■ 프리패스모빌리티 상세 정보</h3>
            <X size={24} style={{ cursor: 'pointer' }} onClick={() => setSelectedCar(null)} />
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* 정밀 수정 원칙: 5단계 섹션 유지 */}
            <div className="section-card">
              <div className="section-title"><Car size={16} /> 1. 차량 상세 제원</div>
              <p>차량번호: <b>{selectedCar.차량_번호}</b></p>
              <p>모델명: {selectedCar.차량_제조사} {selectedCar.차량_모델명}</p>
              <p>세부모델: {selectedCar.차량_세부모델}</p>
            </div>

            <div className="section-card">
              <div className="section-title">2. 대여료 정보</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                <div>36개월</div><div style={{ fontWeight: 900, color: '#2563eb' }}>월 {selectedCar.금액_대여료_36M}원</div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-title">3. 보험 정보</div>
              <p>자차 면책금: {selectedCar.보험_자차면책최소}만원</p>
              <p>보험 범위: {selectedCar.보험_대인한도 || '무한'} / {selectedCar.보험_대물한도 || '1억'}</p>
            </div>

            <div className="section-card">
              <div className="section-title">4. 계약 정보</div>
              <p>약정 주행거리: {selectedCar.계약_약정주행거리 || '2만km'}</p>
              <p>기본 연령: {selectedCar.계약_기본운전연령 || '만 26세 이상'}</p>
            </div>

            <div className="section-card">
              <div className="section-title">5. 담당자 정보</div>
              <div style={{ marginBottom: '15px' }}>
                <input style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }} placeholder="담당자 연락처 자동 저장" />
              </div>
              <button style={{ width: '100%', padding: '15px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <Copy size={18} /> 고객 전달용 텍스트 복사
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
