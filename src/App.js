import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Download, RotateCw, X, Car, Share2, Copy, 
  ArrowUp, ArrowDown, ArrowUpDown, Filter, CheckCircle2 
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from "firebase/auth";
import { 
  getFirestore, doc, setDoc, getDoc 
} from "firebase/firestore";

// --- [CSS STYLES] --- (무삭제 원칙 준수)
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
  
  .erp-root {
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 11px;
    background-color: #f1f3f6;
    color: #0f172a;
    user-select: none;
  }

  .hide-scrollbar::-webkit-scrollbar { display: none; }
  
  .sidebar-elevation { 
    box-shadow: 4px 0 15px rgba(0, 0, 0, 0.08), 1px 0 3px rgba(0, 0, 0, 0.1); 
  }
  
  .btn-pressable { 
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
    transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .btn-pressable:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.08);
    transform: translateY(-0.5px);
  }
  .btn-pressable:active { 
    transform: translateY(1.5px);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .tactile-btn {
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.1s ease;
  }
  .tactile-btn:hover {
    background-color: #f8fafc;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  }
  .tactile-btn-active {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
    transform: translateY(2px);
    background-color: #f8fafc;
  }
  
  .natural-shadow { 
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05); 
  }
  
  .apply-btn-shadow { 
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
    transition: all 0.1s ease;
  }
  .apply-btn-shadow:hover { box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); }
  .apply-btn-shadow:active { transform: translateY(1px); box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1); }

  .tactile-section { transition: background-color 0.2s ease; }
  .tactile-section:hover { background-color: #fcfdfe; }

  .drawer-transition {
    transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .drawer-instant {
    transition: transform 0s;
  }
`;

// --- [CONFIG & CONSTANTS] ---
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREzDg6YIAoZBiSeT58g6sksXFZkILyX0hKJeuQIdfKxWDRgu7SX7epVkuKMjXvp8n10-sNCoWRyJdJ/pub?gid=1259006970&single=true&output=csv";

const baseColumns = { "상태": "차량_상태", "구분": "차량_구분", "차량번호": "차량_번호", "제조사": "차량_제조사", "모델": "차량_모델명", "세부모델": "차량_세부모델", "세부트림": "차량_세부트림", "외부색상": "차량_외부색상", "내부색상": "차량_내부색상", "주행거리": "차량_현재주행거리" };
const filterableColumns = ["상태", "구분", "제조사", "모델", "세부모델", "외부색상", "내부색상"];
const sortableColumns = ["주행거리"];

const rentalOptions = ['50만 이하', '50~60', '60~70', '70~80', '80~90', '90~100', '100만 이상'];
const depositOptions = ['100만 이하', '100~200', '200~300', '300~400', '400~500', '500만 이상'];
const mileageOptions = ['1만km 미만', '1~3만', '3~5만', '5~10만', '10만km 이상'];
const yearOptions = ['1년 이하', '1~3년', '3~5년', '5년 이상'];

// --- [UTILITIES] ---
const parseNum = (str) => {
  if (!str) return 0;
  const val = parseInt(String(str).replace(/[^0-9]/g, ''));
  return isNaN(val) ? 0 : val;
};

const formatPrice = (val) => parseNum(val).toLocaleString();
const formatPeriod = (p) => p ? p.replace('M', '개월') : "";

const formatDeductible = (val) => {
  if (!val || val === '-' || val === '0' || val === '없음') return '없음';
  const strVal = String(val).trim();
  if (/^\d+$/.test(strVal)) return strVal + '만원';
  return strVal;
};

const formatPercent = (val) => {
  if (!val || val === '-' || val === '0') return '30%';
  const strVal = String(val).trim();
  if (/^\d+$/.test(strVal)) return strVal + '%';
  return strVal;
};

const formatContractOption = (val) => {
  const v = String(val || '').trim();
  if (!v || v === '-' || v === '0' || v === '운영안함') return '운영안함';
  if (v.includes('%')) return `+대여료의 ${v} / 월`;
  const n = parseInt(v.replace(/[^0-9]/g, ''));
  return !isNaN(n) ? `+${n.toLocaleString()}원 / 월` : `+${v} / 월`;
};

const getBatteryCapacity = (c) => {
  const isEV = String(c.차량_연료).includes('전기');
  if (!isEV) return null;
  let cap = String(c.차량_배터리용량 || c.차량_배기량 || '').trim();
  if (cap && cap !== '-' && cap !== '0' && isNaN(parseInt(cap)) === false) {
    return /^\d+$/.test(cap) ? cap + 'kWh' : cap;
  }
  const model = String(c.차량_모델명 + c.차량_세부모델);
  if (model.includes('아이오닉5') || model.includes('EV6') || model.includes('아이오닉6')) return '77.4kWh';
  if (model.includes('포터') || model.includes('봉고')) return '58.8kWh';
  if (model.includes('테슬라') && (model.includes('Long') || model.includes('롱레인지'))) return '82kWh';
  if (model.includes('테슬라') && model.includes('Model Y')) return '60kWh';
  if (model.includes('EV3')) return '81.4kWh';
  if (model.includes('레이')) return '35.2kWh';
  if (model.includes('캐스퍼')) return '49kWh';
  if (model.includes('코나') || model.includes('니로')) return '64.8kWh';
  if (model.includes('GV60')) return '77.4kWh';
  return '확인필요';
};

const getStatusBadgeHtml = (text, type) => {
  if (!text) return null;
  let colorClass = "bg-slate-100 text-slate-600 border-slate-200";
  if (type === '구분') {
    if (text === '신차') colorClass = "bg-blue-50 text-blue-700 border-blue-100";
    else if (text === '중고') colorClass = "bg-slate-100 text-slate-700 border-slate-200";
  } else if (type === '상태' || type === '세부상태') {
    const t = String(text);
    if (t.includes('가능') || t === '출고가능' || t === '정상') colorClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
    else if (t.includes('완료') || t.includes('불가')) colorClass = "bg-rose-50 text-rose-700 border-rose-100";
    else colorClass = "bg-amber-50 text-amber-700 border-amber-100";
  }
  return (
    <span className={`inline-flex items-center justify-center px-1.5 py-0.5 border text-[10px] font-bold leading-none whitespace-nowrap rounded-none ${colorClass}`}>
      {text}
    </span>
  );
};

// --- [MAIN COMPONENT] ---
export default function App() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [selectedPeriods, setSelectedPeriods] = useState(['36M', '48M', '60M']);
  const [columnFilters, setColumnFilters] = useState({});
  const [sidebarFilters, setSidebarFilters] = useState({ rental: [], deposit: [], mileage: [], year: [] });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  const [activeSidebarPopup, setActiveSidebarPopup] = useState(null);
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [triggerRect, setTriggerRect] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  
  const [managerInfo, setManagerInfo] = useState({
    company: '',
    nameTitle: '',
    phone: '',
    includeAccount: false
  });

  const [copySuccess, setCopySuccess] = useState({ link: false, summary: false, account: false });
  const appRef = useRef(null);

  // Initialize Firebase & Manager Info (Build Safe)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setManagerInfo({
        company: localStorage.getItem('erp_manager_company') || '프리패스모빌리티',
        nameTitle: localStorage.getItem('erp_manager_nameTitle') || '',
        phone: localStorage.getItem('erp_manager_phone') || '',
        includeAccount: localStorage.getItem('erp_manager_includeAccount') === 'true'
      });

      try {
        const firebaseConfigStr = window.__firebase_config;
        if (firebaseConfigStr) {
          const firebaseConfig = typeof firebaseConfigStr === 'string' ? JSON.parse(firebaseConfigStr) : firebaseConfigStr;
          const app = initializeApp(firebaseConfig);
          const auth = getAuth(app);
          
          onAuthStateChanged(auth, (user) => {
            if (user) fetchData(false);
            else signInAnonymously(auth).then(() => fetchData(false));
          });
        } else {
          fetchData(false);
        }
      } catch (e) {
        console.warn("Firebase 초기화 건너뜀", e);
        fetchData(false);
      }
    }
  }, []);

  const fetchData = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await fetch(`${CSV_URL}&cb=${Date.now()}`);
      const text = await res.text();
      const rows = text.split(/\r?\n/).filter(r => r.trim());
      if (rows.length === 0) return;
      
      const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const parsed = rows.slice(1).map(row => {
        const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v ? v.trim().replace(/^"|"$/g, '').replace(/""/g, '"') : "");
        return headers.reduce((obj, header, i) => { obj[header] = values[i] || ""; return obj; }, {});
      });
      setRawData(parsed);
      if (isManual) {
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000);
      }
    } catch (e) {
      console.error("데이터 로드 오류", e);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = rawData.filter(item => {
      const matchesSearch = Object.values(item).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesColumnFilters = Object.entries(columnFilters).every(([col, selectedValues]) => {
        if (!selectedValues || selectedValues.length === 0) return true;
        return selectedValues.includes(String(item[col]));
      });
      return matchesSearch && matchesColumnFilters;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key] || "";
        let bVal = b[sortConfig.key] || "";
        if (sortConfig.key === '차량_현재주행거리' || sortConfig.key.includes('금액')) {
          aVal = parseNum(aVal); bVal = parseNum(bVal);
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [rawData, searchTerm, columnFilters, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const toggleSidebarPopup = (id, e) => {
    if (activeSidebarPopup === id) setActiveSidebarPopup(null);
    else { setActiveSidebarPopup(id); setTriggerRect(e.currentTarget.getBoundingClientRect()); }
  };

  const closeAllPopups = () => { setActiveSidebarPopup(null); setActiveFilterColumn(null); };

  const handleCopySummary = () => {
    if (!selectedCar) return;
    const c = selectedCar;
    let text = `[상품 상세 정보]\n\n`;
    text += `1. 차량 상세 제원\n• 모델명: ${c.차량_제조사} ${c.차량_모델명}\n• 차량번호: ${c.차량_번호}\n\n`;
    text += `2. 대여료 정보\n• 월 대여료: ${c.금액_대여료_36M}원\n\n`;
    text += `3. 보험 정보\n• 자차 면책금: ${formatDeductible(c.보험_자차면책최소)}\n\n`;
    text += `4. 계약 정보\n• 약정거리: ${c.계약_약정주행거리 || '2만km'}\n\n`;
    text += `5. 담당자: ${managerInfo.nameTitle || '-'}`;
    
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    setCopySuccess(p => ({ ...p, summary: true }));
    setTimeout(() => setCopySuccess(p => ({ ...p, summary: false })), 2000);
  };

  const handleCarSelect = (item) => {
    if (selectedCar?.차량_번호 === item.차량_번호) setSelectedCar(null);
    else { setSelectedCar(null); setTimeout(() => setSelectedCar(item), 50); }
  };

  return (
    <div className="erp-root overflow-hidden border-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{styles}</style>
      <div id="app" ref={appRef} className="flex h-screen overflow-hidden">
        {/* 좌측 필터바 */}
        <div className="w-[72px] bg-white border-r border-slate-200 flex flex-col sidebar-elevation">
          <div className="mt-[80px] flex flex-col items-center gap-2 px-1.5">
            {['기간', '대여료', '보증금', '주행거리', '연식'].map((label, i) => (
              <button key={i} className="w-full h-[40px] border border-slate-100 tactile-btn bg-white text-[10px] font-bold text-slate-700">{label}</button>
            ))}
          </div>
          <div className="mt-auto mb-6 px-1.5"><button className="w-full h-[52px] border border-slate-100 tactile-btn bg-white text-[#1D6F42]"><Download size={16} /></button></div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 relative">
          <header className="h-[50px] bg-white border-b border-slate-200 flex items-center px-4 gap-4 z-20 shadow-sm">
            <h1 className="text-[14px] font-black whitespace-nowrap">■ 프리패스모빌리티 ERP</h1>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="검색어 입력..." className="w-full max-w-sm pl-4 py-2 border border-slate-200 text-xs outline-none" />
            <div className="ml-auto flex items-center gap-4">
              <span className="text-[11px] font-bold text-slate-400">데이터 연동: <b>{filteredData.length}</b>건</span>
              <button onClick={() => fetchData(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 font-bold text-[11px]"><RotateCw size={12} className={loading ? 'animate-spin' : ''} /> 데이터 갱신</button>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full border-collapse table-fixed text-[11px]">
              <thead className="sticky top-0 bg-[#f8f9fb] border-b border-slate-300 z-10 font-bold text-slate-600">
                <tr className="divide-x divide-slate-200">
                  {Object.keys(baseColumns).map(label => <th key={label} className="py-2">{label}</th>)}
                  <th className="py-2 bg-blue-50 text-blue-800">36개월 대여료</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-center text-slate-800">
                {filteredData.map(item => (
                  <tr key={item.차량_번호} onClick={() => handleCarSelect(item)} className={`hover:bg-slate-50 cursor-pointer h-[52px] transition-colors ${selectedCar?.차량_번호 === item.차량_번호 ? 'bg-blue-50 font-bold' : ''}`}>
                    <td className="p-2">{getStatusBadgeHtml(item.차량_상태, "상태")}</td>
                    <td className="p-2">{getStatusBadgeHtml(item.차량_구분, "구분")}</td>
                    <td className="p-2 font-bold">{item.차량_번호}</td>
                    <td className="p-2">{item.차량_제조사}</td>
                    <td className="p-2 font-bold">{item.차량_모델명}</td>
                    <td className="p-2 truncate">{item.차량_세부모델}</td>
                    <td className="p-2 leading-none"><div>{item.차량_세부트림}</div><div className="text-[9px] text-slate-400 mt-1">{item.차량_선택옵션}</div></td>
                    <td className="p-2">{item.차량_외부색상}</td>
                    <td className="p-2">{item.차량_내부색상}</td>
                    <td className="p-2 text-right px-4 font-bold">{formatPrice(item.차량_현재주행거리)}km</td>
                    <td className="p-2 bg-blue-50/30 text-blue-800 font-black text-right px-4">{item.금액_대여료_36M}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div id="detail-drawer" className={`absolute right-0 top-0 h-full w-[440px] bg-white natural-shadow z-[100] flex flex-col border-l border-slate-200 ${selectedCar ? 'translate-x-0 drawer-transition' : 'translate-x-full drawer-instant'}`}>
            {selectedCar && (
              <div className="flex flex-col h-full">
                <div className="h-[50px] flex justify-between items-center px-4 bg-white border-b border-slate-100 text-slate-800 flex-shrink-0">
                  <h2 className="font-bold text-[12px] flex items-center gap-2"><Car size={18} /> 상품 상세 정보</h2>
                  <button onClick={() => setSelectedCar(null)} className="text-slate-400 hover:text-slate-800 p-1"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-white text-[11px] text-slate-800 hide-scrollbar">
                  <section className="border border-slate-200 p-3 shadow-sm bg-white">
                    <h3 className="font-bold text-blue-700 border-b border-slate-100 pb-2 mb-2 text-[12px]">1. 차량 상세 제원</h3>
                    <div className="space-y-1.5">
                      <div>모델: <b>{selectedCar.차량_제조사} {selectedCar.차량_모델명}</b></div>
                      <div>번호: <b className="text-blue-600">{selectedCar.차량_번호}</b></div>
                    </div>
                  </section>
                  <section className="border border-slate-200 p-3 shadow-sm bg-white">
                    <h3 className="font-bold text-blue-700 border-b border-slate-100 pb-2 mb-2 text-[12px]">2. 대여료 정보</h3>
                    <div className="font-black text-blue-800 text-[14px]">36개월: 월 {selectedCar.금액_대여료_36M}원</div>
                  </section>
                  <section className="border border-slate-200 p-3 shadow-sm bg-white">
                    <h3 className="font-bold text-blue-700 border-b border-slate-100 pb-2 mb-2 text-[12px]">3. 보험 정보</h3>
                    <div>자차 면책: {formatDeductible(selectedCar.보험_자차면책최소)}</div>
                  </section>
                  <section className="border border-slate-200 p-3 shadow-sm bg-white">
                    <h3 className="font-bold text-blue-700 border-b border-slate-100 pb-2 mb-2 text-[12px]">4. 계약 정보</h3>
                    <div>약정거리: {selectedCar.계약_약정주행거리 || '2만km'}</div>
                  </section>
                  <section className="border border-slate-200 p-3 shadow-sm bg-slate-50 space-y-3">
                    <h3 className="font-bold text-blue-700 border-b border-slate-100 pb-2 mb-2 text-[12px]">5. 담당자 정보</h3>
                    <input value={managerInfo.nameTitle} onChange={(e) => {
                      const val = e.target.value; setManagerInfo({...managerInfo, nameTitle: val}); localStorage.setItem('erp_manager_nameTitle', val);
                    }} className="w-full border border-slate-300 p-2 text-[11px] font-bold" placeholder="성함/직책" />
                    <button onClick={handleCopySummary} className="w-full bg-slate-800 text-white py-3 font-bold flex items-center justify-center gap-2">
                      <Copy size={16} /> {copySuccess.summary ? '텍스트 복사됨' : '전달용 텍스트 복사'}
                    </button>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
