/**
 * My Attendance Tracker - Export Engine
 * Generates CSV spreadsheets and formatted printable PDF reports.
 */

const AttendanceExport = {
  /**
   * Export all attendance history as a clean CSV file
   */
  exportToCSV(records = {}, settings = {}, stats = {}) {
    const dates = Object.keys(records).sort().reverse();
    if (dates.length === 0 && (!stats.initialConducted || stats.initialConducted === 0)) {
      alert('No attendance data available to export.');
      return;
    }

    const rows = [
      ['MY ATTENDANCE TRACKER - ATTENDANCE REPORT'],
      [`Student Name: ${settings.studentName || 'N/A'}`],
      [`College: ${settings.collegeName || 'N/A'}`],
      [`Branch: ${settings.branch || 'N/A'}`, `Semester: ${settings.semester || 'N/A'}`],
      [`Export Date: ${new Date().toLocaleDateString()}`],
      [`Overall Attendance: ${stats.currentPercentage || 0}%`, `Target: ${settings.targetPercentage || 75}%`],
      [],
      [
        'Date',
        'Day of Week',
        'Status',
        'Conducted Periods',
        'Attended Periods',
        'Missed Periods',
        'Daily Percentage (%)',
        'Period Details (P/A)',
        'Notes / Reason'
      ]
    ];

    dates.forEach((d) => {
      const day = records[d];
      const dateObj = new Date(d + 'T00:00:00');
      const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'long' });

      if (day.isHoliday) {
        rows.push([
          d,
          dayName,
          'Holiday / No Class',
          0,
          0,
          0,
          '0.0%',
          'None',
          `"${(day.holidayReason || 'Holiday').replace(/"/g, '""')}"`
        ]);
        return;
      }

      let pres = 0;
      let abs = 0;
      const periodStrs = [];

      (day.periods || []).forEach((p) => {
        if (p.status === 'present') {
          pres++;
          periodStrs.push(`P${p.periodNumber}:Present`);
        } else if (p.status === 'absent') {
          abs++;
          periodStrs.push(`P${p.periodNumber}:Absent`);
        }
      });

      const conducted = pres + abs;
      const pct = conducted > 0 ? ((pres / conducted) * 100).toFixed(1) + '%' : '0.0%';
      let statusStr = 'Partial Attendance';
      if (conducted === 0) statusStr = 'No Classes';
      else if (abs === 0) statusStr = 'Full Attendance';
      else if (pres === 0) statusStr = 'Full Absence';

      rows.push([
        d,
        dayName,
        statusStr,
        conducted,
        pres,
        abs,
        pct,
        `"${periodStrs.join(', ')}"`,
        `"${(day.note || '').replace(/"/g, '""')}"`
      ]);
    });

    // Summary row
    rows.push([]);
    rows.push(['SUMMARY TOTALS']);
    rows.push(['Initial Baseline Conducted', stats.initialConducted || 0]);
    rows.push(['Initial Baseline Attended', stats.initialAttended || 0]);
    rows.push(['Recorded Conducted Periods', stats.recordedConducted || 0]);
    rows.push(['Recorded Attended Periods', stats.recordedAttended || 0]);
    rows.push(['Total Conducted Periods', stats.totalConducted || 0]);
    rows.push(['Total Attended Periods', stats.totalAttended || 0]);
    rows.push(['Total Missed Periods', stats.totalMissed || 0]);
    rows.push(['Overall Attendance Percentage', `${stats.currentPercentage || 0}%`]);

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return '';
            const str = String(cell);
            if (str.includes(',') && !str.startsWith('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeStudentName = (settings.studentName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${safeStudentName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Print / PDF Export formatted report
   * Uses browser print layout styled via @media print for pixel-perfect PDF saving.
   */
  printReport(records = {}, settings = {}, stats = {}) {
    window.print();
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AttendanceExport;
}
if (typeof window !== 'undefined') {
  window.AttendanceExport = AttendanceExport;
}

