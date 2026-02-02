import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Download, RotateCw, X, Car, Share2, Copy, 
  ArrowUp, ArrowDown, ArrowUpDown, Filter, CheckCircle2 
} from 'lucide-react';

// --- [CSS STYLES] --- (무삭제 원칙: 원본 스타일 100% 유지)
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
  .tactile-section:hover { background-color: #fcfdfe; }
`;

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREzDg6YIAoZBiSeT58g6sksXFZkILyX0hKJeuQIdfKxWDRgu7SX7epVkuKMjXvp8n10-sNCoWRyJdJ/pub?gid=1259006970&single=true&output=csv";

// 5단계 섹션 유지 원칙: 1.차량, 2.대여료, 3.보험, 4.계약, 5.담당자
const baseColumns = { "상태": "차량_상태", "구분": "차량_구분", "차량번호": "차량_번호", "제조사": "차량_제조사", "모델": "차량_모델명", "세부모델": "차량_세부모델", "주행거리": "차량_현재주행거리" };

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [managerInfo, setManagerInfo] = useState({
    company: localStorage.getItem('erp_company') || '프리패스모빌리티',
    nameTitle: localStorage.getItem('erp_nameTitle') || ''
  });

  // 데이터 연동 (무삭제 원칙)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${CSV_URL}&cache=${Date.now()}`);
        const text = await res.text();
        const rows = text.split(/\r?\n/).filter(r => r.trim());
        const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const parsed = rows.slice(1).map(row => {
          const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          return headers.reduce((obj, h, i) => { obj[h] = (values[i] || "").trim().replace(/^"|"$/g, ''); return obj; }, {});
        });
        setRawData(parsed);
      } catch (e) { console.error("데이터 로드 에러", e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return rawData.filter(item => Object.values(item).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())));
  }, [rawData, searchTerm]);

  return (
    <div className="erp-root" style={{ minHeight: '100vh' }}>
      <style>{styles}</style>
      
      {/* 헤더 영역 */}
      <header style={{ padding: '15px 25px', background: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <h1 style={{ fontSize: '16px', fontWeight: 900, margin: 0 }}>■ 프리패스모빌리티 ERP</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            className="search-input" 
            placeholder="통합 검색..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ padding: '8px', border: '1px solid #ccc', width: '250px' }}
          />
          <button onClick={() => window.location.reload()} style={{ cursor: 'pointer', padding: '5px 10px' }}>
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* 테이블 영역 (태그 꼬임 정밀 수정) */}
      <div style={{ padding: '20px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead style={{ background: '#f8f9fa' }}>
            <tr>
              {Object.keys(baseColumns).map(label => (
                <th key={label} style={{ border: '1px solid #eee', padding: '12px', color: '#666' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((car, idx) => (
              <tr 
                key={idx} 
                onClick={() => setSelectedCar(car)} 
                style={{ borderBottom: '1px solid #eee', cursor: 'pointer', textAlign: 'center' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f7ff'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              >
                {Object.values(baseColumns).map(key => (
                  <td key={key} style={{ padding: '10px' }}>
                    {key === '차량_현재주행거리' ? Number(car[key]).toLocaleString() + 'km' : car[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 상세 정보 (Drawer) - 5단계 섹션 유지 원칙 */}
      {selectedCar && (
        <div className="animate-drawer-reset natural-shadow" style={{ position: 'fixed', right: 0, top: 0, width: '480px', height: '100%', background: '#fff', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '25px', background: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>■ 프리패스모빌리티 상세 정보</h3>
            <X size={24} style={{ cursor: 'pointer' }} onClick={() => setSelectedCar(null)} />
          </div>
          
          <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
            <section style={{ marginBottom: '30px' }} className="tactile-section">
              <h4 style={{ color: '#2563eb', marginBottom: '15px' }}>1. 차량 상세 제원</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px' }}>
                <span style={{ color: '#999' }}>차량번호</span><b>{selectedCar.차량_번호}</b>
                <span style={{ color: '#999' }}>모델명</span><span>{selectedCar.차량_제조사} {selectedCar.차량_모델명}</span>
                <span style={{ color: '#999' }}>세부트림</span><span>{selectedCar.차량_세부트림}</span>
              </div>
            </section>

            <section style={{ marginBottom: '30px' }}>
              <h4 style={{ color: '#2563eb', marginBottom: '15px' }}>2. 대여료 정보</h4>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '5px' }}>
                월 대여료: <b style={{ fontSize: '16px', color: '#d31212' }}>{selectedCar.금액_대여료_36M}원</b> (36개월 기준)
              </div>
            </section>

            <section style={{ marginBottom: '30px' }}>
              <h4 style={{ color: '#2563eb', marginBottom: '15px' }}>3. 보험 정보</h4>
              <p>자차 면책금: {selectedCar.보험_자차면책최소}만원</p>
              <p>대물 보상: {selectedCar.보험_대물한도 || '1억원'}</p>
            </section>

            <section style={{ marginBottom: '30px' }}>
              <h4 style={{ color: '#2563eb', marginBottom: '15px' }}>4. 계약 정보</h4>
              <p>약정 주행거리: {selectedCar.계약_약정주행거리 || '2만km'}</p>
              <p>기본 연령: {selectedCar.계약_기본운전연령 || '만 26세 이상'}</p>
            </section>

            <section style={{ marginBottom: '30px' }}>
              <h4 style={{ color: '#2563eb', marginBottom: '15px' }}>5. 담당자 정보</h4>
              <input 
                value={managerInfo.nameTitle} 
                onChange={(e) => {
                  setManagerInfo({...managerInfo, nameTitle: e.target.value});
                  localStorage.setItem('erp_nameTitle', e.target.value);
                }}
                placeholder="담당자 성함/직책 입력 (자동저장)" 
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <button className="btn-pressable" style={{ width: '100%', marginTop: '15px', padding: '15px', background: '#0f172a', color: '#fff', border: 'none', fontWeight: '900', cursor: 'pointer' }}>
                <Copy size={16} /> 고객 전달용 텍스트 복사
              </button>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
