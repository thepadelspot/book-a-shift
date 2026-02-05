import React from 'react';

const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};



const Calendar = ({ year, month, renderDay, darkMode }) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const isMobile = window.innerWidth <= 700;
  const columns = isMobile ? 3 : 7;
  const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weeks = [];
  let days = [];
  let isFirstRow = true;
  const initialEmpty = isMobile ? (firstDay % columns) : firstDay;
  for (let dayNum = 1, cellNum = 0; dayNum <= daysInMonth; ) {
    // For the first row, add initial empty tds
    if (isFirstRow) {
      for (let i = 0; i < initialEmpty; i++, cellNum++) {
        days.push(<td key={`empty-${i}`}></td>);
      }
      isFirstRow = false;
    }
    // Fill the rest of the row with days
    while (days.length < columns && dayNum <= daysInMonth) {
      // On mobile, show the day of week label above the date
      let content = renderDay(dayNum);
      if (isMobile) {
        const weekDayIdx = (cellNum) % 7;
        content = (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
            <span style={{fontSize:'0.95em',fontWeight:600,marginBottom:2,color:'#007bff'}}>{weekLabels[weekDayIdx]}</span>
            {content}
          </div>
        );
      }
      days.push(<td key={dayNum}>{content}</td>);
      dayNum++;
      cellNum++;
    }
    // If this is the last row and not full, fill with empty tds
    if (dayNum > daysInMonth && days.length > 0 && days.length < columns) {
      for (let i = days.length; i < columns; i++) {
        days.push(<td key={`end-empty-${i}`}></td>);
      }
    }
    // Push the row if it has any cells
    if (days.length > 0) {
      weeks.push(<tr key={`row-${dayNum}`}>{days}</tr>);
      days = [];
    }
  }
  return (
    <table className={`calendar${darkMode ? ' dark-mode' : ''}`}>
      <thead>
        <tr>
          {weekLabels.slice(0, columns).map(label => <th key={label}>{label}</th>)}
        </tr>
      </thead>
      <tbody>{weeks}</tbody>
    </table>
  );
};

export default Calendar;
