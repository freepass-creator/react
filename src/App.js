import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, X, RefreshCw, Download, Car, Shield, 
  FileText, User, CreditCard, ExternalLink, Database,
  ChevronRight, CheckCircle2, Copy, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Calendar, 
  Banknote, Coins, Gauge, History, Lock, Clock, CalendarDays,
  Info, Sparkles, AlertCircle, Phone, Wrench, Share2, RotateCw
} from 'lucide-react';

// [1] 구글 시트 웹 게시 URL
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREzDg6YIAoZBiSeT58g6sksXFZkILyX0hKJeuQIdfKxWDRgu7SX7epVkuKMjXvp8n10-sNCoWRyJdJ/pub?gid=1259006970&single=true&output=csv";

// --- 필터용 옵션 데이터 (고정값) ---
const rentalOptions = ['50만 이하', '50~60', '60~70', '70~80', '80~90', '90~100', '100만 이상'];
const depositOptions = ['100만 이하', '100~200', '200~300', '300~400', '400~500', '500만 이상'];
const mileageOptions = ['1만km 미만', '1~3만', '3~5만', '5~10만', '10만km 이상'];
const yearOptions = ['1년 이하', '1~3년', '3~5년', '5년 이상'];

// --- 커스텀 공통 컴포넌트 ---

