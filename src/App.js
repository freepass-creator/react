import React, { useState } from 'react';

function App() {
  // 1. 자동차 데이터 (나중에는 서버에서 받아오게 됩니다)
  const [cars] = useState([
    { id: 1, name: '그랜저 GN7', number: '123가 4567', status: '대여가능' },
    { id: 2, name: '아반떼 CN7', number: '987나 6543', status: '대여중' },
    { id: 3, name: '카니발 KA4', number: '555다 1212', status: '정비중' },
  ]);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>■ 프라이패스 모빌리티 ERP</h1>
      <hr />
      
      <h3>1. 실시간 차량 보유 현황</h3>
      <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f4f4' }}>
            <th style={{ padding: '10px' }}>차량명</th>
            <th>차량번호</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {cars.map(car => (
            <tr key={car.id}>
              <td style={{ padding: '10px' }}>{car.name}</td>
              <td>{car.number}</td>
              <td style={{ color: car.status === '대여가능' ? 'blue' : 'red' }}>
                {car.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '20px' }}>
        <button onClick={() => alert('신규 차량 등록 페이지로 이동합니다.')}>
          신규 차량 등록
        </button>
      </div>
    </div>
  );
}

export default App;
