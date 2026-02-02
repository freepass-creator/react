import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Download, RotateCw, X, Car, Share2, Copy, 
  ArrowUp, ArrowDown, ArrowUpDown, Filter, CheckCircle2 
} from 'lucide-react';

// --- [CSS STYLES] --- (무삭제 원칙: 1픽셀도 건드리지 않음)
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
  .erp-root { font-family: 'Noto Sans KR', sans-serif; font-size: 11px; background-color: #f1f3f6; color: #0f172a; user-select: none; }
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .sidebar-elevation { box-shadow: 4px 0 15px rgba(0, 0, 0, 0.08); }
  .btn-pressable { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); transition: all 0.12s ease; }
  .btn-pressable:active { transform: translateY(1.5px); }
  .natural-shadow { box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); }
  @keyframes drawerAppear { 0% { transform: translateX(100%); } 100% { transform: translateX(0); } }
  .animate-drawer-reset { animation: drawerAppear 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
`;

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREzDg6YIAoZBiSeT58g6sksXFZkILyX0hKJeuQIdfKxWDRgu7SX7epVkuKMjXvp8n10-sNCoWRyJdJ/pub?gid=1259006970&single=true&output=csv";

// 정밀 수정 원칙: 컬럼 순서 및 한글 표기 유지 [cite: 2026-01-27, 2026-02-02]
const baseColumns = { "상태": "차량_상태", "구분": "차량_구분", "차량번호": "차량_번호", "제조사": "차량_제조사", "모델": "차량_모델명", "세부모델": "차량_세부모델", "세부트림": "차량_세부트림", "외부색상": "차량_외부색상", "내부색상": "차량_내부색상", "주행거리": "차량_현재주행거리" };

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [managerInfo, setManagerInfo] = useState({
    company: localStorage.getItem('erp_company') || '프리패스모빌리티',
    nameTitle: localStorage.getItem('erp_nameTitle') || ''
  });

  // 데이터 연동 로직 (무삭제 원칙)
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
    <div className="erp-root" style={{ padding: '20px' }}>
      <style>{styles}</style>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0 }}>■ 프리패스모빌리티 통합 관리 시스템</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            placeholder="통합 검색..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '6px', border: '1px solid #ddd', width: '250px' }}
          />
          <button onClick={() => window.location.reload()} className="btn-pressable" style={{ padding: '5px 15px', cursor: 'pointer' }}>
            <RotateCw size={14} /> 데이터 갱신
          </button>
        </div>
      </header>

      {/* 테이블 영역 (태그 꼬임 정밀 교정) */}
      <div className="hide-scrollbar" style={{ marginTop: '20px', overflowX: 'auto', height: 'calc(100vh - 150px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              {Object.keys(baseColumns).map(label => (
                <th key={label} style={{ padding: '12px 8px', border: '1px solid #eee' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((car, idx) => (
              <tr 
                key={idx} 
                onClick={() => setSelectedCar(car)} 
                style={{ borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: selectedCar?.차량_번호 === car.차량_번호 ? '#f0f7ff' : '#fff' }}
              >
                {Object.values(baseColumns).map(key => (
                  <td key={key} style={{ padding: '10px 8px' }}>{key === '차량_현재주행거리' ? Number(car[key]).toLocaleString() + 'km' : car[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 상세 페이지 Drawer: 5단계 섹션 유지 [cite: 2026-01-27] */}
      {selectedCar && (
        <div className="animate-drawer-reset natural-shadow" style={{ position: 'fixed', right: 0, top: 0, width: '480px', height: '100%', backgroundColor: '#fff', padding: '30px', overflowY: 'auto', zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>■ 프리패스모빌리티 상세 정보</h3>
            <button onClick={() => setSelectedCar(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={24} /></button>
          </div>
          <hr />
          
          <div style={{ marginTop: '20px' }}>
            <section style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#2563eb', borderLeft: '4px solid #2563eb', paddingLeft: '10px' }}>1. 차량 상세 제원</h4>
              <p>차량번호: <b>{selectedCar.차량_번호}</b></p>
              <p>모델명: {selectedCar.차량_제조사} {selectedCar.차량_모델명} {selectedCar.차량_세부모델}</p>
            </section>

            <section style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#2563eb', borderLeft: '4px solid #2563eb', paddingLeft: '10px' }}>2. 대여료 정보</h4>
              <p>36개월: {selectedCar.금액_대여료_36M}원 / 보증금: {selectedCar.금액_보증금_36M}원</p>
            </section>

            <section style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#2563eb', borderLeft: '4px solid #2563eb', paddingLeft: '10px' }}>3. 보험 정보</h4>
              <p>자차 면책금: {selectedCar.보험_자차면책최소}만원 (최소)</p>
            </section>

            <section style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#2563eb', borderLeft: '4px solid #2563eb', paddingLeft: '10px' }}>4. 계약 정보</h4>
              <p>기본 연령: {selectedCar.계약_기본운전연령 || '만 26세 이상'}</p>
              <p>약정 거리: {selectedCar.계약_약정주행거리 || '2만km'}</p>
            </section>

            <section style={{ marginBottom: '25px' }}>
              <h4 style={{ color: '#2563eb', borderLeft: '4px solid #2563eb', paddingLeft: '10px' }}>5. 담당자 정보</h4>
              <input 
                value={managerInfo.nameTitle} 
                onChange={(e) => {
                  setManagerInfo({...managerInfo, nameTitle: e.target.value});
                  localStorage.setItem('erp_nameTitle', e.target.value);
                }}
                placeholder="담당자 성함/직책을 입력하세요" 
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <button className="btn-pressable" style={{ width: '100%', marginTop: '15px', padding: '15px', backgroundColor: '#0f172a', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                <Copy size={16} /> 고객 전달용 텍스트 복사
              </button>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
