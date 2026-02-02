import React, { useState, useEffect, useMemo } from 'react';
import { Search, RotateCw, Download, X, Car, Copy, Share2, CheckCircle2, AlertCircle } from 'lucide-react';

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREzDg6YIAoZBiSeT58g6sksXFZkILyX0hKJeuQIdfKxWDRgu7SX7epVkuKMjXvp8n10-sNCoWRyJdJ/pub?gid=1259006970&single=true&output=csv";

const App = () => {
  // 1. 상태 관리 (State): 값이 바뀌면 리액트가 '바뀐 부분만' 다시 그립니다.
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [loading, setLoading] = useState(false);

  // 2. 데이터 가져오기 (Effect)
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CSV_URL}&cachebust=${Date.now()}`);
      const text = await res.text();
      const rows = text.split(/\r?\n/).filter(r => r.trim());
      const headers = rows[0].split(',').map(h => h.trim());
      const jsonData = rows.slice(1).map(row => {
        const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return headers.reduce((obj, header, i) => { obj[header] = values[i]; return obj; }, {});
      });
      setData(jsonData);
    } catch (e) { console.error("데이터 로드 실패", e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // 3. 필터링 로직 (Memo): 데이터가 수만 건이라도 최적화되어 작동합니다.
  const filteredData = useMemo(() => {
    return data.filter(item => 
      Object.values(item).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [data, searchTerm]);

  return (
    <div className="flex h-screen bg-[#f1f3f6] text-[11px] overflow-hidden">
      {/* 좌측 사이드바 (생략 - 원본 디자인 유지 가능) */}
      <div className="w-[72px] bg-white border-r"></div>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-[50px] bg-white border-b flex items-center px-4 gap-4 shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="매물 통합 검색..." 
              className="w-full pl-9 pr-4 py-2 border rounded-none focus:outline-none"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-bold">매물: <b className="text-blue-600">{filteredData.length}</b>건</span>
            <button onClick={fetchData} className="p-2 border hover:bg-slate-50">
              <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* 테이블: innerHTML 대신 리액트의 'map' 사용 (엄청나게 빠름) */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#f8f9fb] border-b">
              <tr>
                <th className="p-2">상태</th><th className="p-2">구분</th><th className="p-2">차량번호</th>
                <th className="p-2">모델</th><th className="p-2">대여료</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((car, idx) => (
                <tr 
                  key={idx} 
                  onClick={() => setSelectedCar(car)}
                  className={`hover:bg-slate-50 cursor-pointer h-[52px] border-b ${selectedCar?.차량_번호 === car.차량_번호 ? 'bg-blue-50' : ''}`}
                >
                  <td className="p-2 text-center">{car.차량_상태}</td>
                  <td className="p-2 text-center">{car.차량_구분}</td>
                  <td className="p-2 font-bold text-center">{car.차량_번호}</td>
                  <td className="p-2 font-black">{car.차량_모델명}</td>
                  <td className="p-2 text-right pr-6 font-bold text-blue-700">{car.금액_대여료_36M}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 상세페이지: 조건부 렌더링 (값이 있을 때만 나타남) */}
        {selectedCar && (
          <div className="absolute right-0 top-0 h-full w-[440px] bg-white shadow-2xl border-l animate-drawer-reset z-[100] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-black flex items-center gap-2"><Car /> 상세 정보</h2>
              <button onClick={() => setSelectedCar(null)}><X /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="p-3 bg-slate-50 border rounded font-bold">
                <p className="text-blue-700 text-lg">{selectedCar.차량_번호}</p>
                <p>{selectedCar.차량_제조사} {selectedCar.차량_모델명}</p>
              </div>
              {/* 추가 상세 로직들... */}
            </div>
            <div className="p-3 border-t grid grid-cols-2 gap-2">
               <button className="bg-slate-800 text-white py-3 font-bold uppercase">전달용 텍스트 복사</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
