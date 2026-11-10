const AttendanceCalculator = require('../js/calculator.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('--- Testing Attendance Calculations & Scenarios ---');

// Scenario 1: 100 conducted periods, 85 attended periods. Expected attendance = 85%
const s1 = AttendanceCalculator.calculateStats({}, {
  initialConductedPeriods: 100,
  initialAttendedPeriods: 85,
  targetPercentage: 75
});
assert(s1.currentPercentage === 85.00, `Scenario 1: Expected 85%, got ${s1.currentPercentage}%`);
assert(s1.totalAttended === 85, `Scenario 1 Attended: 85`);
assert(s1.totalConducted === 100, `Scenario 1 Conducted: 100`);

// Scenario 2: Attend one additional period. Expected attendance = 86/101 * 100 = 85.15%
const s2Records = {
  '2026-11-10': {
    isHoliday: false,
    periods: [{ periodNumber: 1, status: 'present' }]
  }
};
const s2 = AttendanceCalculator.calculateStats(s2Records, {
  initialConductedPeriods: 100,
  initialAttendedPeriods: 85
});
assert(s2.totalAttended === 86, `Scenario 2 Attended: Expected 86, got ${s2.totalAttended}`);
assert(s2.totalConducted === 101, `Scenario 2 Conducted: Expected 101, got ${s2.totalConducted}`);
assert(s2.currentPercentage === 85.15, `Scenario 2 Percentage: Expected 85.15%, got ${s2.currentPercentage}%`);

// Scenario 3: Miss one additional period. Expected attendance = 85/102 * 100 = 83.33%
const s3Records = {
  '2026-11-10': {
    isHoliday: false,
    periods: [{ periodNumber: 1, status: 'present' }]
  },
  '2026-11-11': {
    isHoliday: false,
    periods: [{ periodNumber: 1, status: 'absent' }]
  }
};
const s3 = AttendanceCalculator.calculateStats(s3Records, {
  initialConductedPeriods: 100,
  initialAttendedPeriods: 85
});
assert(s3.totalAttended === 86, `Scenario 3 Attended: Expected 86, got ${s3.totalAttended}`);
assert(s3.totalConducted === 102, `Scenario 3 Conducted: Expected 102, got ${s3.totalConducted}`);
// Wait, prompt Scenario 3: "Miss one additional period. Expected attendance = 85/102 * 100 = 83.33%." (starting from 85/100, miss 2 periods or from 85/101 miss 1):
// If starting with 85/100 and missing 2 periods (or 85/102):
const s3DirectRecords = {
  '2026-11-10': {
    isHoliday: false,
    periods: [
      { periodNumber: 1, status: 'absent' },
      { periodNumber: 2, status: 'absent' }
    ]
  }
};
const s3Direct = AttendanceCalculator.calculateStats(s3DirectRecords, {
  initialConductedPeriods: 100,
  initialAttendedPeriods: 85
});
assert(s3Direct.totalAttended === 85, `Scenario 3 Direct Attended: Expected 85, got ${s3Direct.totalAttended}`);
assert(s3Direct.totalConducted === 102, `Scenario 3 Direct Conducted: Expected 102, got ${s3Direct.totalConducted}`);
assert(s3Direct.currentPercentage === 83.33, `Scenario 3 Direct: Expected 83.33%, got ${s3Direct.currentPercentage}%`);

// Scenario 4: Full day with 6 periods, all Present. All 6 periods must be recorded correctly.
const s4Records = {
  '2026-11-10': {
    isHoliday: false,
    periods: [
      { periodNumber: 1, status: 'present' },
      { periodNumber: 2, status: 'present' },
      { periodNumber: 3, status: 'present' },
      { periodNumber: 4, status: 'present' },
      { periodNumber: 5, status: 'present' },
      { periodNumber: 6, status: 'present' }
    ]
  }
};
const s4 = AttendanceCalculator.calculateStats(s4Records, { initialConductedPeriods: 0, initialAttendedPeriods: 0 });
assert(s4.recordedAttended === 6, `Scenario 4 Recorded Attended: Expected 6, got ${s4.recordedAttended}`);
assert(s4.recordedConducted === 6, `Scenario 4 Recorded Conducted: Expected 6, got ${s4.recordedConducted}`);
assert(s4.fullPresentDays === 1, `Scenario 4 Full Present Days: Expected 1, got ${s4.fullPresentDays}`);
assert(s4.currentPercentage === 100.00, `Scenario 4 Percentage: Expected 100%, got ${s4.currentPercentage}%`);

// Scenario 5: Entire day absent. All 6 conducted periods must be recorded as Absent.
const s5Records = {
  '2026-11-10': {
    isHoliday: false,
    periods: [
      { periodNumber: 1, status: 'absent' },
      { periodNumber: 2, status: 'absent' },
      { periodNumber: 3, status: 'absent' },
      { periodNumber: 4, status: 'absent' },
      { periodNumber: 5, status: 'absent' },
      { periodNumber: 6, status: 'absent' }
    ]
  }
};
const s5 = AttendanceCalculator.calculateStats(s5Records, { initialConductedPeriods: 0, initialAttendedPeriods: 0 });
assert(s5.recordedAttended === 0, `Scenario 5 Attended: Expected 0, got ${s5.recordedAttended}`);
assert(s5.recordedConducted === 6, `Scenario 5 Conducted: Expected 6, got ${s5.recordedConducted}`);
assert(s5.fullAbsentDays === 1, `Scenario 5 Full Absent Days: Expected 1, got ${s5.fullAbsentDays}`);
assert(s5.currentPercentage === 0.00, `Scenario 5 Percentage: Expected 0%, got ${s5.currentPercentage}%`);

// Scenario 6: Holiday. No periods should be added to the conducted-period count.
const s6Records = {
  '2026-11-10': {
    isHoliday: true,
    holidayReason: 'National Holiday',
    periods: [
      { periodNumber: 1, status: 'present' } // should be ignored because holiday
    ]
  }
};
const s6 = AttendanceCalculator.calculateStats(s6Records, { initialConductedPeriods: 50, initialAttendedPeriods: 40 });
assert(s6.recordedAttended === 0, `Scenario 6 Recorded Attended: Expected 0, got ${s6.recordedAttended}`);
assert(s6.recordedConducted === 0, `Scenario 6 Recorded Conducted: Expected 0, got ${s6.recordedConducted}`);
assert(s6.holidayDays === 1, `Scenario 6 Holiday Days: Expected 1, got ${s6.holidayDays}`);
assert(s6.totalConducted === 50, `Scenario 6 Total Conducted remains 50`);
assert(s6.totalAttended === 40, `Scenario 6 Total Attended remains 40`);

// Test Target Calculator
// Attended 70, Conducted 100, Target 75
const targetTest1 = AttendanceCalculator.calculateTargetMetrics(70, 100, 75, 6);
assert(targetTest1.periodsToAttend === 20, `Target calc: Expected 20 periods needed, got ${targetTest1.periodsToAttend}`);
assert(targetTest1.daysToAttend === 4, `Target calc: Expected 4 days needed (ceil(20/6)), got ${targetTest1.daysToAttend}`);
assert(targetTest1.periodsCanMiss === 0, `Target calc: Cannot miss any period`);

// Attended 85, Conducted 100, Target 75
const targetTest2 = AttendanceCalculator.calculateTargetMetrics(85, 100, 75, 6);
assert(targetTest2.periodsToAttend === 0, `Target calc: 0 periods needed`);
assert(targetTest2.periodsCanMiss === 13, `Target calc: Can miss 13 periods, got ${targetTest2.periodsCanMiss}`);
assert(targetTest2.daysCanMiss === 2, `Target calc: Can miss 2 full days, got ${targetTest2.daysCanMiss}`);

// Test Method B
const methodBTest = AttendanceCalculator.calculateMethodB({}, {
  enableMethodB: true,
  methodBStartingPercentage: 80.0
}, 2, 1); // 2 full present days (+1.0%), 1 full absent day (-3.0%) -> 80.0 + 1.0 - 3.0 = 78.0%
assert(methodBTest.calculatedPercentage === 78.00, `Method B: Expected 78.00%, got ${methodBTest.calculatedPercentage}%`);

console.log('🎉 All calculator tests passed successfully!');

