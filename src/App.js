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
  
  .erp-root { font-family: 'Noto Sans KR', sans-serif; font-size: 11px; background-color: #f1f3f6; color: #0f172a; user-select: none; }
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .sidebar-elevation { box-shadow: 4px 0 15px rgba(0, 0, 0, 0.08), 1px 0 3px rgba(0, 0, 0, 0.1); }
  .btn-pressable { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1); }
  .btn-pressable:hover { transform: translateY(-0.5px); }
  .btn-pressable:active { transform: translateY(1.5px); }
  .tactile-btn { box-shadow: 0 3px 6px rgba(0, 0, 0, 0.06); transition: all 0.1s ease; }
  .tactile-btn-active { transform: translateY(2px); background-color: #f8fafc; }
  .natural-shadow { box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); }
  .apply-btn-shadow { box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08); transition: all 0.1s ease; }
  .tactile-section { transition: background-color 0.2s ease; }
  .tactile-section:hover { background-color: #fcfdfe; }
  .drawer-transition { transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
  .drawer-instant { transition: transform 0s; }
`;

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREzDg6YIAoZBiSeT58g6sksXFZkILyX0hKJeuQIdfKxWDRgu7SX7epVkuKMjXvp8n10-sNCoWRyJdJ/pub?gid=1259006970&single=true&output=csv";

const baseColumns = { "상태": "차량_상태", "구분": "차량_구분", "차량번호": "차량_번호", "제조사": "차량_제조사", "모델": "차량_모델명", "세부모델": "차량_세부모델", "세부트림": "차량_세부트림", "외부색상": "차량_외부색상", "내부색상": "차량_내부색상", "주행거리": "차량_현재주행거리" };
const filterableColumns = ["상태", "구분", "제조사", "모델", "세부모델", "외부색상", "내부색상"];
const sortableColumns = ["주행거리"];

const rentalOptions = ['50만 이하', '50~60', '60~70', '70~80', '80~90', '90~100', '100만 이상'];
const depositOptions = ['100만 이하', '100~200', '200~300', '300~400', '400~500', '500만 이상'];
const mileageOptions = ['1만km 미만', '1~3만', '3~5만', '5~10만', '10만km 이상'];
const yearOptions = ['1년 이하', '1~3년', '3~5년', '5년 이상'];

const parseNum = (str) => { if (!str) return 0; const val = parseInt(String(str).replace(/[^0-9]/g, '')); return isNaN(val) ? 0 : val; };
const formatPrice = (val) => parseNum(val).toLocaleString();
const formatPeriod = (p) => p ? p.replace('M', '개월') : "";
const formatDeductible = (val) => { if (!val || val === '-' || val === '0' || val === '없음') return '없음'; const strVal = String(val).trim(); return /^\d+$/.test(strVal) ? strVal + '만원' : strVal; };
const formatPercent = (val) => { if (!val || val === '-' || val === '0') return '30%'; const strVal = String(val).trim(); return /^\d+$/.test(strVal) ? strVal + '%' : strVal; };
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
  if (cap && cap !== '-' && cap !== '0' && isNaN(parseInt(cap)) === false) return /^\d+$/.test(cap) ? cap + 'kWh' : cap;
  const model = String(c.차량_모델명 + c.차량_세부모델);
  if (model.includes('아이오닉5') || model.includes('EV6') || model.includes('아이오닉6')) return '77.4kWh';
  return '확인필요';
};

const getStatusBadgeHtml = (text, type) => {
  if (!text) return null;
  let colorClass = "bg-slate-100 text-slate-600 border-slate-200";
  if (type === '구분' && text === '신차') colorClass = "bg-blue-50 text-blue-700 border-blue-100";
  else if (type === '상태' && (String(text).includes('가능') || text === '정상')) colorClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
  return <span className={`inline-flex items-center justify-center px-1.5 py-0.5 border text-[10px] font-bold rounded-none ${colorClass}`}>{text}</span>;
};

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
  const [managerInfo, setManagerInfo] = useState({ company: '', nameTitle: '', phone: '', includeAccount: false });
  const [copySuccess, setCopySuccess] = useState({ link: false, summary: false, account: false });
  const appRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setManagerInfo({
        company: localStorage.getItem('erp_manager_company') || '프리패스모빌리티',
        nameTitle: localStorage.getItem('erp_manager_nameTitle') || '',
        phone: localStorage.getItem('erp_manager_phone') || '',
        includeAccount: localStorage.getItem('erp_manager_includeAccount') === 'true'
      });
      fetchData(false);
    }
  }, []);

  const fetchData = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await fetch(`${CSV_URL}&cb=${Date.now()}`);
      const text = await res.text();
      const rows = text.split(/\r?\n/).filter(r => r.trim());
      const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const parsed = rows.slice(1).map(row => {
        const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v ? v.trim().replace(/^"|"$/g, '').replace(/""/g, '"') : "");
        return headers.reduce((obj, header, i) => { obj[header] = values[i] || ""; return obj; }, {});
      });
      setRawData(parsed);
      if (isManual) { setToastVisible(true); setTimeout(() => setToastVisible(false), 2000); }
    } catch (e) { console.error("데이터 로드 오류", e); } finally { if (isManual) setLoading(false); }
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
        let aVal = a[sortConfig.key] || ""; let bVal = b[sortConfig.key] || "";
        if (sortConfig.key === '차량_현재주행거리') { aVal = parseNum(aVal); bVal = parseNum(bVal); }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [rawData, searchTerm, columnFilters, sortConfig]);

  const handleCarSelect = (item) => {
    if (selectedCar?.차량_번호 === item.차량_번호) setSelectedCar(null);
    else { setSelectedCar(null); setTimeout(() => setSelectedCar(item), 50); }
  };

  const closeAllPopups = () => { setActiveSidebarPopup(null); setActiveFilterColumn(null); setTriggerRect(null); };

  const handleCopySummary = () => {
    if (!selectedCar) return;
    const c = selectedCar;
    let text = `[프리패스모빌리티 상품 상세]\n• 차량번호: ${c.차량_번호}\n• 모델명: ${c.차량_제조사} ${c.차량_모델명}\n• 월 대여료: ${c.금액_대여료_36M}원\n• 담당자: ${managerInfo.nameTitle}`;
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    setCopySuccess(p => ({ ...p, summary: true })); setTimeout(() => setCopySuccess(p => ({ ...p, summary: false })), 2000);
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

        {/* 메인 영역 */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <header className="h-[50px] bg-white border-b border-slate-200 flex items-center px-4 gap-4 z-20 shadow-sm">
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="프리패스모빌리티 매물 검색..." className="w-full max-w-sm pl-4 py-2 border border-slate-200 text-xs outline-none" />
            <div className="ml-auto flex items-center gap-4">
              <span className="text-[11px] font-bold text-slate-400">연동 데이터: <b>{filteredData.length}</b>건</span>
              <button onClick={() => fetchData(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 font-bold text-[11px]"><RotateCw size={12} /> 데이터 갱신</button>
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
              <tbody className="divide-y divide-slate-100 text-center">
                {filteredData.map(item => (
                  <tr key={item.차량_번호} onClick={() => handleCarSelect(item)} className={`hover:bg-slate-50 cursor-pointer h-10 transition-colors ${selectedCar?.차량_번호 === item.차량_번호 ? 'bg-blue-50 font-bold' : ''}`}>
                    <td>{getStatusBadgeHtml(item.차량_상태, "상태")}</td>
                    <td>{getStatusBadgeHtml(item.차량_구분, "구분")}</td>
                    <td className="font-bold">{item.차량_번호}</td>
                    <td>{item.차량_제조사}</td>
                    <td className="font-bold">{item.차량_모델명}</td>
                    <td className="text-left px-2">{item.차량_세부모델}</td>
                    <td className="text-left px-2 leading-none"><div>{item.차량_세부트림}</div><div className="text-[9px] text-slate-400 mt-0.5">{item.차량_선택옵션}</div></td>
                    <td>{item.차량_외부색상}</td>
                    <td>{item.차량_내부색상}</td>
                    <td className="text-right px-4 font-bold">{formatPrice(item.차량_현재주행거리)}km</td>
                    <td className="bg-blue-50/30 text-blue-800 font-bold text-right px-4">{item.금액_대여료_36M}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 상세 페이지 Drawer (5단계 섹션 유지) [cite: 2026-01-27] */}
          <div className={`absolute right-0 top-0 h-full w-[440px] bg-white natural-shadow z-[100] flex flex-col border-l border-slate-200 ${selectedCar ? 'translate-x-0 drawer-transition' : 'translate-x-full drawer-instant'}`}>
            {selectedCar && (
              <div className="flex flex-col h-full">
                <div className="h-[50px] flex justify-between items-center px-4 bg-white border-b border-slate-100"><h2 className="font-bold text-[12px] flex items-center gap-2"><Car size={18}/> 상품 상세 정보</h2><button onClick={() => setSelectedCar(null)}><X size={20}/></button></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <section className="border p-3 space-y-2">
                    <h3 className="font-bold text-blue-700 border-b pb-1">1. 차량 상세 제원</h3>
                    <div className="grid grid-cols-2 gap-2"><span className="text-slate-400">모델명</span><span className="font-bold">{selectedCar.차량_모델명}</span><span className="text-slate-400">차량번호</span><span className="font-bold text-blue-600">{selectedCar.차량_번호}</span></div>
                  </section>
                  <section className="border p-3"><h3 className="font-bold text-blue-700 border-b pb-1">2. 대여료 정보</h3><p className="mt-2">36개월: <b>{selectedCar.금액_대여료_36M}원</b></p></section>
                  <section className="border p-3"><h3 className="font-bold text-blue-700 border-b pb-1">3. 보험 정보</h3><p className="mt-2">자차 면책금: {formatDeductible(selectedCar.보험_자차면책최소)}</p></section>
                  <section className="border p-3"><h3 className="font-bold text-blue-700 border-b pb-1">4. 계약 정보</h3><p className="mt-2">약정거리: {selectedCar.계약_약정주행거리 || '2만km'}</p></section>
                  <section className="border p-3 space-y-2">
                    <h3 className="font-bold text-blue-700 border-b pb-1">5. 담당자 정보</h3>
                    <input value={managerInfo.nameTitle} onChange={(e) => setManagerInfo({...managerInfo, nameTitle: e.target.value})} className="w-full border p-2 text-xs" placeholder="담당자 성함/직책" />
                    <button onClick={handleCopySummary} className="w-full bg-slate-800 text-white py-3 font-bold">전달용 텍스트 복사</button>
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
