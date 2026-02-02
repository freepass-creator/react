import React, { useState } from 'react';

function App() {
  const [cars, setCars] = useState([
    { id: 1, name: '그랜저 GN7', number: '123가 4567', status: '대여가능' },
  ]);

  // 입력값을 저장할 상태들
  const [inputName, setInputName] = useState('');
  const [inputNumber, setInputNumber] = useState('');

  const addCar = () => {
    if (!inputName || !inputNumber) return alert('내용을 입력해주세요!');
    
    const newCar = {
      id: cars.length + 1,
      name: inputName,
      number: inputNumber,
      status: '대여가능'
    };
    
    setCars([...cars, newCar]);
    setInputName(''); // 입력 후 칸 비우기
    setInputNumber('');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>■ 프라이패스 모빌리티 ERP</h1>
      <hr />
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
        <h4>[신규 차량 등록]</h4>
        차량명: <input value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="예: 소나타" />
        {' '}번호: <input value={inputNumber} onChange={(e) => setInputNumber(e.target.value)} placeholder="예: 11가 1111" />
        {' '}<button onClick={addCar}>등록하기</button>
      </div>

      <h3>1. 실시간 차량 보유 현황</h3>
      <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f4f4' }}>
            <th>차량명</th>
            <th>차량번호</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {cars.map(car => (
            <tr key={car.id}>
              <td style={{ padding: '10px' }}>{car.name}</td>
              <td>{car.number}</td>
              <td style={{ color: car.status === '대여가능' ? 'blue' : 'red' }}>{car.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