const StatusBadge = ({ text, type }) => {
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
    <span className={`inline-flex items-center justify-center px-1.5 py-0.5 border text-[10px] font-black leading-none whitespace-nowrap rounded-none ${colorClass}`}>
      {text}
    </span>
  );
};

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [copyLinkFeedback, setCopyLinkFeedback] = useState(false);
  
  const [managerInfo, setManagerInfo] = useState({
    company: localStorage.getItem('erp_manager_company') || '',
    nameTitle: localStorage.getItem('erp_manager_nameTitle') || '',
    phone: localStorage.getItem('erp_manager_phone') || '',
    includeAccount: localStorage.getItem('erp_manager_includeAcc') === 'true'
  });

  const [selectedPeriods, setSelectedPeriods] = useState(['36M', '48M', '60M']); 
  const [columnFilters, setColumnFilters] = useState({}); 
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' }); 
  
  const [sidebarFilters, setSidebarFilters] = useState({
    rental: [], deposit: [], mileage: [], year: []
  });
  
  const [activeFilterColumn, setActiveFilterColumn] = useState(null); 
  const [activeSidebarPopup, setActiveSidebarPopup] = useState(null); 
  
  const filterRef = useRef(null);
  const sidebarPopupRef = useRef(null);

  // --- 핵심 유틸리티 함수 ---

  const parseNum = (str) => {
    if (!str) return 0;
    const val = parseInt(String(str).replace(/[^0-9]/g, ''));
    return isNaN(val) ? 0 : val;
  };

  const formatPrice = (val) => {
    const num = parseNum(val);
    return num.toLocaleString();
  };

  const formatPeriod = (p) => {
    if (!p) return "";
    return p.replace('M', '개월');
  };

  // --- 필터 오픈 제어 ---

  const handleSidebarPopupToggle = (id) => {
    if (activeSidebarPopup === id) {
      setActiveSidebarPopup(null);
    } else {
      setActiveFilterColumn(null);
      setActiveSidebarPopup(id);
    }
  };

  const handleColumnFilterToggle = (key) => {
    if (activeFilterColumn === key) {
      setActiveFilterColumn(null);
    } else {
      setActiveSidebarPopup(null);
      setActiveFilterColumn(key);
    }
  };

  // --- 인터랙션 함수 정의 ---

  const togglePeriod = (p) => {
    setSelectedPeriods(prev => {
      const periodsOrder = ['6M', '12M', '24M', '36M', '48M', '60M'];
      const next = prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p];
      return next.sort((a, b) => periodsOrder.indexOf(a) - periodsOrder.indexOf(b));
    });
  };

  const toggleSidebarFilter = (key, value) => {
    setSidebarFilters(prev => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const requestSort = (key) => {
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'desc') {
        setSortConfig({ key, direction: 'asc' });
      } else {
        setSortConfig({ key: null, direction: 'desc' });
      }
    } else {
      setSortConfig({ key, direction: 'desc' });
    }
  };

  const handleCarClick = (car) => {
    if (selectedCar && selectedCar.차량_번호 === car.차량_번호) {
      setSelectedCar(null);
    } else {
      setSelectedCar(car);
      setCopyFeedback(false);
      setCopyLinkFeedback(false);
    }
  };

  const downloadExcel = () => {
    const tableHeaders = ["상태", "구분", "차량번호", "제조사", "모델", "세부모델", "세부트림(선택옵션)", "외부색상", "내부색상", "주행거리", "대여료", "보증금"];
    const csvContent = "\uFEFF" + tableHeaders.join(",");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.setAttribute("download", "매물리스트_엑셀.csv"); link.click();
  };

  const handleCopySummary = () => {
    if (!selectedCar) return;
    
    let text = `[상품 상세 정보]\n\n`;
    text += `1. 차량 상세 제원\n`;
    text += `■ 차량번호: ${selectedCar.차량_번호} (${selectedCar.차량_구분}/${selectedCar.차량_상태})\n`;
    text += `■ 모델명: ${selectedCar.차량_제조사} ${selectedCar.차량_모델명} ${selectedCar.차량_세부모델}\n`;
    text += `■ 세부트림: ${selectedCar.차량_세부트림}\n`;
    text += `■ 선택옵션: ${selectedCar.차량_선택옵션 || '기본 사양'}\n`;
    text += `■ 주요제원: ${selectedCar.차량_연료 || '-'} / ${selectedCar.차량_배기량 ? formatPrice(selectedCar.차량_배기량) + 'cc' : '-'} / ${formatPrice(selectedCar.차량_현재주행거리)}km\n`;
    text += `■ 색상(내/외): ${selectedCar.차량_내부색상} / ${selectedCar.차량_외부색상}\n`;
    text += `■ 실물사진확인: ${selectedCar.차량_사진링크 || '링크 정보 없음'}\n\n`;

    text += `2. 대여료 및 보증금 안내 (부가세 포함)\n`;
    ['6M', '12M', '24M', '36M', '48M', '60M'].forEach(m => {
      const fee = selectedCar[`금액_대여료_${m}`];
      const dep = selectedCar[`금액_보증금_${m}`];
      if (fee && fee !== '-' && fee !== '0' && fee !== '0원') {
        text += `■ ${formatPeriod(m)}: 월 대여료 ${fee} / 보증금 ${dep}\n`;
      }
    });
    text += `\n`;

    text += `3. 보험 보상 상세\n`;
    text += `■ 대인배상: ${selectedCar.보험_대인 || '무한'} (면책금: ${selectedCar.보험_대인면책금 || '0원'})\n`;
    text += `■ 대물배상: ${selectedCar.보험_대물 || '1억원'} (면책금: ${selectedCar.보험_대물면책금 || '10만'})\n`;
    text += `■ 자기신체(자손): ${selectedCar.보험_자손 || '3천만'} (면책금: ${selectedCar.보험_자손면책금 || '없음'})\n`;
    text += `■ 무보험차 상해: ${selectedCar.보험_무보험 || '2억원'} (면책금: ${selectedCar.보험_무보험면책금 || '없음'})\n`;
    text += `■ 자기차량(자차): 차량가액 한도 (면책금: 수리비 20%, ${selectedCar.보험_최소면책금 || '20만'}~${selectedCar.보험_최대면책금 || '50만'})\n`;
    text += `■ 면책금 할증: 1년 미만 운전자 면책금 30만원 추가 할증 적용\n`;
    text += `■ 긴급출동: 연 5회 제공\n\n`;

    text += `4. 계약 및 추가 비용 조건\n`;
    text += `■ 기본연령: ${selectedCar.계약_기본운전연령 || '만 26세 이상'}\n`;
    text += `■ 약정거리: ${selectedCar.계약_약정주행거리 || '2만km'}\n`;
    text += `■ 해지위약: 중도해지 수수료율 30%\n`;
    
    const fee21 = parseNum(selectedCar.계약_21세추가금);
    const fee23 = parseNum(selectedCar.계약_23세추가금);
    text += `■ 연령 하향(+): 만 21세(${fee21 > 0 ? formatPrice(fee21) + '원' : '운영안함'}), 만 23세(${fee23 > 0 ? formatPrice(fee23) + '원' : '운영안함'})\n`;
    text += `■ 거리 추가(+): 1만km당 ${formatPrice(selectedCar.계약_주행거리추가금)}원/월\n\n`;

    text += `5. 담당자 정보\n`;
    text += `■ 소속/담당: ${managerInfo.company || '-'} ${managerInfo.nameTitle || '-'}\n`;
    text += `■ 연락처: ${managerInfo.phone || '-'}\n`;
    if (managerInfo.includeAccount) {
      text += `■ 입금계좌: ${selectedCar.계약_입금계좌번호 || '계좌 정보 미등록'} (우리은행/프레패스)\n`;
    }
    text += `\n* 본 정보는 내부 전산 데이터로 실시간 재고 상황에 따라 변동될 수 있습니다.`;

    const textArea = document.createElement("textarea");
    textArea.value = text; document.body.appendChild(textArea); textArea.select();
    try { 
      document.execCommand('copy'); 
      setCopyFeedback(true); 
      setTimeout(() => setCopyFeedback(false), 2000); 
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  const handleCopyLink = () => {
    if (!selectedCar) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?car=${selectedCar.차량_번호}`;
    const textArea = document.createElement("textarea");
    textArea.value = shareUrl; document.body.appendChild(textArea); textArea.select();
    try { 
      document.execCommand('copy'); 
      setCopyLinkFeedback(true); 
      setTimeout(() => setCopyLinkFeedback(false), 2000); 
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  const fetchData = async () => {
    setLoading(true);
    setIsRefreshing(true);
    try {
      const response = await fetch(`${CSV_URL}&cachebust=${Date.now()}`);
      if (!response.ok) throw new Error("데이터 연동 실패");
      const text = await response.text();
      const rows = text.split(/\r?\n/).filter(r => r.trim());
      if (rows.length === 0) { setData([]); setLoading(false); setIsRefreshing(false); return; }
      const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const jsonData = rows.slice(1).map(row => {
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const values = row.split(regex).map(v => v ? v.trim().replace(/^"|"$/g, '').replace(/""/g, '"') : "");
        return headers.reduce((obj, header, i) => { obj[header] = values[i] || ""; return obj; }, {});
      });
      setData(jsonData);
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 600);
    } catch (e) { 
      console.error(e.message); 
      setLoading(false); 
      setIsRefreshing(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  useEffect(() => {
    localStorage.setItem('erp_manager_company', managerInfo.company);
    localStorage.setItem('erp_manager_nameTitle', managerInfo.nameTitle);
    localStorage.setItem('erp_manager_phone', managerInfo.phone);
    localStorage.setItem('erp_manager_includeAcc', String(managerInfo.includeAccount));
  }, [managerInfo]);

  const filteredAndSortedData = useMemo(() => {
    let result = data.filter(item => {
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
      
      // --- 연식 필터링 로직 (최초등록일과 현재일자 간의 일수차이 365일 기준 계산) ---
      let matchesYear = true;
      if (sidebarFilters.year.length > 0) {
        const rawDate = item.차량_최초등록일 || item['최초등록일'] || "";
        if (!rawDate) {
          matchesYear = false;
        } else {
          try {
            // 현재 날짜 (시스템 제공 시간 기준)
            const now = new Date('2026-02-02');
            // 등록일 파싱 (YYYY.MM.DD 또는 YYYY-MM-DD 대응)
            const regDate = new Date(String(rawDate).replace(/\./g, '-'));
            
            // 일수 차이 계산
            const diffTime = Math.abs(now - regDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const ageYears = diffDays / 365;

            matchesYear = sidebarFilters.year.some(range => {
              if (range === '1년 이하') return ageYears <= 1;
              if (range === '1~3년') return ageYears > 1 && ageYears <= 3;
              if (range === '3~5년') return ageYears > 3 && ageYears <= 5;
              if (range === '5년 이상') return ageYears > 5;
              return false;
            });
          } catch (e) {
            matchesYear = false;
          }
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
  }, [searchTerm, data, columnFilters, sortConfig, sidebarFilters, selectedPeriods]);

  const baseColumns = { "상태": "차량_상태", "구분": "차량_구분", "차량번호": "차량_번호", "제조사": "차량_제조사", "모델": "차량_모델명", "세부모델": "차량_세부모델", "세부트림(선택옵션)": "차량_세부트림", "외부색상": "차량_외부색상", "내부색상": "차량_내부색상", "주행거리": "차량_현재주행거리" };
  const sortableColumns = ["주행거리"];
  const filterableColumns = ["상태", "구분", "제조사", "모델", "세부모델", "외부색상", "내부색상"];

  return (
    <div className="flex h-screen bg-[#f1f3f6] text-slate-900 overflow-hidden rounded-none font-sans select-none border-none text-[11px]">
      <style>{`
        @keyframes drawerAppear { 0% { transform: translateX(100%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        .animate-drawer-reset { animation: drawerAppear 0.3s cubic-bezier(0.1, 0.9, 0.2, 1) forwards; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        
        .sidebar-elevation {
          box-shadow: 4px 0 15px rgba(0, 0, 0, 0.08), 1px 0 3px rgba(0, 0, 0, 0.1);
        }
        
        /* 통합된 버튼 그림자 및 눌림 효과 */
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
        
        /* 좌측 필터바 버튼용 자연스러운 눌림 효과 (그림자 사라지고 안으로) */
        .tactile-btn {
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
          transition: all 0.1s ease;
        }
        .tactile-btn:hover {
          background-color: #f8fafc;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }
        .tactile-btn-active {
          box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.1) !important;
          transform: translateY(1px);
        }
        
        .natural-shadow { box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05); }
        
        .apply-btn-shadow { 
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
          transition: all 0.1s ease;
        }
        .apply-btn-shadow:hover { 
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); 
        }
        .apply-btn-shadow:active {
          transform: translateY(1px);
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
        }
      `}</style>
      
      {/* --- 좌측 필터바 --- */}
      <div className="w-[72px] bg-white flex flex-col z-[60] flex-shrink-0 border-r border-slate-200 relative sidebar-elevation">
        <div className="mt-[80px] flex flex-col items-center gap-2 px-1.5">
          {[
            { id: 'period', label: '기간' },
            { id: 'rental', label: '대여료' },
            { id: 'deposit', label: '보증금' },
            { id: 'mileage', label: '주행거리' },
            { id: 'year', label: '연식' }
          ].map((btn, index) => {
            const isActive = activeSidebarPopup === btn.id;
            const isFiltered = btn.id === 'period' ? selectedPeriods.length > 0 : sidebarFilters[btn.id]?.length > 0;
            const isBottomAligned = index >= 3; 
            
            return (
              <div key={btn.id} className="relative w-full">
                <button 
                  onClick={() => handleSidebarPopupToggle(btn.id)} 
                  className={`w-full h-[40px] flex flex-col items-center justify-center border border-slate-100 relative tactile-btn ${
                    isActive ? 'tactile-btn-active text-blue-700 z-10 bg-slate-50' : 'bg-white text-slate-700'
                  }`}
                >
                  <span className="text-[10px] font-black tracking-tighter uppercase text-center leading-[1.1]">{btn.label}</span>
                  {isFiltered && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-600 rounded-full border border-white"></div>
                  )}
                </button>

                {isActive && (
                  <div ref={sidebarPopupRef} className={`absolute left-full ml-2 w-[210px] bg-white border border-slate-200 natural-shadow z-[70] text-left rounded-none overflow-hidden flex flex-col ${isBottomAligned ? 'bottom-0' : 'top-0'}`}>
                    <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">{btn.label} 필터</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { if (btn.id === 'period') setSelectedPeriods(['36M', '48M', '60M']); else setSidebarFilters(prev => ({...prev, [btn.id]: []})); }} 
                          className="text-[10px] text-slate-400 font-black hover:text-blue-600"
                        >
                          초기화
                        </button>
                        <button onClick={() => setActiveSidebarPopup(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1.5 hide-scrollbar flex-1 bg-white text-[11px]">
                      {(btn.id === 'period' ? ['6M', '12M', '24M', '36M', '48M', '60M'] : 
                        btn.id === 'rental' ? rentalOptions : 
                        btn.id === 'deposit' ? depositOptions : 
                        btn.id === 'mileage' ? mileageOptions : yearOptions
                      ).map(opt => (
                        <label key={opt} className="flex items-center gap-2.5 p-2.5 hover:bg-slate-50 cursor-pointer transition-colors group">
                          <input 
                            type="checkbox" 
                            className="w-3.5 h-3.5 accent-slate-800 rounded-none" 
                            checked={btn.id === 'period' ? selectedPeriods.includes(opt) : sidebarFilters[btn.id].includes(opt)} 
                            onChange={() => btn.id === 'period' ? togglePeriod(opt) : toggleSidebarFilter(btn.id, opt)} 
                          />
                          <span className={`truncate flex-1 font-bold ${ (btn.id === 'period' ? selectedPeriods.includes(opt) : sidebarFilters[btn.id].includes(opt)) ? 'text-slate-900' : 'text-slate-500' }`}>
                            {btn.id === 'period' ? formatPeriod(opt) : opt}{btn.id === 'rental' || btn.id === 'deposit' ? (opt.includes('만') ? '' : '만원') : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="p-3 border-t bg-white">
                      <button 
                        onClick={() => setActiveSidebarPopup(null)}
                        className="w-full py-2.5 bg-white border border-slate-200 text-slate-800 font-black text-[11px] apply-btn-shadow transition-all uppercase tracking-widest"
                      >
                        필터 적용
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-[50px] bg-white border-b border-slate-200 flex items-center px-4 gap-4 flex-shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-3 flex-1 max-w-2xl">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
              <input type="text" placeholder="매물 통합 검색..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-none text-xs focus:outline-none focus:border-slate-400 bg-white" onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={downloadExcel} className="flex items-center gap-1.5 px-3 py-2 bg-[#1D6F42] border border-[#1D6F42] font-bold text-[10px] hover:bg-[#155d36] transition-all text-white rounded-none btn-pressable">
              <Download size={12}/> 엑셀 다운로드
            </button>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[11px] text-slate-400 font-black uppercase tracking-tighter">데이터 서버 연동 중:</span>
              <b className="text-slate-800 font-black text-[11px]">{filteredAndSortedData.length}</b>
              <span className="text-[11px] text-slate-500 font-bold">건</span>
            </div>
            <div className="h-4 border-l border-slate-200"></div>
            <button 
              onClick={fetchData} 
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 font-bold text-[11px] hover:bg-slate-50 transition-all text-slate-700 rounded-none btn-pressable"
            >
              <RotateCw size={12} className={isRefreshing ? 'animate-spin' : ''} /> 최신화
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-white m-0 relative text-slate-800">
          <table className="w-full border-collapse text-left text-[11px] table-fixed">
            <thead className="sticky top-0 bg-[#f8f9fb] border-b border-slate-300 z-40 font-bold text-slate-600 text-center uppercase tracking-tighter">
              <tr className="divide-x divide-slate-200">
                {Object.keys(baseColumns).map((label, idx) => {
                  const dataKey = baseColumns[label];
                  const isFiltered = columnFilters[dataKey]?.length > 0;
                  const isSorted = sortConfig.key === dataKey;
                  const canSort = sortableColumns.includes(label);
                  const canFilter = filterableColumns.includes(label);
                  
                  let columnWidth = (label === '상태' || label === '구분') ? "w-[72px]" : 
                                     label === '차량번호' ? "w-[100px]" : 
                                     label === '제조사' ? "w-[90px]" : 
                                     label === '모델' ? "w-[110px]" : 
                                     label === '세부모델' ? "w-[120px]" : 
                                     label === '세부트림(선택옵션)' ? "w-[160px]" : 
                                     label === '외부색상' || label === '내부색상' ? "w-[85px]" : 
                                     label === '주행거리' ? "w-[105px]" : "w-auto";
                  
                  const isRightEnd = idx >= 7;
                  const popupAlignClass = isRightEnd ? "right-0" : "left-0";

                  return (
                    <th key={label} className={`py-2 px-1 relative transition-colors border-b border-slate-200 ${isSorted ? 'bg-blue-50' : ''} ${columnWidth}`}>
                      <div className="flex flex-row items-center justify-center gap-1 leading-tight h-full relative overflow-hidden">
                        <span className={`${isFiltered || isSorted ? 'text-blue-700 font-black' : ''} truncate`}>{label}</span>
                        {canFilter && (
                          <button onClick={(e) => { e.stopPropagation(); handleColumnFilterToggle(dataKey); }} className={`p-0.5 transition-colors ${isFiltered ? 'text-blue-700' : 'text-slate-300 hover:text-slate-600'}`}>
                            <Filter size={10} fill={isFiltered ? "currentColor" : "none"} />
                          </button>
                        )}
                        {canSort && (
                          <button onClick={() => requestSort(dataKey)} className={`p-0.5 transition-colors ${isSorted ? 'text-blue-700' : 'text-slate-300 hover:text-slate-600'}`}>
                            {isSorted ? (sortConfig.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} />}
                          </button>
                        )}
                      </div>
                      
                      {canFilter && activeFilterColumn === dataKey && (
                        <div ref={filterRef} className={`absolute top-full ${popupAlignClass} mt-0 w-64 bg-white border border-slate-200 natural-shadow z-50 text-left font-normal normal-case rounded-none overflow-hidden flex flex-col`}>
                          <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">{label} 필터</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setColumnFilters(p => ({...p, [dataKey]: []}))} className="text-[10px] text-slate-400 font-black hover:text-blue-600">초기화</button>
                              <button onClick={() => setActiveFilterColumn(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto p-1 bg-white text-[11px]">
                            {(() => {
                              const counts = data.reduce((acc, item) => { const val = String(item[dataKey] || "미정"); acc[val] = (acc[val] || 0) + 1; return acc; }, {});
                              const sortedOptions = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                              return sortedOptions.map(([value, count]) => (
                                <label key={value} className="flex items-center gap-2.5 p-2.5 hover:bg-slate-50 cursor-pointer group transition-colors">
                                  <input type="checkbox" className="w-3.5 h-3.5 accent-slate-800 rounded-none" checked={(columnFilters[dataKey] || []).includes(value)} onChange={() => { const current = columnFilters[dataKey] || []; const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]; setColumnFilters(prev => ({ ...prev, [dataKey]: next })); }}/>
                                  <span className="truncate flex-1 font-bold text-slate-600 group-hover:text-slate-900">{value}</span>
                                  <span className="text-slate-400 text-[10px] font-medium ml-auto">{count}</span>
                                </label>
                              ));
                            })()}
                          </div>
                          <div className="p-3 border-t bg-slate-50/30">
                            <button 
                              onClick={() => setActiveFilterColumn(null)}
                              className="w-full py-2.5 bg-white border border-slate-200 text-slate-800 font-black text-[11px] apply-btn-shadow transition-all uppercase tracking-widest"
                            >
                              필터 적용
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
                {selectedPeriods.map((p) => {
                  const dataKey = `금액_대여료_${p}`;
                  const isSorted = sortConfig.key === dataKey;
                  return (
                    <th key={p} className={`py-2 px-1 relative w-[105px] bg-blue-50 border-l border-blue-100 text-blue-800 ${isSorted ? 'bg-blue-100' : ''}`}>
                      <div className="flex flex-row items-center justify-center gap-1 leading-tight h-full font-black">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase">{formatPeriod(p)} 대여료</span>
                          <span className="text-[9px] opacity-70 font-bold">(보증금)</span>
                        </div>
                        <button onClick={() => requestSort(dataKey)} className={`p-0.5 transition-colors ${isSorted ? 'text-blue-700' : 'text-slate-300 hover:text-slate-600'}`}>
                          {isSorted ? (sortConfig.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} />}
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-sans">
              {filteredAndSortedData.map((item, idx) => (
                <tr key={idx} onClick={() => handleCarClick(item)} className={`hover:bg-slate-50 cursor-pointer divide-x divide-slate-50 h-[52px] transition-colors ${selectedCar?.차량_번호 === item.차량_번호 ? 'bg-blue-50 font-bold' : ''}`}>
                  <td className="p-2 overflow-hidden truncate text-center"><StatusBadge text={item.차량_상태} type="상태" /></td>
                  <td className="p-2 overflow-hidden truncate text-center"><StatusBadge text={item.차량_구분} type="구분" /></td>
                  <td className="p-2 truncate font-bold text-slate-900">{item.차량_번호 || '-'}</td>
                  <td className="p-2 truncate text-slate-700 font-medium">{item.차량_제조사 || '-'}</td>
                  <td className="p-2 truncate font-black text-center text-slate-900">{item.차량_모델명 || '-'}</td>
                  <td className="p-2 truncate text-slate-500 text-left font-medium">{item.차량_세부모델 || '-'}</td>
                  <td className="p-2 text-left leading-none">
                    <div className="font-bold text-slate-800 truncate">{item.차량_세부트림 || '-'}</div>
                    <div className="text-slate-400 font-normal text-[9px] truncate mt-1">{item.차량_선택옵션 || '옵션없음'}</div>
                  </td>
                  <td className="p-2 truncate text-slate-500 whitespace-nowrap font-medium">{item.차량_외부색상 || '-'}</td>
                  <td className="p-2 truncate text-slate-500 whitespace-nowrap font-medium">{item.차량_내부색상 || '-'}</td>
                  <td className="p-2 truncate text-right font-bold text-slate-700 tracking-tight pr-6">{item.차량_현재주행거리 || '0'}km</td>
                  {selectedPeriods.map(p => (
                    <td key={p} className="p-2 bg-blue-50/30 text-blue-800 font-black text-right pr-6 leading-none">
                      <div className="text-[12px]">{item[`금액_대여료_${p}`] || '-'}</div>
                      <div className="text-slate-400 font-bold text-[9px] mt-1">{item[`금액_보증금_${p}`] || '-'}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- 상품 상세 정보 레이어 --- */}
        <div key={selectedCar?.차량_번호 || 'none'} className={`absolute right-0 top-0 h-full w-[440px] bg-white natural-shadow z-[100] flex flex-col border-l border-slate-200 transition-transform duration-300 ease-in-out font-sans ${selectedCar ? 'translate-x-0 animate-drawer-reset' : 'translate-x-full'}`}>
          {selectedCar && (
            <>
              <div className="h-[50px] flex justify-between items-center px-4 bg-white border-b border-slate-100 text-slate-800 flex-shrink-0">
                <h2 className="font-black text-[12px] tracking-widest uppercase flex items-center gap-2">
                  <Car size={16} className="text-slate-800" /> 상품 상세 정보
                </h2>
                <button onClick={() => setSelectedCar(null)} className="text-slate-400 hover:text-slate-800 transition-colors p-1"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide text-slate-800 bg-white text-[11px]">
                <section className="border border-slate-200 bg-white rounded-none overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                    <span className="font-black text-[11px] text-slate-600 uppercase tracking-tighter">1. 차량 상세 제원</span>
                  </div>
                  <div className="p-3 space-y-3.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-[12px] text-blue-700 tracking-tight">{selectedCar.차량_번호}</span>
                        <span className="font-black text-[12px] text-slate-900">{selectedCar.차량_제조사} {selectedCar.차량_모델명}</span>
                        <span className="font-bold text-[11px] text-slate-500 uppercase">{selectedCar.차량_연료}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <StatusBadge text={selectedCar.차량_구분} type="구분" />
                        <StatusBadge text={selectedCar.차량_상태} type="상태" />
                      </div>
                    </div>
                    <div className="space-y-1.5 py-0.5">
                      <div className="flex gap-2 items-start"><span className="text-slate-400 font-bold w-[60px] flex-shrink-0 text-[10px] uppercase">세부모델</span><span className="font-black text-slate-900">{selectedCar.차량_세부모델}</span></div>
                      <div className="flex gap-2 items-start"><span className="text-slate-400 font-bold w-[60px] flex-shrink-0 text-[10px] uppercase">세부트림</span><span className="font-black text-blue-700">{selectedCar.차량_세부트림}</span></div>
                      <div className="flex gap-2 items-start"><span className="text-slate-400 font-bold w-[60px] flex-shrink-0 text-[10px] uppercase">선택옵션</span><span className="font-medium text-slate-600 leading-tight">{selectedCar.차량_선택옵션 || '장착 정보 없음'}</span></div>
                      <div className="flex gap-2 items-start"><span className="text-slate-400 font-bold w-[60px] flex-shrink-0 text-[10px] uppercase">외부/내부</span><span className="font-black text-slate-700">{selectedCar.차량_외부색상} / {selectedCar.차량_내부색상}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                      <div className="flex justify-between items-center"><span className="text-slate-400 font-bold text-[10px] uppercase tracking-tighter">주행거리</span><span className="font-black text-blue-700">{formatPrice(selectedCar.차량_현재주행거리)}km</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-400 font-bold text-[10px] uppercase tracking-tighter">배기량</span><span className="font-black">{selectedCar.차량_배기량 ? formatPrice(selectedCar.차량_배기량) + 'cc' : '-'}</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-400 font-bold text-[10px] uppercase tracking-tighter">최초등록</span><span className="font-black">{selectedCar.차량_최초등록일}</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-400 font-bold text-[10px] uppercase tracking-tighter">차령만료</span><span className="font-black text-rose-600">{selectedCar.차량_차령만료일 || '-'}</span></div>
                      <div className="col-span-2 flex flex-col mt-1 p-2.5 bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 font-black text-[9px] uppercase mb-1.5 tracking-tighter">차량 세부 상태 및 비고</span>
                        <div className="flex items-start gap-2">
                          <StatusBadge text={selectedCar.차량_세부상태} type="세부상태" />
                          <span className="font-medium text-slate-700 leading-relaxed">{selectedCar.차량_비고 || '입력된 특이사항이 없습니다.'}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => window.open(selectedCar.차량_사진링크, '_blank')} className="w-full py-3 bg-white border border-slate-300 text-slate-800 font-black text-[10px] uppercase apply-btn-shadow active:scale-95 transition-all">차량 사진 확인 (링크)</button>
                  </div>
                </section>

                <section className="border border-slate-200 bg-white rounded-none overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-black text-[11px] text-slate-600 uppercase tracking-tighter">2. 대여료 및 보증금 안내</div>
                  <table className="w-full text-center border-collapse text-[11px]">
                    <thead className="bg-[#f8f9fb] border-b border-slate-200 font-bold text-slate-500 uppercase">
                      <tr className="divide-x divide-slate-200"><th className="py-2">계약기간</th><th className="py-2 text-blue-800 text-right pr-4">월 대여료</th><th className="py-2 text-slate-400 text-right pr-4">보증금</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {['6M', '12M', '24M', '36M', '48M', '60M'].map(m => {
                        const fee = selectedCar[`금액_대여료_${m}`];
                        const dep = selectedCar[`금액_보증금_${m}`];
                        if (!fee || fee === '-' || fee === '0' || fee === '0원') return null;
                        return (<tr key={m} className="divide-x divide-slate-100 hover:bg-slate-50 transition-colors"><td className="py-2 font-black uppercase">{formatPeriod(m)}</td><td className="py-2 text-blue-800 font-black text-right pr-4">{fee}원</td><td className="py-2 text-slate-500 text-right pr-4">{dep}원</td></tr>);
                      })}
                    </tbody>
                  </table>
                </section>

                <section className="border border-slate-200 bg-white rounded-none overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-black text-[11px] text-slate-600 uppercase tracking-tighter">3. 보험 보상 및 공통 면책 조건</div>
                  <table className="w-full text-center border-collapse text-[10px]">
                    <thead className="bg-slate-50 font-bold text-slate-400 uppercase">
                      <tr className="divide-x divide-slate-200 border-b border-slate-200"><th className="py-2 px-2 text-left">보상 항목</th><th className="py-2 px-2">보상 한도</th><th className="py-2 px-2 text-right pr-4">면책금</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-bold uppercase tracking-tighter">
                      {[
                        { k: '대인 배상', v: selectedCar.보험_대인 || '무한', d: selectedCar.보험_대인면책금 || '0원' },
                        { k: '대물 배상', v: selectedCar.보험_대물 || '1억원', d: selectedCar.보험_대물면책금 || '10만' },
                        { k: '자기신체(자손)', v: selectedCar.보험_자손 || '3천만', d: selectedCar.보험_자손면책금 || '없음' },
                        { k: '자기차량(자차)', v: '차량가액 한도', d: `수리비 20% (${selectedCar.보험_최소면책금 || '20만'}~${selectedCar.보험_최대면책금 || '50만'})`, highlight: true }
                      ].map((row, i) => (
                        <tr key={i} className={`divide-x divide-slate-100 ${row.highlight ? 'bg-blue-50/20' : ''}`}><td className="p-2 text-left text-slate-500 font-black">{row.k}</td><td className="p-2 font-black text-slate-900">{row.v}</td><td className={`p-2 text-right font-black ${row.highlight ? 'text-rose-700' : 'text-blue-800'} pr-4`}>{row.d}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-2.5 bg-rose-50 border-t border-rose-100 flex items-start gap-2">
                    <AlertCircle size={14} className="text-rose-600 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-rose-700 font-black leading-tight uppercase">
                      1년 미만 운전자 면책금 30만원 추가 할증 적용
                    </p>
                  </div>
                </section>

                <section className="border border-slate-200 bg-white rounded-none overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-black text-[11px] text-slate-600 uppercase tracking-tighter">4. 계약 정책 및 연령/거리 옵션</div>
                  <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-white text-[11px]">
                    <div className="p-2.5 flex justify-between items-baseline"><span className="text-slate-400 font-bold uppercase text-[9px]">기본연령</span><span className="font-black text-slate-900">{selectedCar.계약_기본운전연령 || '만 26세'}</span></div>
                    <div className="p-2.5 flex justify-between items-baseline"><span className="text-slate-400 font-bold uppercase text-[9px]">약정거리</span><span className="font-black text-slate-900">{selectedCar.계약_약정주행거리 || '2만km'}</span></div>
                  </div>
                  <div className="p-2.5 flex justify-between items-center border-b border-slate-100 bg-amber-50/50"><span className="text-amber-700 font-black text-[10px] uppercase">중도해지 수수료율</span><span className="font-black text-amber-800 text-[11px]">잔여대여료의 30%</span></div>
                  <div className="divide-y divide-slate-100 text-slate-800 bg-white text-[11px]">
                    <div className="flex justify-between p-2.5 hover:bg-slate-50 transition-colors">
                      <span className="text-slate-500 font-bold uppercase">만 21세 연령 하향</span>
                      <span className={`font-black ${parseNum(selectedCar.계약_21세추가금) > 0 ? 'text-blue-700' : 'text-slate-400 italic'}`}>{parseNum(selectedCar.계약_21세추가금) > 0 ? `+${formatPrice(selectedCar.계약_21세추가금)}원/월` : '운영안함'}</span>
                    </div>
                    <div className="flex justify-between p-2.5 hover:bg-slate-50 transition-colors">
                      <span className="text-slate-500 font-bold uppercase">만 23세 연령 하향</span>
                      <span className={`font-black ${parseNum(selectedCar.계약_23세추가금) > 0 ? 'text-blue-700' : 'text-slate-400 italic'}`}>{parseNum(selectedCar.계약_23세추가금) > 0 ? `+${formatPrice(selectedCar.계약_23세추가금)}원/월` : '운영안함'}</span>
                    </div>
                    <div className="flex justify-between p-2.5 hover:bg-slate-50 transition-colors">
                      <span className="text-slate-500 font-bold uppercase">연간 1만km 거리 추가</span>
                      <span className="font-black text-blue-700">+{formatPrice(selectedCar.계약_주행거리추가금)}원/월</span>
                    </div>
                    <div className="flex flex-col p-2.5 bg-slate-50 border-t border-slate-100"><span className="text-slate-400 font-black text-[9px] uppercase mb-1.5 tracking-tighter">계약 관련 특이사항</span><div className="font-medium text-slate-700 leading-relaxed">{selectedCar.계약_비고 || '별도의 계약 특이사항이 없습니다.'}</div></div>
                  </div>
                </section>

                <section className="pb-1 border border-slate-200 bg-white rounded-none overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-black text-[11px] text-slate-600 uppercase tracking-tighter">5. 담당자 및 입금 계좌 안내</div>
                  <div className="p-3 space-y-3 bg-white text-[11px]">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="소속" className="p-2.5 border border-slate-200 outline-none font-bold focus:border-slate-800 bg-white rounded-none" value={managerInfo.company} onChange={(e) => setManagerInfo({...managerInfo, company: e.target.value})} />
                      <input type="text" placeholder="성명/직책" className="p-2.5 border border-slate-200 outline-none font-bold focus:border-slate-800 bg-white rounded-none" value={managerInfo.nameTitle} onChange={(e) => setManagerInfo({...managerInfo, nameTitle: e.target.value})} />
                      <input type="text" placeholder="연락처" className="p-2.5 border border-slate-200 outline-none font-bold focus:border-slate-800 col-span-2 bg-white rounded-none" value={managerInfo.phone} onChange={(e) => setManagerInfo({...managerInfo, phone: e.target.value})} />
                    </div>
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" className="w-4 h-4 accent-slate-800 rounded-none" checked={managerInfo.includeAccount} onChange={(e) => setManagerInfo({...managerInfo, includeAccount: e.target.checked})} />
                        <span className="text-[11px] font-black text-slate-800 group-hover:text-blue-700 transition-colors">입금 계좌 정보 포함하기</span>
                      </label>
                      {managerInfo.includeAccount && (<div className="p-3 bg-blue-50/50 border border-blue-100 text-center rounded-none shadow-inner"><p className="text-[11px] font-black text-blue-800 tracking-tighter uppercase mb-0.5">계좌: {selectedCar.계약_입금계좌번호 || '미등록'}</p><p className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">우리은행 (예금주: 프레패스)</p></div>)}
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-3 border-t bg-white flex-shrink-0 grid grid-cols-2 gap-3">
                <button className={`py-3.5 font-black text-[11px] flex items-center justify-center gap-2 transition-all apply-btn-shadow uppercase tracking-widest ${copyLinkFeedback ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'}`} onClick={handleCopyLink}>
                  {copyLinkFeedback ? <CheckCircle2 size={14}/> : <Share2 size={14}/>}<span>{copyLinkFeedback ? '주소 복사됨' : '고객용 링크'}</span>
                </button>
                <button className={`py-3.5 font-black text-[11px] flex items-center justify-center gap-2 transition-all apply-btn-shadow uppercase tracking-widest ${copyFeedback ? 'bg-green-600 text-white border-green-600' : 'bg-slate-800 text-white hover:bg-slate-900 border-slate-800'}`} onClick={handleCopySummary}>
                  {copyFeedback ? <CheckCircle2 size={14}/> : <Copy size={14}/>}<span>{copyFeedback ? '텍스트 복사됨' : '전달용 텍스트'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
