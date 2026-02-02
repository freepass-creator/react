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

  /* [정밀 수정] 자연스럽고 고급스러운 슬라이드 곡선 (감속 위주) */
  .drawer-transition {
    transition: transform 1s cubic-bezier(0.22, 1, 0.36, 1);
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
function App() {
  // State
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

  // Initialize Firebase & Manager Info
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setManagerInfo({
        company: localStorage.getItem('erp_manager_company') || '',
        nameTitle: localStorage.getItem('erp_manager_nameTitle') || '',
        phone: localStorage.getItem('erp_manager_phone') || '',
        includeAccount: localStorage.getItem('erp_manager_includeAccount') === 'true'
      });

      const firebaseConfigStr = window.__firebase_config;
      if (firebaseConfigStr) {
        try {
            const firebaseConfig = typeof firebaseConfigStr === 'string' ? JSON.parse(firebaseConfigStr) : firebaseConfigStr;
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            
            const initAuth = async () => {
              const authToken = window.__initial_auth_token;
              if (authToken) {
                await signInWithCustomToken(auth, authToken);
              } else {
                await signInAnonymously(auth);
              }
            };

            onAuthStateChanged(auth, (user) => {
              if (user) {
                fetchData(false);
              } else {
                initAuth();
              }
            });
        } catch (e) {
            console.error("Firebase 초기화 오류", e);
            fetchData(false);
        }
      } else {
        fetchData(false);
      }
    }
  }, []);

  // Data Fetching
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

  // Filtered & Sorted Data Logic
  const filteredData = useMemo(() => {
    let result = rawData.filter(item => {
      const matchesSearch = Object.values(item).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesColumnFilters = Object.entries(columnFilters).every(([col, selectedValues]) => {
        if (!selectedValues || selectedValues.length === 0) return true;
        return selectedValues.includes(String(item[col]));
      });

      let matchesRental = true;
      if (sidebarFilters.rental.length > 0) {
        const periodKey = `금액_대여료_${selectedPeriods[0] || '24M'}`;
        const val = parseNum(item[periodKey]);
        matchesRental = sidebarFilters.rental.some(range => {
          if (range === '50만 이하') return val <= 500000;
          if (range === '100만 이상') return val >= 1000000;
          const [low, high] = range.split('~').map(s => parseInt(s) * 10000);
          return val >= low && val < high;
        });
      }

      let matchesDeposit = true;
      if (sidebarFilters.deposit.length > 0) {
        const periodKey = `금액_보증금_${selectedPeriods[0] || '24M'}`;
        const val = parseNum(item[periodKey]);
        matchesDeposit = sidebarFilters.deposit.some(range => {
          if (range === '100만 이하') return val <= 1000000;
          if (range === '500만 이상') return val >= 5000000;
          const [low, high] = range.split('~').map(s => parseInt(s) * 10000);
          return val >= low && val < high;
        });
      }

      let matchesMileage = true;
      if (sidebarFilters.mileage.length > 0) {
        const val = parseNum(item.차량_현재주행거리);
        matchesMileage = sidebarFilters.mileage.some(range => {
          if (range === '1만km 미만') return val < 10000;
          if (range === '10만km 이상') return val >= 100000;
          if (range === '1~3만') return val >= 10000 && val < 30000;
          if (range === '3~5만') return val >= 30000 && val < 50000;
          if (range === '5~10만') return val >= 50000 && val < 100000;
          return false;
        });
      }

      let matchesYear = true;
      if (sidebarFilters.year.length > 0) {
        const rawDate = item.차량_최초등록일 || item['최초등록일'] || "";
        if (!rawDate) matchesYear = false;
        else {
          try {
            const regDate = new Date(String(rawDate).replace(/\./g, '-'));
            const ageYears = (new Date() - regDate) / (1000 * 60 * 60 * 24 * 365);
            matchesYear = sidebarFilters.year.some(range => {
              if (range === '1년 이하') return ageYears <= 1;
              if (range === '1~3년') return ageYears > 1 && ageYears <= 3;
              if (range === '3~5년') return ageYears > 3 && ageYears <= 5;
              if (range === '5년 이상') return ageYears > 5;
              return false;
            });
          } catch (e) { matchesYear = false; }
        }
      }

      return matchesSearch && matchesColumnFilters && matchesRental && matchesDeposit && matchesMileage && matchesYear;
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
  }, [rawData, searchTerm, columnFilters, sidebarFilters, selectedPeriods, sortConfig]);

  // Event Handlers
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const toggleSidebarPopup = (id, e) => {
    if (activeSidebarPopup === id) {
      setActiveSidebarPopup(null);
      setTriggerRect(null);
    } else {
      setActiveSidebarPopup(id);
      setActiveFilterColumn(null);
      setTriggerRect(e.currentTarget.getBoundingClientRect());
    }
  };

  const toggleColumnFilter = (key, e) => {
    if (activeFilterColumn === key) {
      setActiveFilterColumn(null);
      setTriggerRect(null);
    } else {
      setActiveFilterColumn(key);
      setActiveSidebarPopup(null);
      setTriggerRect(e.currentTarget.getBoundingClientRect());
    }
  };

  const closeAllPopups = () => {
    setActiveSidebarPopup(null);
    setActiveFilterColumn(null);
    setTriggerRect(null);
  };

  const downloadExcel = () => {
    const tableHeaders = ["상태", "구분", "차량번호", "제조사", "모델", "세부모델", "세부트림", "외부색상", "내부색상", "주행거리", "대여료", "보증금"];
    const csvContent = "\uFEFF" + tableHeaders.join(",");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "매물리스트_엑셀.csv");
    link.click();
  };

  const handleCopySummary = () => {
    if (!selectedCar) return;
    const c = selectedCar;
    const isEV = String(c.차량_연료).includes('전기');
    const evCapacity = getBatteryCapacity(c);
    
    let text = `[상품 상세 정보]\n\n`;
    text += `1. 차량 상세 제원\n`;
    text += `• 차량번호: ${c.차량_번호} (${c.차량_구분}/${c.차량_상태})\n`;
    text += `• 모델명: ${c.차량_제조사} ${c.차량_모델명} ${c.차량_세부모델}\n`;
    text += `• 세부트림: ${c.차량_세부트림}\n`;
    text += `• 선택옵션: ${c.차량_선택옵션 || '기본 사양'}\n`;
    text += `• 주요제원: ${c.차량_연료 || '-'} / ${isEV ? evCapacity : (c.차량_배기량 ? formatPrice(c.차량_배기량) + 'cc' : '-')} / ${formatPrice(c.차량_현재주행거리)}km\n`;
    text += `• 색상(내/외): ${c.차량_내부색상} / ${c.차량_외부색상}\n`;
    text += `• 차량비고: ${(c.차량_세부상태 || c.차량_비고) ? `${c.차량_세부상태 ? c.차량_세부상태 + ' ' : ''}${c.차량_비고 || ''}` : '입력된 내용이 없습니다.'}\n`;
    text += `• 차량 실물 사진: ${c.차량_사진링크 || '링크 정보 없음'}\n\n`;
    text += `2. 대여료 및 보증금 안내 (부가세 포함)\n`; 
    ['6M', '12M', '24M', '36M', '48M', '60M'].forEach(m => {
      const fee = c[`금액_대여료_${m}`];
      const dep = c[`금액_보증금_${m}`];
      if (fee && fee !== '-' && fee !== '0' && fee !== '0원') {
        text += `• ${formatPeriod(m)}: 월 대여료 ${fee}원 / 보증금 ${dep}원\n`;
      }
    });
    text += `\n3. 보험 보상 상세\n`;
    text += `• 대인배상: ${c.보험_대인한도 || '무한'} (면책금: ${formatDeductible(c.보험_대인면책)})\n`;
    text += `• 대물배상: ${c.보험_대물한도 || '1억원'} (면책금: ${formatDeductible(c.보험_대물면책)})\n`;
    text += `• 자기신체(자손): ${c.보험_자손한도 || '3천만'} (면책금: ${formatDeductible(c.보험_자손면책)})\n`;
    text += `• 무보험차 상해: ${c.보험_무보험한도 || '2억원'} (면책금: ${formatDeductible(c.보험_무보험면책)})\n`;
    text += `• 자기차량(자차): ${c.보험_자차한도 || '차량가액 한도'} (면책금: 수리비의 ${formatPercent(c.보험_자차수리비율)}, 최소 ${formatDeductible(c.보험_자차면책최소)} ~ 최대 ${formatDeductible(c.보험_자차면책최대)})\n`;
    text += `• 긴급출동: ${c.보험_긴급출동 || '연 5회'}\n\n`;
    text += `4. 계약 및 추가 비용 조건\n`;
    text += `• 기본연령: ${c.계약_기본운전연령 || '만 26세 이상'}\n`;
    text += `• 약정거리: ${c.계약_약정주행거리 || '2만km'}\n`;
    text += `• 만 21세 연령 하향: ${formatContractOption(c.계약_21세추가금)}\n`;
    text += `• 만 23세 연령 하향: ${formatContractOption(c.계약_23세추가금)}\n`;
    text += `• 연간 1만km 거리 추가: ${formatContractOption(c.계약_1만Km추가금)}\n`;
    text += `• 계약특이사항: ${c.계약_비고 || '입력된 내용이 없습니다.'}\n`;
    text += `\n5. 담당자 정보\n`;
    text += `• 소속/담당: ${managerInfo.company || '-'} ${managerInfo.nameTitle || '-'}\n`;
    text += `• 연락처: ${managerInfo.phone || '-'}\n`;
    if (managerInfo.includeAccount) {
      text += `• 입금계좌: ${c.계약_입금계좌번호 || '계좌 정보 미등록'}\n`;
    }
    text += `\n* 본 정보는 내부 전산 데이터로 실시간 재고 상황에 따라 변동될 수 있습니다.`;
    
    copyToClipboard(text);
    setCopySuccess(p => ({ ...p, summary: true }));
    setTimeout(() => setCopySuccess(p => ({ ...p, summary: false })), 2000);
  };

  const copyToClipboard = (text) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(ta);
  };

  const handleCopyAccount = (text) => {
    if (!text || text === '미등록') return;
    copyToClipboard(text);
    setCopySuccess(p => ({ ...p, account: true }));
    setTimeout(() => setCopySuccess(p => ({ ...p, account: false })), 2000);
  };

  const handleCarSelect = (item) => {
    if (selectedCar?.차량_번호 === item.차량_번호) {
      setSelectedCar(null);
    } else if (selectedCar) {
      setSelectedCar(null);
      setTimeout(() => {
        setSelectedCar(item);
      }, 50); 
    } else {
      setSelectedCar(item);
    }
  };

  const renderSidebarButton = (id, label) => {
    const isActive = activeSidebarPopup === id;
    const isFiltered = id === 'period' ? selectedPeriods.length > 0 : (sidebarFilters[id] || []).length > 0;
    return (
      <div key={id} className="relative w-full">
        <button 
          onClick={(e) => { e.stopPropagation(); toggleSidebarPopup(id, e); }}
          className={`w-full h-[40px] flex flex-col items-center justify-center border border-slate-100 tactile-btn ${isActive ? 'tactile-btn-active text-blue-700 bg-slate-50' : 'bg-white text-slate-700'} relative`}
        >
          <span className="text-[10px] font-bold tracking-tighter uppercase text-center leading-[1.1]">{label}</span>
          {isFiltered && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-600 rounded-full border border-white"></div>}
        </button>
      </div>
    );
  };

  return (
    <div className="erp-root overflow-hidden border-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{styles}</style>
      
      <div id="app" ref={appRef} className="flex h-screen overflow-hidden opacity-100 transition-opacity duration-700">
        
        {/* 좌측 필터바 */}
        <div className="w-[72px] bg-white flex flex-col z-[60] flex-shrink-0 border-r border-slate-200 relative sidebar-elevation">
          <div className="mt-[80px] flex flex-col items-center gap-2 px-1.5">
            {[
              { id: 'period', label: '기간' },
              { id: 'rental', label: '대여료' },
              { id: 'deposit', label: '보증금' },
              { id: 'mileage', label: '주행거리' },
              { id: 'year', label: '연식' }
            ].map(b => renderSidebarButton(b.id, b.label))}
          </div>

          <div className="mt-auto mb-6 flex flex-col items-center px-1.5 w-full">
            <button 
              onClick={downloadExcel} 
              className="w-full h-[52px] flex flex-col items-center justify-center border border-slate-100 tactile-btn bg-white text-[#1D6F42] hover:text-[#155d36] transition-all"
            >
              <Download size={16} className="mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-tighter text-center leading-none">EXCEL</span>
            </button>
          </div>
        </div>

        {/* 메인 영역 */}
        <div className="flex-1 flex flex-col min-w-0 relative" onClick={() => setSelectedCar(null)}>
          
          <header className="h-[50px] bg-white border-b border-slate-200 flex items-center px-4 gap-4 flex-shrink-0 z-20 shadow-sm" onClick={(e) => { e.stopPropagation(); setSelectedCar(null); }}>
            <div className="flex items-center gap-3 flex-1 max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="relative flex-1 max-sm:max-w-xs max-w-sm">
                <Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="매물 통합 검색..." 
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-none text-xs focus:outline-none focus:border-slate-400 bg-white" 
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <div className={`transition-all duration-500 bg-blue-600 text-white px-2 py-1 text-[9px] font-bold rounded-sm shadow-sm pointer-events-none ${toastVisible ? 'opacity-100' : 'opacity-0'}`}>
                데이터 연동이 완료되었습니다
              </div>
              
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter">데이터 서버 연동 중:</span>
                <b className="text-slate-800 font-bold text-[11px]">{filteredData.length}</b>
                <span className="text-slate-500 font-bold">건</span>
              </div>
              <div className="h-4 border-l border-slate-200"></div>
              <button 
                onClick={() => fetchData(true)} 
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 font-bold text-[11px] hover:bg-slate-50 transition-all text-slate-700 rounded-none btn-pressable"
              >
                <RotateCw size={12} className={loading ? 'animate-spin' : ''} /> 데이터 갱신
              </button>
            </div>
          </header>

          {/* 테이블 영역 */}
          <div className="flex-1 overflow-auto bg-white m-0 relative text-slate-800">
            <table className="w-full border-collapse text-left text-[11px] table-fixed">
              <thead className="sticky top-0 bg-[#f8f9fb] border-b border-slate-300 z-40 font-semibold text-slate-600 text-center uppercase tracking-tighter">
                <tr className="divide-x divide-slate-200" onClick={(e) => e.stopPropagation()}>
                  {Object.entries(baseColumns).map(([label, dataKey]) => {
                    const isSorted = sortConfig.key === dataKey;
                    const isActive = activeFilterColumn === dataKey;
                    const isFiltered = (columnFilters[dataKey] || []).length > 0;
                    const isFilterable = filterableColumns.includes(label);
                    
                    let colWidth = "w-auto";
                    if (label === '상태' || label === '구분') colWidth = "w-[72px]";
                    else if (label === '차량번호') colWidth = "w-[100px]";
                    else if (label === '제조사') colWidth = "w-[90px]";
                    else if (label === '모델') colWidth = "w-[110px]";
                    else if (label === '세부모델') colWidth = "w-[120px]";
                    else if (label === '세부트림') colWidth = "w-[160px]";
                    else if (label === '외부색상' || label === '내부색상') colWidth = "w-[85px]";
                    else if (label === '주행거리') colWidth = "w-[105px]";

                    if (label === '세부트림') {
                        return (
                          <th key={label} className={`py-1.5 px-1 transition-colors border-b border-slate-200 ${colWidth}`}>
                            <div className="flex flex-row items-center justify-center gap-1 leading-tight h-full font-bold text-center">
                              <div className="flex flex-col items-center text-center w-full">
                                <span className="text-[11px] uppercase">{label}</span>
                                <span className="text-[9px] opacity-70 font-bold">(선택옵션)</span>
                              </div>
                            </div>
                          </th>
                        );
                    }

                    return (
                      <th key={label} className={`py-1.5 px-1 transition-colors border-b border-slate-200 ${isSorted || isActive ? 'bg-blue-50' : ''} ${colWidth}`}>
                        <div onClick={(e) => isFilterable && toggleColumnFilter(dataKey, e)} className={`flex flex-row items-center justify-center gap-1 leading-tight h-full relative overflow-hidden ${isFilterable ? 'cursor-pointer' : ''}`}>
                          <span className={`${isFiltered || isSorted ? 'text-blue-700 font-bold' : ''} truncate text-[11px]`}>{label}</span>
                          {isFilterable && <Filter size={10} className={isFiltered || isActive ? 'text-blue-700' : 'text-slate-300'} fill={isFiltered ? 'currentColor' : 'none'} />}
                          {sortableColumns.includes(label) && (
                            <button onClick={(e) => { e.stopPropagation(); handleSort(dataKey); }} className={`p-0.5 ${isSorted ? 'text-blue-700' : 'text-slate-300'}`}>
                              {isSorted ? (sortConfig.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} />}
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {selectedPeriods.map(p => {
                    const isSorted = sortConfig.key === `금액_대여료_${p}`;
                    return (
                      <th key={p} className={`py-1.5 px-1 w-[105px] bg-blue-50 border-l border-blue-100 text-blue-800 ${isSorted ? 'bg-blue-100' : ''}`}>
                        <div className="flex flex-row items-center justify-center gap-1 leading-tight h-full font-bold text-center">
                          <div className="flex flex-col items-center text-center w-full">
                            <span className="text-[10px] uppercase">{formatPeriod(p)} 대여료</span>
                            <span className="text-[9px] opacity-70 font-bold">(보증금)</span>
                          </div>
                          <button onClick={() => handleSort(`금액_대여료_${p}`)} className={`p-0.5 ${isSorted ? 'text-blue-700' : 'text-slate-300'}`}>
                            {isSorted ? (sortConfig.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} />}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-center font-sans">
                {filteredData.map(item => (
                  <tr 
                    key={item.차량_번호} 
                    onClick={(e) => { e.stopPropagation(); handleCarSelect(item); }} 
                    className={`hover:bg-slate-50 cursor-pointer divide-x divide-slate-50 h-[52px] transition-colors ${selectedCar?.차량_번호 === item.차량_번호 ? 'bg-blue-50 font-bold' : ''}`}
                  >
                    <td className="p-2 text-center">{getStatusBadgeHtml(item.차량_상태, "상태")}</td>
                    <td className="p-2 text-center">{getStatusBadgeHtml(item.차량_구분, "구분")}</td>
                    <td className="p-2 truncate font-bold text-slate-900">{item.차량_번호 || '-'}</td>
                    <td className="p-2 truncate text-slate-700 font-medium">{item.차량_제조사 || '-'}</td>
                    <td className="p-2 truncate font-bold text-slate-900">{item.차량_모델명 || '-'}</td>
                    <td className="p-2 truncate text-slate-500 text-left font-medium">{item.차량_세부모델 || '-'}</td>
                    <td className="p-2 text-left leading-none">
                      <div className="font-bold text-slate-800 truncate">{item.차량_세부트림 || '-'}</div>
                      <div className="text-slate-400 font-medium text-[9px] truncate mt-1">{item.차량_선택옵션 || '옵션없음'}</div>
                    </td>
                    <td className="p-2 truncate text-slate-500 whitespace-nowrap font-medium text-center">{item.차량_외부색상 || '-'}</td>
                    <td className="p-2 truncate text-slate-500 whitespace-nowrap font-medium text-center">{item.차량_내부색상 || '-'}</td>
                    <td className="p-2 truncate text-right font-bold text-slate-700 pr-6">{formatPrice(item.차량_현재주행거리)}km</td>
                    {selectedPeriods.map(p => (
                      <td key={p} className="p-2 bg-blue-50/30 text-blue-800 font-bold text-right pr-6 leading-none">
                        <div className="text-[11px]">{item[`금액_대여료_${p}`] || '-'}</div>
                        <div className="text-slate-400 font-bold text-[9px] mt-1">{item[`금액_보증금_${p}`] || '-'}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 상세 페이지 Drawer: 열릴 때 자연스럽게(drawer-transition), 닫힐 때 즉시(drawer-instant) */}
          <div 
            id="detail-drawer" 
            onClick={(e) => e.stopPropagation()} 
            className={`absolute right-0 top-0 h-full w-[440px] bg-white natural-shadow z-[100] flex flex-col border-l border-slate-200 ${selectedCar ? 'translate-x-0 drawer-transition' : 'translate-x-full drawer-instant'}`}
          >
            {selectedCar && (
              <div key={selectedCar.차량_번호} className="flex flex-col h-full">
                <div className="h-[50px] flex justify-between items-center px-4 bg-white border-b border-slate-100 text-slate-800 flex-shrink-0">
                  <h2 className="font-bold text-[12px] tracking-widest uppercase flex items-center gap-2"><Car size={18} /> 상품 상세 정보</h2>
                  <button onClick={() => setSelectedCar(null)} className="text-slate-400 hover:text-slate-800 p-1"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-white text-[11px] text-slate-800 hide-scrollbar">
                  
                  {/* 1. 차량 상세 제원 */}
                  <section className="border border-slate-200 bg-white rounded-none overflow-hidden shadow-sm tactile-section">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-[11px] text-slate-600 uppercase tracking-tighter">1. 차량 상세 제원</span>
                    </div>
                    <div className="p-3 space-y-3.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[12px] text-blue-700 tracking-tight">{selectedCar.차량_번호}</span>
                          <span className="font-bold text-[12px] text-slate-900">{selectedCar.차량_제조사} {selectedCar.차량_모델명}</span>
                          <span className="font-medium text-[11px] text-slate-500 uppercase">{selectedCar.차량_연료}</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {getStatusBadgeHtml(selectedCar.차량_구분, "구분")}
                          {getStatusBadgeHtml(selectedCar.차량_상태, "상태")}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex gap-2 items-start"><span className="text-slate-400 font-bold w-[60px] flex-shrink-0 text-[10px] uppercase">세부모델</span><span className="font-bold text-slate-900">{selectedCar.차량_세부모델}</span></div>
                        <div className="flex gap-2 items-start"><span className="text-slate-400 font-bold w-[60px] flex-shrink-0 text-[10px] uppercase">세부트림</span><span className="font-bold text-blue-700">{selectedCar.차량_세부트림}</span></div>
                        <div className="flex gap-2 items-start"><span className="text-slate-400 font-bold w-[60px] flex-shrink-0 text-[10px] uppercase">선택옵션</span><span className="font-medium text-slate-600 leading-tight">{selectedCar.차량_선택옵션 || '장착 정보 없음'}</span></div>
                        <div className="flex gap-2 items-start"><span className="text-slate-400 font-bold w-[60px] flex-shrink-0 text-[10px] uppercase">외부/내부</span><span className="font-bold text-slate-700">{selectedCar.차량_외부색상} / {selectedCar.차량_내부색상}</span></div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                        <div className="flex justify-between items-center"><span className="text-slate-400 font-bold text-[10px] uppercase">주행거리</span><span className="font-bold text-blue-700">{formatPrice(selectedCar.차량_현재주행거리)}km</span></div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-bold text-[10px] uppercase">{String(selectedCar.차량_연료).includes('전기') ? '배터리' : '배기량'}</span>
                          <span className="font-bold">{String(selectedCar.차량_연료).includes('전기') ? getBatteryCapacity(selectedCar) : (selectedCar.차량_배기량 ? formatPrice(selectedCar.차량_배기량)+'cc' : '-')}</span>
                        </div>
                        <div className="flex justify-between items-center"><span className="text-slate-400 font-bold text-[10px] uppercase">최초등록</span><span className="font-bold">{selectedCar.차량_최초등록일}</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-400 font-bold text-[10px] uppercase">차령만료</span><span className="font-bold text-rose-600">{selectedCar.차령만료일 || '-'}</span></div>
                        <div className="col-span-2 flex flex-col mt-1 p-2.5 bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 font-bold text-[9px] uppercase mb-1.5">차량 세부 상태 및 비고</span>
                          <div className="flex items-start gap-2"><span className="font-medium text-slate-700 leading-relaxed">{(selectedCar.차량_세부상태 || selectedCar.차량_비고) ? `${selectedCar.차량_세부상태 ? selectedCar.차량_세부상태 + ' ' : ''}${selectedCar.차량_비고 || ''}` : '입력된 내용이 없습니다.'}</span></div>
                        </div>
                      </div>
                      <button onClick={() => window.open(selectedCar.차량_사진링크, '_blank')} className="w-full py-3 bg-white border border-slate-300 font-bold text-[10px] uppercase apply-btn-shadow">차량 사진 확인 (링크)</button>
                    </div>
                  </section>

                  {/* 2. 대여료 및 보증금 안내 */}
                  <section className="border border-slate-200 bg-white shadow-sm overflow-hidden tactile-section">
                    <div className="bg-slate-50 px-3 py-2 border-b font-bold text-slate-600 uppercase tracking-tighter">2. 대여료 및 보증금 안내</div>
                    <table className="w-full text-center text-[11px] border-collapse border-x-0">
                      <thead className="bg-slate-50 border-b font-bold text-slate-500 uppercase">
                        <tr><th className="py-2">계약기간</th><th className="py-2 text-blue-800 text-right pr-4">월 대여료</th><th className="py-2 text-right pr-4 text-slate-400">보증금</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {['6M', '12M', '24M', '36M', '48M', '60M'].map(m => {
                          const fee = selectedCar[`금액_대여료_${m}`];
                          const dep = selectedCar[`금액_보증금_${m}`];
                          if (!fee || fee === '-' || fee === '0' || fee === '0원') return null;
                          return (
                            <tr key={m}>
                              <td className="py-2 font-bold uppercase">{formatPeriod(m)}</td>
                              <td className="py-2 text-blue-800 font-bold text-right pr-4">{fee}원</td>
                              <td className="py-2 text-slate-500 text-right pr-4">{dep}원</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>

                  {/* 3. 보험 보상 상세 */}
                  <section className="border border-slate-200 bg-white rounded-none overflow-hidden shadow-sm tactile-section">
                    <div className="bg-slate-50 px-3 py-2 border-b font-bold text-slate-600 uppercase tracking-tighter">3. 보험 보상 및 공통 면책 조건</div>
                    <table className="w-full text-center border-collapse text-[10px] border-x-0">
                      <thead className="bg-slate-50 font-bold text-slate-400 uppercase border-b">
                        <tr><th className="py-2 px-2 text-left">보상 항목</th><th className="py-2 px-2 text-center">보상 한도</th><th className="py-2 px-2 text-right pr-4">면책금</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-bold uppercase tracking-tighter">
                        <tr><td className="p-2 text-left text-slate-500 font-bold">대인 배상</td><td className="p-2 font-bold text-center">{selectedCar.보험_대인한도 || '무한'}</td><td className="p-2 text-right text-blue-800 pr-4">{formatDeductible(selectedCar.보험_대인면책)}</td></tr>
                        <tr><td className="p-2 text-left text-slate-500 font-bold">대물 배상</td><td className="p-2 font-bold text-center">{selectedCar.보험_대물한도 || '1억원'}</td><td className="p-2 text-right text-blue-800 pr-4">{formatDeductible(selectedCar.보험_대물면책)}</td></tr>
                        <tr><td className="p-2 text-left text-slate-500 font-bold">자기신체(자손)</td><td className="p-2 font-bold text-center">{selectedCar.보험_자손한도 || '3천만'}</td><td className="p-2 text-right text-blue-800 pr-4">{formatDeductible(selectedCar.보험_자손면책)}</td></tr>
                        <tr><td className="p-2 text-left text-slate-500 font-bold">무보험차 상해</td><td className="p-2 font-bold text-center">{selectedCar.보험_무보험한도 || '2억원'}</td><td className="p-2 text-right text-blue-800 pr-4">{formatDeductible(selectedCar.보험_무보험면책)}</td></tr>
                        <tr className="bg-blue-50/20"><td className="p-2 text-left text-slate-500 font-bold">자기차량(자차)</td><td className="p-2 font-bold text-center">{selectedCar.보험_자차한도 || '차량가액 한도'}</td><td className="p-2 text-right text-rose-700 pr-4">수리비의 {formatPercent(selectedCar.보험_자차수리비율)}, 최소 {formatDeductible(selectedCar.보험_자차면책최소)} ~ 최대 {formatDeductible(selectedCar.보험_자차면책최대)}</td></tr>
                        <tr><td className="p-2 text-left text-slate-500 font-bold">긴급출동</td><td className="p-2 font-bold text-center">{selectedCar.보험_긴급출동 || '연 5회'}</td><td className="p-2 text-right text-blue-800 pr-4">-</td></tr>
                      </tbody>
                    </table>
                  </section>

                  {/* 4. 계약 정책 */}
                  <section className="border border-slate-200 bg-white rounded-none overflow-hidden shadow-sm tactile-section">
                    <div className="bg-slate-50 px-3 py-2 border-b font-bold text-slate-600 uppercase tracking-tighter">4. 계약 정책 및 연령/거리 옵션</div>
                    <div className="divide-y divide-slate-100">
                      <div className="grid grid-cols-2 divide-x divide-slate-100">
                        <div className="p-2.5 flex justify-between items-baseline"><span className="text-slate-400 font-bold text-[9px] uppercase">기본연령</span><span className="font-bold text-slate-800">{selectedCar.계약_기본운전연령 || '만 26세'}</span></div>
                        <div className="p-2.5 flex justify-between items-baseline"><span className="text-slate-400 font-bold text-[9px] uppercase">약정거리</span><span className="font-bold text-slate-800">{selectedCar.계약_약정주행거리 || '2만km'}</span></div>
                      </div>
                      <div className="flex justify-between p-2.5 hover:bg-slate-50 transition-colors">
                        <span className="text-slate-500 font-bold uppercase">만 21세 연령 하향</span>
                        <span className={`font-bold ${parseNum(selectedCar.계약_21세추금) > 0 || String(selectedCar.계약_21세추가금).includes('%') ? 'text-blue-700' : 'text-slate-400 italic'}`}>{formatContractOption(selectedCar.계약_21세추가금)}</span>
                      </div>
                      <div className="flex justify-between p-2.5 hover:bg-slate-50 transition-colors">
                        <span className="text-slate-500 font-bold uppercase">만 23세 연령 하향</span>
                        <span className={`font-bold ${parseNum(selectedCar.계약_23세추가금) > 0 || String(selectedCar.계약_23세추가금).includes('%') ? 'text-blue-700' : 'text-slate-400 italic'}`}>{formatContractOption(selectedCar.계약_23세추가금)}</span>
                      </div>
                      <div className="flex justify-between p-2.5 hover:bg-slate-50 transition-colors">
                        <span className="text-slate-500 font-bold uppercase">연간 1만km 거리 추가</span>
                        <span className="font-bold text-blue-700">{formatContractOption(selectedCar.계약_1만Km추가금)}</span>
                      </div>
                      <div className="flex flex-col p-2.5 bg-slate-50">
                        <span className="text-slate-400 font-bold text-[9px] uppercase mb-1.5">계약 관련 특이사항 및 비고</span>
                        <div className="font-medium text-slate-700 leading-relaxed">{selectedCar.계약_비고 || '입력된 내용이 없습니다.'}</div>
                      </div>
                    </div>
                  </section>

                  {/* 5. 담당자 및 입금 계좌 */}
                  <section className="border border-slate-200 bg-white shadow-sm overflow-hidden tactile-section">
                    <div className="bg-slate-50 px-3 py-2 border-b font-bold text-slate-600 uppercase tracking-tighter">
                      5. 담당자 및 입금 계좌 안내
                      <span className="text-slate-400 font-medium text-[9px] ml-2 font-normal">(한번 써놓으면 저장됩니다)</span>
                    </div>
                    <div className="p-3 space-y-3 bg-white">
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text" 
                          placeholder="소속" 
                          value={managerInfo.company}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManagerInfo(p => ({ ...p, company: val }));
                            if (typeof window !== 'undefined') localStorage.setItem('erp_manager_company', val);
                          }}
                          className="p-2.5 border border-slate-200 outline-none font-bold focus:border-slate-800"
                        />
                        <input 
                          type="text" 
                          placeholder="성명/직책" 
                          value={managerInfo.nameTitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManagerInfo(p => ({ ...p, nameTitle: val }));
                            if (typeof window !== 'undefined') localStorage.setItem('erp_manager_nameTitle', val);
                          }}
                          className="p-2.5 border border-slate-200 outline-none font-bold focus:border-slate-800"
                        />
                        <input 
                          type="text" 
                          placeholder="연락처" 
                          value={managerInfo.phone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManagerInfo(p => ({ ...p, phone: val }));
                            if (typeof window !== 'undefined') localStorage.setItem('erp_manager_phone', val);
                          }}
                          className="p-2.5 border border-slate-200 outline-none font-bold focus:border-slate-800 col-span-2"
                        />
                      </div>
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="flex justify-between items-center">
                          <div 
                            className="flex-1 p-2.5 bg-slate-50 border border-slate-100 cursor-pointer group active:bg-slate-200 transition-all" 
                            onClick={() => handleCopyAccount(selectedCar.계약_입금계좌번호)}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-slate-400 font-bold text-[8px] uppercase">입금계좌(클릭 시 복사)</span>
                              <span className={`text-[8px] font-bold text-blue-600 transition-opacity ${copySuccess.account ? 'opacity-100' : 'opacity-0'}`}>복사되었습니다!</span>
                            </div>
                            <div className="font-bold text-slate-800 text-[11px] leading-none">{selectedCar.계약_입금계좌번호 || '계좌 정보 미등록'}</div>
                          </div>
                          <label className="ml-3 flex items-center gap-1.5 cursor-pointer group whitespace-nowrap">
                            <span className="font-bold text-slate-500 group-hover:text-blue-700 transition-colors text-[10px]">입금계좌 포함하기</span>
                            <input 
                              type="checkbox" 
                              checked={managerInfo.includeAccount}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setManagerInfo(p => ({ ...p, includeAccount: val }));
                                if (typeof window !== 'undefined') localStorage.setItem('erp_manager_includeAccount', String(val));
                              }}
                              className="w-4 h-4 accent-slate-800" 
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
                
                {/* 하단 액션 버튼 */}
                <div className="p-3 border-t bg-white flex-shrink-0 grid grid-cols-2 gap-3">
                  <button className="py-3.5 bg-white border border-slate-300 font-black text-[11px] uppercase tracking-widest apply-btn-shadow flex items-center justify-center gap-2 cursor-default">
                    <Share2 size={16} /> 고객용 링크 (준비중)
                  </button>
                  <button 
                    onClick={handleCopySummary}
                    className={`py-3.5 text-white font-bold text-[11px] uppercase tracking-widest apply-btn-shadow flex items-center justify-center gap-2 transition-colors ${copySuccess.summary ? 'bg-green-600' : 'bg-slate-800'}`}
                  >
                    {copySuccess.summary ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    {copySuccess.summary ? '텍스트 복사됨' : '전달용 텍스트'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 팝업 오버레이 & 필터 팝업 */}
      {(activeSidebarPopup || activeFilterColumn) && (
        <div className="fixed inset-0 z-[70] pointer-events-auto" onClick={closeAllPopups}>
          
          {/* 사이드바 필터 팝업: 버튼 상단 기준, 하단 범위를 벗어나지 않게 보정 */}
          {activeSidebarPopup && triggerRect && (() => {
            const id = activeSidebarPopup;
            const label = id==='period'?'기간':id==='rental'?'대여료':id==='deposit'?'보증금':id==='mileage'?'주행거리':'연식';
            const opts = id==='period'?['6M','12M','24M','36M','48M','60M']:id==='rental'?rentalOptions:id==='deposit'?depositOptions:id==='mileage'?mileageOptions:yearOptions;
            const popupHeight = 310;
            const topPos = Math.min(triggerRect.top, (typeof window !== 'undefined' ? window.innerHeight : 800) - popupHeight - 10);
            
            return (
              <div 
                className="absolute bg-white border border-slate-200 natural-shadow z-[100] w-[210px] rounded-none overflow-hidden flex flex-col" 
                style={{ left: '80px', top: `${topPos}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{label} 필터</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (id === 'period') setSelectedPeriods(['36M', '48M', '60M']);
                        else setSidebarFilters(p => ({ ...p, [id]: [] }));
                      }}
                      className="text-[10px] text-slate-400 font-bold hover:text-blue-600 transition-colors"
                    >초기화</button>
                    <button onClick={closeAllPopups} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto p-1 hide-scrollbar bg-white">
                  {opts.map(opt => {
                    const isSelected = id === 'period' ? selectedPeriods.includes(opt) : (sidebarFilters[id] || []).includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-2.5 p-2.5 hover:bg-slate-50 cursor-pointer transition-colors group text-left">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => {
                            if (id === 'period') {
                              const order = ['6M', '12M', '24M', '36M', '48M', '60M'];
                              let next = selectedPeriods.includes(opt) ? (selectedPeriods.length > 1 ? selectedPeriods.filter(x => x !== opt) : selectedPeriods) : [...selectedPeriods, opt];
                              setSelectedPeriods(next.sort((a, b) => order.indexOf(a) - order.indexOf(b)));
                            } else {
                              const curr = sidebarFilters[id] || [];
                              setSidebarFilters(p => ({ ...p, [id]: curr.includes(opt) ? curr.filter(x => x !== opt) : [...curr, opt] }));
                            }
                          }}
                          className="w-3.5 h-3.5 accent-slate-800 rounded-none" 
                        />
                        <span className={`truncate flex-1 font-bold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                          {id==='period' ? formatPeriod(opt) : opt}{ (id==='rental'||id==='deposit') && !opt.includes('만') ? '만원' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="p-3 border-t bg-slate-50/30">
                  <button onClick={closeAllPopups} className="w-full py-2.5 bg-white border border-slate-200 text-slate-800 font-bold text-[11px] uppercase tracking-widest apply-btn-shadow">필터 적용</button>
                </div>
              </div>
            );
          })()}

          {/* [정밀 수정] 컬럼 헤더 필터 팝업: 제목칸 바로 아래(triggerRect.bottom)에 나오도록 고정 */}
          {activeFilterColumn && triggerRect && (() => {
            const dataKey = activeFilterColumn;
            const label = Object.keys(baseColumns).find(k => baseColumns[k] === dataKey);
            const counts = rawData.reduce((acc, item) => {
              const v = String(item[dataKey] || "미정");
              acc[v] = (acc[v] || 0) + 1;
              return acc;
            }, {});
            const sortedOptions = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const leftPos = Math.min(triggerRect.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 270);

            return (
              <div 
                className="absolute bg-white border border-slate-200 natural-shadow z-[100] w-64 rounded-none overflow-hidden flex flex-col" 
                style={{ top: `${triggerRect.bottom}px`, left: `${leftPos}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{label} 필터</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setColumnFilters(p => ({ ...p, [dataKey]: [] }))}
                      className="text-[10px] text-slate-400 font-bold hover:text-blue-600 transition-colors"
                    >초기화</button>
                    <button onClick={closeAllPopups} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto p-1 bg-white hide-scrollbar">
                  {sortedOptions.map(([value, count]) => {
                    const isSelected = (columnFilters[dataKey] || []).includes(value);
                    return (
                      <label key={value} className="flex items-center gap-2.5 p-2.5 hover:bg-slate-50 cursor-pointer group transition-colors text-left">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => {
                            const curr = columnFilters[dataKey] || [];
                            setColumnFilters(p => ({ ...p, [dataKey]: curr.includes(value) ? curr.filter(x => x !== value) : [...curr, value] }));
                          }}
                          className="w-3.5 h-3.5 accent-slate-800 rounded-none" 
                        />
                        <span className={`truncate flex-1 font-bold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>{value}</span>
                        <span className="text-slate-400 text-[10px] font-bold ml-auto">{count}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="p-3 border-t bg-slate-50/30">
                  <button onClick={closeAllPopups} className="w-full py-2.5 bg-white border border-slate-200 text-slate-800 font-bold text-[11px] apply-btn-shadow uppercase tracking-widest">필터 적용</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default App;
