/**
 * My Attendance Tracker - Calculation Engine
 * Pure mathematical functions for attendance analytics and targets.
 */

const AttendanceCalculator = {
  /**
   * Calculate standard period-based attendance (Method A)
   * @param {Object} records - Map of date (YYYY-MM-DD) to DayRecord
   * @param {Object} settings - Configuration settings
   * @returns {Object} Comprehensive statistics
   */
  calculateStats(records = {}, settings = {}) {
    const initialAttended = Number(settings.initialAttendedPeriods) || 0;
    const initialConducted = Number(settings.initialConductedPeriods) || 0;
    const targetPercentage = Number(settings.targetPercentage) || 75;
    const periodsPerDay = Number(settings.periodsPerDay) || 6;

    let recordedAttended = 0;
    let recordedConducted = 0;
    let fullPresentDays = 0;
    let fullAbsentDays = 0;
    let partialDays = 0;
    let totalWorkingDays = 0;
    let holidayDays = 0;

    // Monthly stats tracking (current month)
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let monthAttended = 0;
    let monthConducted = 0;

    // Subject-wise stats tracking
    const subjectStatsMap = {};

    // Iterate through all records
    Object.keys(records).forEach((dateKey) => {
      const day = records[dateKey];
      if (!day) return;

      if (day.isHoliday) {
        holidayDays++;
        return; // Holidays do not contribute to conducted or attended
      }
      if (day.isNoClass) {
        return; // Entire day marked as No Class / Cancelled
      }

      const periods = day.periods || [];
      let dayPresent = 0;
      let dayAbsent = 0;

      periods.forEach((p) => {
        const subj = (p.subject || `Period ${p.periodNumber}`).trim();
        if (!subjectStatsMap[subj]) {
          subjectStatsMap[subj] = { attended: 0, conducted: 0, missed: 0, noClass: 0 };
        }

        if (p.status === 'present') {
          dayPresent++;
          subjectStatsMap[subj].attended++;
          subjectStatsMap[subj].conducted++;
        } else if (p.status === 'absent') {
          dayAbsent++;
          subjectStatsMap[subj].conducted++;
          subjectStatsMap[subj].missed++;
        } else if (p.status === 'no_class' || p.status === 'cancelled') {
          subjectStatsMap[subj].noClass = (subjectStatsMap[subj].noClass || 0) + 1;
        }
        // 'cancelled' or 'no_class' does not count towards conducted
      });

      const dayConducted = dayPresent + dayAbsent;

      if (dayConducted > 0) {
        totalWorkingDays++;
        recordedAttended += dayPresent;
        recordedConducted += dayConducted;

        if (dayAbsent === 0 && dayPresent > 0) {
          fullPresentDays++;
        } else if (dayPresent === 0 && dayAbsent > 0) {
          fullAbsentDays++;
        } else if (dayPresent > 0 && dayAbsent > 0) {
          partialDays++;
        }

        // Check if date belongs to current month
        if (dateKey.startsWith(currentMonthPrefix)) {
          monthAttended += dayPresent;
          monthConducted += dayConducted;
        }
      }
    });

    const totalAttended = initialAttended + recordedAttended;
    const totalConducted = initialConducted + recordedConducted;
    const totalMissed = Math.max(0, totalConducted - totalAttended);

    // Percentage calculation with 2 decimal places
    let currentPercentage = 0;
    if (totalConducted > 0) {
      currentPercentage = (totalAttended / totalConducted) * 100;
    }

    // Monthly percentage
    let currentMonthPercentage = 0;
    if (monthConducted > 0) {
      currentMonthPercentage = (monthAttended / monthConducted) * 100;
    } else {
      currentMonthPercentage = currentPercentage;
    }

    // Target Calculator calculations
    const targetAnalysis = this.calculateTargetMetrics(
      totalAttended,
      totalConducted,
      targetPercentage,
      periodsPerDay
    );

    // Method B: Custom daily percentage adjustment
    const methodBStats = this.calculateMethodB(
      records,
      settings,
      fullPresentDays,
      fullAbsentDays
    );

    // Format Subject-wise stats
    const subjectStats = Object.keys(subjectStatsMap).map((subj) => {
      const item = subjectStatsMap[subj];
      const pct = item.conducted > 0 ? Number(((item.attended / item.conducted) * 100).toFixed(1)) : 0;
      return {
        subject: subj,
        attended: item.attended,
        conducted: item.conducted,
        missed: item.missed,
        percentage: pct,
        status: pct >= targetPercentage ? 'safe' : pct >= targetPercentage - 5 ? 'on_track' : 'critical'
      };
    }).sort((a, b) => b.conducted - a.conducted);

    // Calculate current attendance streak (consecutive working days with 0 absences)
    let attendanceStreak = 0;
    const sortedDatesDesc = Object.keys(records)
      .filter((d) => {
        const rec = records[d];
        if (!rec || rec.isHoliday || rec.isNoClass) return false;
        const periods = rec.periods || [];
        const conducted = periods.filter((p) => p.status === 'present' || p.status === 'absent').length;
        return conducted > 0;
      })
      .sort()
      .reverse();

    for (const d of sortedDatesDesc) {
      const day = records[d];
      const hasAbsent = (day.periods || []).some((p) => p.status === 'absent');
      const hasPresent = (day.periods || []).some((p) => p.status === 'present');
      if (hasPresent && !hasAbsent) {
        attendanceStreak++;
      } else {
        break;
      }
    }

    return {
      totalAttended,
      totalConducted,
      totalMissed,
      currentPercentage: Number(currentPercentage.toFixed(2)),
      currentMonthPercentage: Number(currentMonthPercentage.toFixed(2)),
      totalWorkingDays,
      fullPresentDays,
      fullAbsentDays,
      partialDays,
      holidayDays,
      targetPercentage,
      targetAnalysis,
      methodB: methodBStats,
      subjectStats,
      attendanceStreak,
      recordedAttended,
      recordedConducted,
      initialAttended,
      initialConducted
    };
  },

  /**
   * Calculate Target Requirements (Consecutive periods to attend or can miss)
   */
  calculateTargetMetrics(attended, conducted, targetPercent, periodsPerDay = 6) {
    const T = Number(targetPercent);
    const A = Number(attended);
    const C = Number(conducted);
    const P = C > 0 ? (A / C) * 100 : 0;

    let periodsToAttend = 0;
    let daysToAttend = 0;
    let periodsCanMiss = 0;
    let daysCanMiss = 0;
    let status = 'on_track'; // 'safe', 'on_track', 'at_risk', 'critical'

    if (P >= T) {
      status = P >= T + 5 ? 'safe' : 'on_track';
      // How many periods can miss while maintaining >= T
      // Formula: floor((100*A - T*C) / T)
      if (T > 0) {
        const canMiss = Math.floor((100 * A - T * C) / T);
        periodsCanMiss = Math.max(0, canMiss);
        daysCanMiss = Math.floor(periodsCanMiss / periodsPerDay);
      } else {
        periodsCanMiss = Infinity;
        daysCanMiss = Infinity;
      }
      periodsToAttend = 0;
      daysToAttend = 0;
    } else {
      status = P >= T - 5 ? 'at_risk' : 'critical';
      // How many consecutive periods needed to reach T
      // Formula: ceil((T*C - 100*A) / (100 - T))
      if (T < 100) {
        const needed = Math.ceil((T * C - 100 * A) / (100 - T));
        periodsToAttend = Math.max(0, needed);
        daysToAttend = Math.ceil(periodsToAttend / periodsPerDay);
      } else {
        // Impossible if any missed period exists
        periodsToAttend = C > A ? Infinity : 0;
        daysToAttend = Infinity;
      }
      periodsCanMiss = 0;
      daysCanMiss = 0;
    }

    return {
      currentPercentage: Number(P.toFixed(2)),
      targetPercentage: T,
      isTargetMet: P >= T,
      periodsToAttend,
      daysToAttend,
      periodsCanMiss,
      daysCanMiss,
      status,
      // Helper simulation: next N attended or missed
      simulateAttend: (count) => {
        const newA = A + count;
        const newC = C + count;
        return Number(((newA / newC) * 100).toFixed(2));
      },
      simulateMiss: (count) => {
        const newA = A;
        const newC = C + count;
        return Number(((newA / newC) * 100).toFixed(2));
      }
    };
  },

  /**
   * Method B: Custom daily percentage adjustment tracker
   * Rule: Full day = +0.5%, Entire day absent = -3.0%
   */
  calculateMethodB(records, settings, fullPresentDays, fullAbsentDays) {
    const isEnabled = Boolean(settings.enableMethodB);
    const startingPercentage = Number(settings.methodBStartingPercentage ?? 75.0);

    const fullDayBonus = fullPresentDays * 0.5;
    const fullAbsentPenalty = fullAbsentDays * 3.0;
    const netAdjustment = fullDayBonus - fullAbsentPenalty;

    const rawPercentage = startingPercentage + netAdjustment;
    const clampedPercentage = Math.min(100, Math.max(0, rawPercentage));

    return {
      isEnabled,
      startingPercentage,
      fullPresentDays,
      fullAbsentDays,
      fullDayBonus: Number(fullDayBonus.toFixed(2)),
      fullAbsentPenalty: Number(fullAbsentPenalty.toFixed(2)),
      netAdjustment: Number(netAdjustment.toFixed(2)),
      calculatedPercentage: Number(clampedPercentage.toFixed(2))
    };
  },

  /**
   * Calculate single day summary
   */
  getDaySummary(dayRecord) {
    if (!dayRecord) {
      return { status: 'unmarked', present: 0, absent: 0, noClass: 0, total: 0, percentage: 0 };
    }
    if (dayRecord.isHoliday) {
      return { status: 'holiday', present: 0, absent: 0, noClass: 0, total: 0, percentage: 0, reason: dayRecord.holidayReason || 'Holiday' };
    }
    if (dayRecord.isNoClass) {
      return { status: 'no_class', present: 0, absent: 0, noClass: (dayRecord.periods || []).length, total: 0, percentage: 0, reason: dayRecord.note || 'No Classes Held' };
    }

    const periods = dayRecord.periods || [];
    let present = 0;
    let absent = 0;
    let noClass = 0;

    periods.forEach((p) => {
      if (p.status === 'present') present++;
      else if (p.status === 'absent') absent++;
      else if (p.status === 'no_class' || p.status === 'cancelled') noClass++;
    });

    const total = present + absent;
    const percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;

    let status = 'empty';
    if (total > 0) {
      if (absent === 0) status = 'full_present';
      else if (present === 0) status = 'full_absent';
      else status = 'partial';
    } else if (noClass > 0) {
      status = 'no_class';
    }

    return {
      status,
      present,
      absent,
      noClass,
      total,
      percentage
    };
  }
};

// Export for module environments if present, otherwise attach to window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AttendanceCalculator;
}
if (typeof window !== 'undefined') {
  window.AttendanceCalculator = AttendanceCalculator;
}

