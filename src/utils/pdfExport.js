import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MONTHS, formatDateShort, getDayOfWeek, formatTimeRange, getCurrentDateFormatted } from './dateUtils';
import logoImg from '../assets/landscape.png';

/**
 * Generate a PDF export of all users' shift data for a specific month
 * @param {Array} users - Array of user objects with id, email, firstName, lastName
 * @param {Array} bookings - Array of booking objects with user_id, date, start_time, end_time, status
 * @param {number} month - Month index (0-11)
 * @param {number} year - Year (e.g., 2026)
 */
export function generateMonthlyPayePDF(users, bookings, month, year) {
  const doc = new jsPDF();
  const monthName = MONTHS[month];
  const now = new Date();

  // Filter to only booked shifts (exclude cancelled)
  const bookedShifts = bookings.filter(b => b.status === 'booked');

  let isFirstPage = true;

  users.forEach((user) => {
    // Add page break between users (except for first user)
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    // Get this user's bookings
    const userBookings = bookedShifts.filter(b => b.user_id === user.id);

    // Sort bookings by date and time
    userBookings.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

    // Only worked (past) shifts
    const workedShifts = userBookings.filter(b => new Date(`${b.date}T${b.end_time}`) <= now);

    // Calculate summary stats (in hours)
    const timeToHours = (t) => { const [h, m] = t.split(':').map(Number); return h + m / 60; };
    const shiftHours = (b) => { const s = timeToHours(b.start_time); const e = timeToHours(b.end_time); return e > s ? e - s : 24 - s + e; };
    const totalHoursWorked = workedShifts.reduce((sum, b) => sum + shiftHours(b), 0);

    // User display name
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    // --- PDF Header: black banner with logo ---
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 28, 'F');
    doc.addImage(logoImg, 'PNG', 70, 1, 70, 26);

    // --- Report title ---
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`SHIFT REPORT - ${monthName.toUpperCase()} ${year}`, 105, 36, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${getCurrentDateFormatted()}`, 105, 42, { align: 'center' });

    // --- User Info Section ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Employee: ${userName}`, 20, 54);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Email: ${user.email}`, 20, 60);
    doc.text(`Period: ${monthName} ${year}`, 20, 66);

    // --- Summary Section ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY:', 20, 76);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Total Hours Worked: ${+totalHoursWorked.toFixed(1)}h`, 20, 82);

    let currentY = 95;

    // --- Worked Shifts Table ---
    if (workedShifts.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('WORKED SHIFTS:', 20, currentY);
      currentY += 6;

      const workedData = workedShifts.map(shift => [
        formatDateShort(shift.date),
        getDayOfWeek(shift.date),
        formatTimeRange(shift.start_time, shift.end_time),
        (+shiftHours(shift).toFixed(1)) + 'h'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Day', 'Time', 'Hours']],
        body: workedData,
        theme: 'grid',
        headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold' },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { halign: 'left' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' }
        }
      });

      currentY = doc.lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('No worked shifts for this period', 20, currentY);
      currentY += 10;
    }

  });

  // --- Page Footers (done after all pages exist so total count is correct) ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
  }

  // Save the PDF
  const filename = `PAYE_Shifts_${monthName}_${year}.pdf`;
  doc.save(filename);
}

export function generateMonthlyFullPDF(users, bookings, month, year) {
  const doc = new jsPDF();
  const monthName = MONTHS[month];
  const now = new Date();

  const bookedShifts = bookings.filter(b => b.status === 'booked');

  let isFirstPage = true;

  users.forEach((user) => {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;

    const userBookings = bookedShifts.filter(b => b.user_id === user.id);
    userBookings.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

    const timeToHours = (t) => { const [h, m] = t.split(':').map(Number); return h + m / 60; };
    const shiftHours = (b) => { const s = timeToHours(b.start_time); const e = timeToHours(b.end_time); return e > s ? e - s : 24 - s + e; };

    const workedShifts = userBookings.filter(b => new Date(`${b.date}T${b.end_time}`) <= now);
    const upcomingShifts = userBookings.filter(b => new Date(`${b.date}T${b.end_time}`) > now);

    const totalHoursWorked = workedShifts.reduce((sum, b) => sum + shiftHours(b), 0);
    const totalHoursBooked = upcomingShifts.reduce((sum, b) => sum + shiftHours(b), 0);

    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 28, 'F');
    doc.addImage(logoImg, 'PNG', 70, 1, 70, 26);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`SHIFT REPORT - ${monthName.toUpperCase()} ${year}`, 105, 36, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${getCurrentDateFormatted()}`, 105, 42, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Employee: ${userName}`, 20, 54);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Email: ${user.email}`, 20, 60);
    doc.text(`Period: ${monthName} ${year}`, 20, 66);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY:', 20, 76);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Total Hours Worked: ${+totalHoursWorked.toFixed(1)}h`, 20, 82);
    doc.text(`Total Hours Booked: ${+totalHoursBooked.toFixed(1)}h`, 20, 88);

    let currentY = 100;

    if (workedShifts.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('WORKED SHIFTS:', 20, currentY);
      currentY += 6;

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Day', 'Time', 'Hours']],
        body: workedShifts.map(shift => [
          formatDateShort(shift.date),
          getDayOfWeek(shift.date),
          formatTimeRange(shift.start_time, shift.end_time),
          (+shiftHours(shift).toFixed(1)) + 'h'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold' },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } }
      });

      currentY = doc.lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('No worked shifts for this period', 20, currentY);
      currentY += 10;
    }

    if (upcomingShifts.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('UPCOMING SHIFTS:', 20, currentY);
      currentY += 6;

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Day', 'Time', 'Hours']],
        body: upcomingShifts.map(shift => [
          formatDateShort(shift.date),
          getDayOfWeek(shift.date),
          formatTimeRange(shift.start_time, shift.end_time),
          (+shiftHours(shift).toFixed(1)) + 'h'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [60, 100, 160], textColor: 255, fontStyle: 'bold' },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } }
      });
    }
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
  }

  const filename = `Full_Shifts_${monthName}_${year}.pdf`;
  doc.save(filename);
}
