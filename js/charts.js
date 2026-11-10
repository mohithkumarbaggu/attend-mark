/**
 * My Attendance Tracker - Custom Canvas Charting Engine
 * High-performance, zero-dependency, retina-ready charts with Apple/Linear aesthetic.
 */

const AttendanceCharts = {
  // Theme color palette
  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      isDark,
      primary: '#8B5CF6',
      primaryLight: 'rgba(139, 92, 246, 0.25)',
      primaryGradientStart: 'rgba(139, 92, 246, 0.4)',
      primaryGradientEnd: 'rgba(139, 92, 246, 0.0)',
      targetLine: '#F59E0B',
      success: '#10B981',
      successLight: 'rgba(16, 185, 129, 0.2)',
      danger: '#EF4444',
      dangerLight: 'rgba(239, 68, 68, 0.2)',
      text: isDark ? '#E2E8F0' : '#334155',
      textMuted: isDark ? '#94A3B8' : '#64748B',
      grid: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
      cardBg: isDark ? '#1E1B2E' : '#FFFFFF',
      tooltipBg: isDark ? '#0F172A' : '#1E293B',
      tooltipText: '#F8FAFC'
    };
  },

  /**
   * Helper to set up crisp retina canvas
   */
  setupCanvas(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Set display size
    const width = rect.width || 300;
    const height = rect.height || 200;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    return { ctx, width, height, dpr };
  },

  /**
   * 1. Weekly Attendance Trends (Bar Chart: Present vs Absent for last 7 active days)
   */
  renderWeeklyChart(canvasId, records) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const setup = this.setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = this.getThemeColors();

    // Extract sorted dates from records
    const dates = Object.keys(records || {})
      .filter((d) => !records[d].isHoliday && records[d].periods?.length > 0)
      .sort()
      .slice(-7); // Last 7 days

    if (dates.length === 0) {
      this.drawEmptyState(ctx, width, height, 'No weekly attendance data yet', colors);
      return;
    }

    const padding = { top: 25, right: 20, bottom: 35, left: 35 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Determine max periods per day
    let maxVal = 6;
    const data = dates.map((d) => {
      const day = records[d];
      let pres = 0;
      let abs = 0;
      if (day && !day.isHoliday && !day.isNoClass) {
        (day.periods || []).forEach((p) => {
          if (p.status === 'present') pres++;
          if (p.status === 'absent') abs++;
        });
      }
      if (pres + abs > maxVal) maxVal = pres + abs;
      // Format short date (e.g. "Mon 10")
      const dateObj = new Date(d + 'T00:00:00');
      const label = dateObj.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
      return { date: d, label, pres, abs, total: pres + abs };
    });

    // Draw horizontal grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxVal / ySteps) * i);
      const y = padding.top + chartH - (i / ySteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
      ctx.fillText(String(val), padding.left - 8, y);
    }

    // Draw stacked or grouped bars
    const groupWidth = chartW / data.length;
    const barWidth = Math.min(24, groupWidth * 0.35);

    data.forEach((item, idx) => {
      const centerX = padding.left + idx * groupWidth + groupWidth / 2;
      const xPres = centerX - barWidth - 2;
      const xAbs = centerX + 2;

      const hPres = (item.pres / maxVal) * chartH;
      const hAbs = (item.abs / maxVal) * chartH;

      const yPres = padding.top + chartH - hPres;
      const yAbs = padding.top + chartH - hAbs;

      // Present bar (Green)
      if (item.pres > 0) {
        this.drawRoundedRect(ctx, xPres, yPres, barWidth, hPres, 4, colors.success);
      }

      // Absent bar (Red)
      if (item.abs > 0) {
        this.drawRoundedRect(ctx, xAbs, yAbs, barWidth, hAbs, 4, colors.danger);
      }

      // Day Label
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, centerX, padding.top + chartH + 10);
    });
  },

  /**
   * 2. Attendance Percentage Progress Over Time (Smooth Line Chart with Gradient)
   */
  renderProgressChart(canvasId, records, targetPercentage = 75, initialA = 0, initialC = 0) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const setup = this.setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = this.getThemeColors();

    const sortedDates = Object.keys(records || {})
      .filter((d) => !records[d].isHoliday && records[d].periods?.length > 0)
      .sort();

    if (sortedDates.length === 0 && initialC === 0) {
      this.drawEmptyState(ctx, width, height, 'Record attendance to see trend line', colors);
      return;
    }

    // Calculate cumulative percentages over time
    let cumA = initialA;
    let cumC = initialC;
    const points = [];

    if (initialC > 0) {
      points.push({
        label: 'Initial',
        pct: Number(((cumA / cumC) * 100).toFixed(1))
      });
    }

    sortedDates.forEach((d) => {
      const day = records[d];
      let pCount = 0;
      let aCount = 0;
      if (day && !day.isHoliday && !day.isNoClass) {
        (day.periods || []).forEach((p) => {
          if (p.status === 'present') pCount++;
          if (p.status === 'absent') aCount++;
        });
      }
      cumA += pCount;
      cumC += (pCount + aCount);
      if (cumC > 0) {
        const pct = Number(((cumA / cumC) * 100).toFixed(1));
        const dateObj = new Date(d + 'T00:00:00');
        const label = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        points.push({ label, pct, date: d });
      }
    });

    // Sample down to at most 14 points for readability
    let displayPoints = points;
    if (points.length > 14) {
      const step = Math.ceil(points.length / 14);
      displayPoints = points.filter((_, idx) => idx % step === 0 || idx === points.length - 1);
    }

    const padding = { top: 20, right: 30, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const minY = 50;
    const maxY = 100;

    // Draw Grid & Y Labels
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yMarks = [50, 60, 70, 80, 90, 100];
    yMarks.forEach((val) => {
      const y = padding.top + chartH - ((val - minY) / (maxY - minY)) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
      ctx.fillText(`${val}%`, padding.left - 8, y);
    });

    // Draw Target Line (dotted Amber)
    if (targetPercentage >= minY && targetPercentage <= maxY) {
      const targetY = padding.top + chartH - ((targetPercentage - minY) / (maxY - minY)) * chartH;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = colors.targetLine;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding.left, targetY);
      ctx.lineTo(padding.left + chartW, targetY);
      ctx.stroke();

      ctx.fillStyle = colors.targetLine;
      ctx.textAlign = 'left';
      ctx.fillText(`Target ${targetPercentage}%`, padding.left + chartW - 65, targetY - 8);
      ctx.restore();
    }

    if (displayPoints.length === 1) {
      // Just single point
      const x = padding.left + chartW / 2;
      const y = padding.top + chartH - ((displayPoints[0].pct - minY) / (maxY - minY)) * chartH;
      ctx.fillStyle = colors.primary;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Map point coordinates
    const coords = displayPoints.map((pt, idx) => {
      const x = padding.left + (idx / (displayPoints.length - 1)) * chartW;
      const y = padding.top + chartH - ((pt.pct - minY) / (maxY - minY)) * chartH;
      return { x, y, pt };
    });

    // Create Gradient Fill below line
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    grad.addColorStop(0, colors.primaryGradientStart);
    grad.addColorStop(1, colors.primaryGradientEnd);

    // Draw smooth curve area
    ctx.beginPath();
    ctx.moveTo(coords[0].x, padding.top + chartH);
    ctx.lineTo(coords[0].x, coords[0].y);

    for (let i = 0; i < coords.length - 1; i++) {
      const xc = (coords[i].x + coords[i + 1].x) / 2;
      const yc = (coords[i].y + coords[i + 1].y) / 2;
      ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
    }
    ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
    ctx.lineTo(coords[coords.length - 1].x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw smooth line
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 0; i < coords.length - 1; i++) {
      const xc = (coords[i].x + coords[i + 1].x) / 2;
      const yc = (coords[i].y + coords[i + 1].y) / 2;
      ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
    }
    ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw point dots & X Labels
    coords.forEach((c, idx) => {
      // Circle dot
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = colors.cardBg;
      ctx.fill();
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Label (show first, middle, last or spaced)
      if (idx === 0 || idx === coords.length - 1 || idx === Math.floor(coords.length / 2)) {
        ctx.fillStyle = colors.textMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(c.pt.label, c.x, padding.top + chartH + 10);
      }
    });
  },

  /**
   * 3. Present vs Absent Periods Breakdown (Doughnut Chart)
   */
  renderDonutChart(canvasId, totalAttended, totalMissed) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const setup = this.setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = this.getThemeColors();

    const total = totalAttended + totalMissed;
    if (total === 0) {
      this.drawEmptyState(ctx, width, height, 'No period data yet', colors);
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(centerX, centerY) - 16;
    const innerRadius = outerRadius * 0.68;

    const presentAngle = (totalAttended / total) * (Math.PI * 2);
    const absentAngle = (totalMissed / total) * (Math.PI * 2);

    // Draw Present Arc (Green)
    let startAngle = -Math.PI / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + presentAngle, false);
    ctx.arc(centerX, centerY, innerRadius, startAngle + presentAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors.success;
    ctx.fill();

    // Draw Absent Arc (Red)
    startAngle += presentAngle;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + absentAngle, false);
    ctx.arc(centerX, centerY, innerRadius, startAngle + absentAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors.danger;
    ctx.fill();

    // Center text
    const percentage = ((totalAttended / total) * 100).toFixed(1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`${percentage}%`, centerX, centerY - 6);

    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.fillText('Attendance', centerX, centerY + 14);
  },

  /**
   * 4. Monthly Attendance Trends (Bar Chart by Month)
   */
  renderMonthlyChart(canvasId, records) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const setup = this.setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = this.getThemeColors();

    // Aggregate by YYYY-MM
    const monthlyData = {};
    Object.keys(records || {}).forEach((d) => {
      const day = records[d];
      if (day.isHoliday) return;
      const monthKey = d.substring(0, 7); // '2026-11'
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { attended: 0, conducted: 0 };
      }
      (day.periods || []).forEach((p) => {
        if (p.status === 'present') {
          monthlyData[monthKey].attended++;
          monthlyData[monthKey].conducted++;
        } else if (p.status === 'absent') {
          monthlyData[monthKey].conducted++;
        }
      });
    });

    const months = Object.keys(monthlyData).sort().slice(-6);
    if (months.length === 0) {
      this.drawEmptyState(ctx, width, height, 'No monthly trends yet', colors);
      return;
    }

    const padding = { top: 25, right: 20, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Y Axis: 0 to 100%
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    [0, 25, 50, 75, 100].forEach((pct) => {
      const y = padding.top + chartH - (pct / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
      ctx.fillText(`${pct}%`, padding.left - 8, y);
    });

    const barW = Math.min(36, (chartW / months.length) * 0.5);
    const colStep = chartW / months.length;

    months.forEach((m, idx) => {
      const data = monthlyData[m];
      const pct = data.conducted > 0 ? (data.attended / data.conducted) * 100 : 0;
      const barH = (pct / 100) * chartH;
      const x = padding.left + idx * colStep + (colStep - barW) / 2;
      const y = padding.top + chartH - barH;

      // Color bar purple
      this.drawRoundedRect(ctx, x, y, barW, barH, 4, pct >= 75 ? colors.primary : colors.danger);

      // Month text
      const [year, month] = m.split('-');
      const dObj = new Date(Number(year), Number(month) - 1, 1);
      const mLabel = dObj.toLocaleDateString(undefined, { month: 'short' });

      ctx.fillStyle = colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(mLabel, x + barW / 2, padding.top + chartH + 10);

      // Percentage on top of bar
      ctx.fillStyle = colors.text;
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${Math.round(pct)}%`, x + barW / 2, y - 4);
    });
  },

  /**
   * 5. Day of Week Breakdown (Monday - Saturday)
   */
  renderDayOfWeekChart(canvasId, records) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const setup = this.setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = this.getThemeColors();

    const days = [
      { name: 'Mon', index: 1, attended: 0, conducted: 0 },
      { name: 'Tue', index: 2, attended: 0, conducted: 0 },
      { name: 'Wed', index: 3, attended: 0, conducted: 0 },
      { name: 'Thu', index: 4, attended: 0, conducted: 0 },
      { name: 'Fri', index: 5, attended: 0, conducted: 0 },
      { name: 'Sat', index: 6, attended: 0, conducted: 0 }
    ];

    Object.keys(records || {}).forEach((d) => {
      const day = records[d];
      if (day.isHoliday) return;
      const dateObj = new Date(d + 'T00:00:00');
      const dayIdx = dateObj.getDay();
      const match = days.find((x) => x.index === dayIdx);
      if (match) {
        (day.periods || []).forEach((p) => {
          if (p.status === 'present') {
            match.attended++;
            match.conducted++;
          } else if (p.status === 'absent') {
            match.conducted++;
          }
        });
      }
    });

    const padding = { top: 25, right: 20, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = colors.textMuted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    [0, 25, 50, 75, 100].forEach((pct) => {
      const y = padding.top + chartH - (pct / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
      ctx.fillText(`${pct}%`, padding.left - 8, y);
    });

    const barW = Math.min(28, (chartW / days.length) * 0.45);
    const colStep = chartW / days.length;

    days.forEach((day, idx) => {
      const pct = day.conducted > 0 ? (day.attended / day.conducted) * 100 : 0;
      const barH = (pct / 100) * chartH;
      const x = padding.left + idx * colStep + (colStep - barW) / 2;
      const y = padding.top + chartH - barH;

      this.drawRoundedRect(ctx, x, y, barW, barH, 4, pct >= 75 ? colors.primary : colors.primaryLight);

      ctx.fillStyle = colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(day.name, x + barW / 2, padding.top + chartH + 10);
    });
  },

  /**
   * Helper: Draw rounded rectangle
   */
  drawRoundedRect(ctx, x, y, width, height, radius = 4, fillStyle = '#8B5CF6') {
    if (height <= 0) return;
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  },

  /**
   * Helper: Draw empty state placeholder
   */
  drawEmptyState(ctx, width, height, text, colors) {
    ctx.fillStyle = colors.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(text, width / 2, height / 2);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AttendanceCharts;
}
if (typeof window !== 'undefined') {
  window.AttendanceCharts = AttendanceCharts;
}

