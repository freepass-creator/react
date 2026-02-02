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

// --- [CSS STYLES] ---
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
  .sidebar-elevation { box-shadow: 4px 0 15px rgba(0, 0, 0, 0.08), 1px 0 3px rgba(0, 0, 0, 0.1); }
  .btn-pressable { transition: all 0.12s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .btn-pressable:active { transform: translateY(1.5px); }
  .tactile-btn { box-shadow: 0 3px 6px rgba(0,0,0,0.06); transition: all 0.1s ease; }
  .tactile-btn-active { transform: translateY(2px); background-color: #f8fafc; }
  .natural-shadow { box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
  .apply-btn-shadow { box-shadow: 0 2px 4px rgba(0,0,0,0.08); transition: all 0.1s ease; }
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
const formatDeductible = (val) => { if (!val || val === '-' || val === '0' || val === '없음') return '없음'; return String(val).trim() + ( /^\d+$/.test(String(val).trim()) ? '만원' : '' ); };
const formatPercent = (val) => { if (!val || val === '-' || val === '0') return '30%'; return String(val).trim() + ( /^\d+$/.test(String(val).trim()) ? '%' : '' ); };
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
  if (cap && cap !== '-' && cap !== '0' && !isNaN(parseInt(cap))) return /^\d+$/.test(cap) ? cap + 'kWh' : cap;
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
  const [managerInfo, setManagerInfo] = useState({
    company: localStorage.getItem('erp_manager_company') || '',
    nameTitle: localStorage.getItem('erp_manager_nameTitle') || '',
    phone: localStorage.getItem('erp_manager_phone') || '',
    includeAccount: localStorage.getItem('erp_manager_includeAccount') === 'true'
  });
  const [copySuccess, setCopySuccess] = useState({ link: false, summary: false, account: false });

  useEffect(() => {
    const fetchData = async (isManual = false) => {
      if (isManual) setLoading(true);
      try {
        const res = await fetch(`${CSV_URL}&cachebust=${Date.now()}`);
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
    fetchData();
  }, []);

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

  const handleCopySummary = () => {
    if (!selectedCar) return;
    const c = selectedCar;
    let text = `[차량 상세 정보]\n• 모델: ${c.차량_모델명}\n• 번호: ${c.차량_번호}\n• 담당: ${managerInfo.nameTitle}`;
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    setCopySuccess(p => ({ ...p, summary: true })); setTimeout(() => setCopySuccess(p => ({ ...p, summary: false })), 2000);
  };

  const closeAllPopups = () => { setActiveSidebarPopup(null); setActiveFilterColumn(null); setTriggerRect(null); };

  return (
    <div className="erp-root overflow-hidden border-none">
      <style>{styles}</style>
      <div className="flex h-screen overflow-hidden">
        {/* 사이드바 */}
        <div className="w-[72px] bg-white border-r border-slate-200 flex flex-col items-center py-10 gap-4 sidebar-elevation">
          <button className="tactile-btn p-2" onClick={() => window.location.reload()}><RotateCw size={20} /></button>
          <button className="tactile-btn p-2" onClick={() => alert('엑셀 다운로드')}><Download size={20} /></button>
        </div>

        {/* 메인 */}
        <div className="flex-1 flex flex-col">
          <header className="h-[50px] bg-white border-b border-slate-200 flex items-center px-4 justify-between">
            <div className="flex items-center bg-slate-100 px-3 py-1 rounded-sm">
              <Search size={14} className="text-slate-400 mr-2" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="검색..." className="bg-transparent outline-none text-xs w-64" />
            </div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Total: {filteredData.length}건</div>
          </header>

          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr className="divide-x divide-slate-100">
                  <th className="py-2 w-[80px]">상태</th>
                  <th className="py-2 w-[80px]">구분</th>
                  <th className="py-2">모델명</th>
                  <th className="py-2 w-[120px]">차량번호</th>
                  <th className="py-2 w-[100px]">주행거리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-center">
                {filteredData.map(item => (
                  <tr key={item.차량_번호} onClick={() => setSelectedCar(item)} className="hover:bg-blue-50 cursor-pointer h-10 transition-colors">
                    <td>{getStatusBadgeHtml(item.차량_상태, "상태")}</td>
                    <td>{getStatusBadgeHtml(item.차량_구분, "구분")}</td>
                    <td className="text-left px-4 font-bold">{item.차량_모델명}</td>
                    <td className="text-slate-500">{item.차량_번호}</td>
                    <td className="text-right px-4 font-bold text-blue-700">{formatPrice(item.차량_현재주행거리)}km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 상세 서랍 - 요청하신 5단계 섹션 유지 [cite: 2026-01-27] */}
        {selectedCar && (
          <div className="w-[400px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-drawer-reset">
            <div className="p-4 border-b flex justify-between items-center bg-slate-800 text-white">
              <span className="font-bold flex items-center gap-2"><Car size={16}/> 상세 정보</span>
              <button onClick={() => setSelectedCar(null)}><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <section>
                <h4 className="text-blue-700 font-bold border-b pb-1 mb-2">1. 차량 상세 제원</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-slate-400">모델명</span><span className="font-bold">{selectedCar.차량_모델명}</span>
                  <span className="text-slate-400">번호</span><span className="font-bold">{selectedCar.차량_번호}</span>
                </div>
              </section>
              <section>
                <h4 className="text-blue-700 font-bold border-b pb-1 mb-2">2. 대여료 정보</h4>
                <div className="text-xs">월 대여료: {selectedCar.금액_대여료_36M || '-'}원 (36개월)</div>
              </section>
              <section>
                <h4 className="text-blue-700 font-bold border-b pb-1 mb-2">3. 보험 정보</h4>
                <div className="text-xs">자차면책금: {formatDeductible(selectedCar.보험_자차면책최소)}</div>
              </section>
              <section>
                <h4 className="text-blue-700 font-bold border-b pb-1 mb-2">4. 계약 정보</h4>
                <div className="text-xs">약정거리: {selectedCar.계약_약정주행거리 || '2만km'}</div>
              </section>
              <section>
                <h4 className="text-blue-700 font-bold border-b pb-1 mb-2">5. 담당자 정보</h4>
                <div className="space-y-2">
                  <input value={managerInfo.nameTitle} onChange={(e) => setManagerInfo({...managerInfo, nameTitle: e.target.value})} className="w-full border p-2 text-xs" placeholder="성함/직책" />
                  <button onClick={handleCopySummary} className="w-full bg-slate-800 text-white py-2 text-xs font-bold">텍스트 복사하기</button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
