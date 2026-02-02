import React, { useState } from 'react';

function App() {
  // 차량 목록 데이터 상태 (useState)
  const [cars, setCars] = useState([
    { id: 1, name: '그랜저 GN7', number: '123가 4567', status: '대여가능' },
    { id: 2, name: '아반떼 CN7', number: '987나 6543', status: '대여중' },
  ]);

  // 버튼 누르면 차량 하나 추가하는 함수
  const addCar = () => {
    const newCar = {
      id: cars.length + 1,
      name: '신규 등록 차량',
      number: '000가 0000',
      status: '대여가능'
    };
    // 기존 목록 뒤에 새 차량을 붙여서 업데이트!
    setCars([...cars, newCar]);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>■ 프라이패스 모빌리티 ERP</h1>
      <hr />
      
      <h3>1. 실시간 차량 보유 현황</h3>
      <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', marginBottom: '20px' }}>
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

      {/* 버튼을 누르면 addCar 함수가 실행됩니다 */}
      <button 
        onClick={addCar} 
        style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        신규 차량 즉시 추가
      </button>
    </div>
  );
}

export default App;
