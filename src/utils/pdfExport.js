import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MONTHS, formatDateShort, getDayOfWeek, formatTimeRange, getCurrentDateFormatted } from './dateUtils';

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
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format for comparison

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

    // Separate past (worked) and future (booked) shifts
    const workedShifts = userBookings.filter(b => b.date < today);
    const futureShifts = userBookings.filter(b => b.date >= today);

    // Calculate summary stats
    const totalHoursWorked = workedShifts.reduce((sum, b) => {
      const start = parseInt(b.start_time.split(':')[0], 10);
      const end = parseInt(b.end_time.split(':')[0], 10);
      return sum + (end - start);
    }, 0);

    const totalHoursBooked = futureShifts.reduce((sum, b) => {
      const start = parseInt(b.start_time.split(':')[0], 10);
      const end = parseInt(b.end_time.split(':')[0], 10);
      return sum + (end - start);
    }, 0);

    const totalShifts = userBookings.length;

    // User display name
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    // --- PDF Header ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`SHIFT BOOKING REPORT - ${monthName.toUpperCase()} ${year}`, 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${getCurrentDateFormatted()}`, 105, 27, { align: 'center' });

    // --- User Info Section ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Employee: ${userName}`, 20, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Email: ${user.email}`, 20, 46);
    doc.text(`Period: ${monthName} ${year}`, 20, 52);

    // --- Summary Section ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY:', 20, 62);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Total Hours Worked: ${totalHoursWorked}`, 20, 68);
    doc.text(`Total Hours Booked (Future): ${totalHoursBooked}`, 20, 74);
    doc.text(`Total Shifts: ${totalShifts}`, 20, 80);

    let currentY = 88;

    // --- Worked Shifts Table ---
    if (workedShifts.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('WORKED SHIFTS (Past):', 20, currentY);
      currentY += 6;

      const workedData = workedShifts.map(shift => [
        formatDateShort(shift.date),
        getDayOfWeek(shift.date),
        formatTimeRange(shift.start_time, shift.end_time),
        (parseInt(shift.end_time.split(':')[0], 10) - parseInt(shift.start_time.split(':')[0], 10)).toString()
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

    // --- Future Shifts Table ---
    if (futureShifts.length > 0) {
      // Check if we need a new page
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('FUTURE SHIFTS (Booked):', 20, currentY);
      currentY += 6;

      const futureData = futureShifts.map(shift => [
        formatDateShort(shift.date),
        getDayOfWeek(shift.date),
        formatTimeRange(shift.start_time, shift.end_time),
        (parseInt(shift.end_time.split(':')[0], 10) - parseInt(shift.start_time.split(':')[0], 10)).toString()
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Day', 'Time', 'Hours']],
        body: futureData,
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
    }

    // --- Page Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }
  });

  // Save the PDF
  const filename = `PAYE_Shifts_${monthName}_${year}.pdf`;
  doc.save(filename);
}
