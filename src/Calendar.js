import React from 'react';

const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const Calendar = ({ year, month, renderDay }) => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const weeks = [];
  let days = [];

  // Fill initial empty days
  for (let i = 0; i < firstDay; i++) {
    days.push(<td key={`empty-${i}`}></td>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(
      <td key={day}>{renderDay(day)}</td>
    );
    if ((days.length) % 7 === 0 || day === daysInMonth) {
      weeks.push(<tr key={day}>{days}</tr>);
      days = [];
    }
  }

  return (
    <table className="calendar">
      <thead>
        <tr>
          <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
        </tr>
      </thead>
      <tbody>{weeks}</tbody>
    </table>
  );
};

export default Calendar;
