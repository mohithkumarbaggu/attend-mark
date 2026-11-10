/**
 * My Attendance Tracker - Storage & Persistence Engine
 * Handles localStorage, schema validation, import/export, and demo data.
 */

const AppStorage = {
  STORAGE_KEY: 'my_attendance_tracker_v1',

  defaultSettings: {
    studentName: 'Alex Morgan',
    collegeName: 'National Institute of Technology',
    branch: 'Computer Science & Engineering',
    academicYear: '2026-2027',
    semester: 'Semester 5',
    periodsPerDay: 6,
    targetPercentage: 75,
    initialConductedPeriods: 0,
    initialAttendedPeriods: 0,
    enableMethodB: false,
    methodBStartingPercentage: 75.0,
    theme: 'light', // 'light', 'dark', 'system'
    remindersEnabled: true,
    dailyReminderTime: '16:00',
    eveningReminderTime: '20:00',
    security: {
      pin: '1234',
      studentId: 'NIT/2026/CS101',
      isRegistered: true,
      requireLogin: true
    },
    periodTimings: [
      '09:00 - 10:00',
      '10:00 - 11:00',
      '11:15 - 12:15',
      '01:00 - 02:00',
      '02:00 - 03:00',
      '03:00 - 04:00'
    ],
    timetable: {
      Monday: ['Mathematics IV', 'Data Structures', 'Operating Systems', 'Computer Networks', 'Database Systems', 'CS Lab'],
      Tuesday: ['Algorithms', 'Software Engg', 'Computer Networks', 'Mathematics IV', 'AI & Machine Learning', 'AI Lab'],
      Wednesday: ['Operating Systems', 'Data Structures', 'Database Systems', 'Professional Ethics', 'Seminar', 'Sports / Library'],
      Thursday: ['Software Engg', 'AI & Machine Learning', 'Mathematics IV', 'Computer Networks', 'Data Structures', 'Library'],
      Friday: ['Database Systems', 'Operating Systems', 'Algorithms', 'Software Engg', 'Project Lab', 'Project Lab'],
      Saturday: ['Technical Seminar', 'Open Elective', 'Open Elective', 'Mentorship / Remedial', 'Self Study', 'Self Study'],
      Sunday: []
    }
  },

  /**
   * Internal memory store in case localStorage is unavailable (e.g., restricted iframe)
   */
  _memoryFallback: null,

  /**
   * Read raw app state from storage
   */
  getState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            settings: { ...this.defaultSettings, ...(parsed.settings || {}) },
            records: parsed.records || {}
          };
        }
      }
    } catch (e) {
      console.warn('localStorage read error, using memory fallback:', e);
    }

    if (!this._memoryFallback) {
      this._memoryFallback = {
        settings: { ...this.defaultSettings },
        records: {}
      };
    }
    return this._memoryFallback;
  },

  /**
   * Write app state to storage
   */
  saveState(state) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
      }
    } catch (e) {
      console.warn('localStorage write error:', e);
    }
    this._memoryFallback = state;
    return true;
  },

  /**
   * Get Settings
   */
  getSettings() {
    const state = this.getState();
    return { ...this.defaultSettings, ...state.settings };
  },

  /**
   * Save Settings
   */
  saveSettings(newSettings) {
    const state = this.getState();
    state.settings = { ...state.settings, ...newSettings };
    this.saveState(state);
    if (typeof window !== 'undefined' && window.SupabaseSync && window.SupabaseSync.syncStudentProfile) {
      window.SupabaseSync.syncStudentProfile().catch(() => {});
    }
    return state.settings;
  },

  /**
   * Get All Records
   */
  getRecords() {
    const state = this.getState();
    return state.records || {};
  },

  /**
   * Get a single day's record
   */
  getDayRecord(dateStr) {
    const records = this.getRecords();
    return records[dateStr] || null;
  },

  /**
   * Save or update a day's record
   */
  saveDayRecord(dateStr, dayData) {
    if (!dateStr) return false;
    const state = this.getState();
    if (!state.records) state.records = {};

    state.records[dateStr] = {
      date: dateStr,
      isHoliday: Boolean(dayData.isHoliday),
      holidayReason: dayData.holidayReason || '',
      note: dayData.note || '',
      periods: Array.isArray(dayData.periods) ? dayData.periods : [],
      updatedAt: Date.now()
    };

    this.saveState(state);
    if (typeof window !== 'undefined' && window.SupabaseSync && window.SupabaseSync.syncDayRecord) {
      window.SupabaseSync.syncDayRecord(dateStr, state.records[dateStr]).catch(() => {});
    }
    return state.records[dateStr];
  },

  /**
   * Delete a day's record
   */
  deleteDayRecord(dateStr) {
    const state = this.getState();
    if (state.records && state.records[dateStr]) {
      delete state.records[dateStr];
      this.saveState(state);
      return true;
    }
    return false;
  },

  /**
   * Clear all records and optionally reset settings
   */
  clearAllData(keepSettings = true) {
    const state = this.getState();
    const newState = {
      settings: keepSettings ? state.settings : { ...this.defaultSettings },
      records: {}
    };
    this.saveState(newState);
    return true;
  },

  /**
   * Multi-Account Registry for Student ID & Password Authentication
   */
  ACCOUNTS_REGISTRY_KEY: 'attendmark_accounts_registry',

  getAccountsRegistry() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.ACCOUNTS_REGISTRY_KEY);
        return raw ? JSON.parse(raw) : {};
      }
    } catch (e) {}
    return {};
  },

  saveAccountToRegistry(studentId, studentName, pin, state) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const reg = this.getAccountsRegistry();
        const normId = (studentId || studentName || 'student').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        reg[normId] = {
          studentId: (studentId || normId).trim(),
          studentName: studentName || 'Student',
          pin: String(pin).trim(),
          updatedAt: Date.now(),
          state
        };
        window.localStorage.setItem(this.ACCOUNTS_REGISTRY_KEY, JSON.stringify(reg));
      }
    } catch (e) {}
  },

  /**
   * Session authentication state (persists during active browser tab session)
   */
  _sessionUnlocked: false,

  persistSessionUnlocked(unlocked) {
    this._sessionUnlocked = Boolean(unlocked);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (unlocked) {
          window.sessionStorage.setItem('attendmark_session_unlocked', 'true');
        } else {
          window.sessionStorage.removeItem('attendmark_session_unlocked');
        }
      }
    } catch (e) {}
  },

  isUnlocked() {
    const settings = this.getSettings();
    if (!settings.security?.requireLogin) return true;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (window.sessionStorage.getItem('attendmark_session_unlocked') === 'true') {
          return true;
        }
      }
    } catch (e) {}
    return this._sessionUnlocked;
  },

  /**
   * Student ID & Password Authentication
   * Authenticates against:
   * 1. Current active local student
   * 2. Local accounts registry
   * 3. Supabase Cloud Database (if online)
   */
  async login(studentIdInput, passwordInput) {
    const rawId = (studentIdInput || '').trim();
    const rawPass = (passwordInput || '').trim();

    if (!rawId || !rawPass) {
      return { success: false, message: 'Please enter both Student ID and Password.' };
    }

    const normId = rawId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const currentState = this.getState();
    const curSettings = currentState.settings;
    const curStudentId = (curSettings.security?.studentId || '').trim();
    const curNormId = curStudentId ? curStudentId.toLowerCase().replace(/[^a-z0-9_-]/g, '_') : '';
    const curNameNorm = (curSettings.studentName || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const currentPin = String(curSettings.security?.pin || '1234').trim();

    // 1. Check current active profile
    if (
      (normId === curNormId || normId === curNameNorm || rawId.toLowerCase() === curStudentId.toLowerCase() || rawId.toLowerCase() === 'cs101') &&
      rawPass === currentPin
    ) {
      this.persistSessionUnlocked(true);
      return { success: true, student: curSettings };
    }

    // 2. Check local registered accounts
    const accounts = this.getAccountsRegistry();
    let matchedAcc = null;

    if (accounts[normId]) {
      matchedAcc = accounts[normId];
    } else {
      // Find case-insensitive match by studentId or studentName
      for (const k of Object.keys(accounts)) {
        const acc = accounts[k];
        if (
          (acc.studentId && acc.studentId.toLowerCase() === rawId.toLowerCase()) ||
          (acc.studentName && acc.studentName.toLowerCase() === rawId.toLowerCase())
        ) {
          matchedAcc = acc;
          break;
        }
      }
    }

    if (matchedAcc) {
      if (String(matchedAcc.pin).trim() === rawPass) {
        // Save previous account state before switching
        if (curNormId) {
          this.saveAccountToRegistry(curStudentId, curSettings.studentName, currentPin, currentState);
        }
        // Load matched account
        this.saveState(matchedAcc.state);
        this.persistSessionUnlocked(true);
        return { success: true, student: matchedAcc.state.settings };
      } else {
        return { success: false, message: 'Incorrect Password. Please try again.' };
      }
    }

    // 3. Fallback: Authenticate via Supabase Cloud (multi-device login)
    if (typeof window !== 'undefined' && window.SupabaseSync && navigator.onLine) {
      try {
        const res = await window.SupabaseSync.fetchREST(`student_profiles?id=eq.${encodeURIComponent(normId)}`, 'GET');
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          const remote = res.data[0];
          const remotePin = String(remote.pin || '1234').trim();
          if (remotePin === rawPass) {
            // Restore from Cloud
            await window.SupabaseSync.pullRemoteData(remote.student_name || normId);
            this.persistSessionUnlocked(true);
            return { success: true, student: this.getSettings() };
          } else {
            return { success: false, message: 'Incorrect Password for this Student ID.' };
          }
        }
      } catch (err) {
        console.warn('Cloud login lookup error:', err);
      }
    }

    // If default demo credentials
    if ((rawId.toUpperCase() === 'CS101' || rawId.toLowerCase() === 'alex' || rawId.toLowerCase() === 'alex morgan') && rawPass === '1234') {
      this.persistSessionUnlocked(true);
      return { success: true, student: curSettings };
    }

    return {
      success: false,
      message: 'Student ID not found. Check your credentials or click "Register Account".'
    };
  },

  /**
   * Unlock with Face Biometrics
   */
  unlockWithBiometrics(studentName, studentId = null) {
    this.persistSessionUnlocked(true);
    return { success: true, studentName };
  },

  /**
   * Legacy PIN unlock fallback
   */
  unlock(enteredPin) {
    const settings = this.getSettings();
    const currentPin = settings.security?.pin || '1234';
    if (String(enteredPin).trim() === String(currentPin).trim()) {
      this.persistSessionUnlocked(true);
      return { success: true };
    }
    return { success: false, message: 'Incorrect Password. Try again (Default: 1234).' };
  },

  lock() {
    this.persistSessionUnlocked(false);
    return true;
  },

  logout() {
    this.persistSessionUnlocked(false);
    return true;
  },

  createAccount(profileData) {
    const studentId = (profileData.studentId || profileData.name || 'CS101').trim();
    const pin = String(profileData.pin || profileData.password || '1234').trim();

    const currentState = this.getState();
    const state = {
      settings: {
        ...this.defaultSettings,
        studentName: profileData.name || 'Alex Morgan',
        collegeName: profileData.college || '',
        branch: profileData.branch || '',
        academicYear: profileData.academicYear || '2026-2027',
        semester: profileData.semester || 'Semester 1',
        targetPercentage: Number(profileData.targetPercentage) || 75,
        security: {
          pin,
          password: pin,
          studentId,
          isRegistered: true,
          requireLogin: true
        }
      },
      records: {}
    };

    this.saveState(state);
    this.saveAccountToRegistry(studentId, profileData.name, pin, state);

    if (typeof window !== 'undefined' && window.SupabaseSync && window.SupabaseSync.syncStudentProfile) {
      window.SupabaseSync.syncStudentProfile(profileData).catch(() => {});
    }

    this.persistSessionUnlocked(true);
    return { success: true };
  },

  changePin(currentPin, newPin) {
    const settings = this.getSettings();
    if (String(currentPin).trim() !== String(settings.security?.pin || '1234').trim()) {
      return { success: false, message: 'Current PIN is incorrect.' };
    }
    if (!newPin || String(newPin).trim().length < 4) {
      return { success: false, message: 'New PIN must be at least 4 digits.' };
    }
    const state = this.getState();
    state.settings.security = {
      ...(state.settings.security || {}),
      pin: String(newPin).trim()
    };
    this.saveState(state);
    return { success: true };
  },

  /**
   * Export all data as JSON
   */
  exportJSON() {
    const state = this.getState();
    const exportPayload = {
      app: 'My Attendance Tracker',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      records: state.records
    };
    return JSON.stringify(exportPayload, null, 2);
  },

  /**
   * Import data from JSON
   */
  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON format');
      }

      const state = this.getState();

      if (parsed.settings && typeof parsed.settings === 'object') {
        state.settings = { ...state.settings, ...parsed.settings };
      }

      if (parsed.records && typeof parsed.records === 'object') {
        // Merge or replace
        state.records = { ...state.records, ...parsed.records };
      }

      this.saveState(state);
      return { success: true, count: Object.keys(state.records || {}).length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Seed realistic sample data for 30 days
   */
  seedDemoData() {
    const state = this.getState();
    const settings = state.settings;
    const periodsPerDay = Number(settings.periodsPerDay) || 6;
    const timetable = settings.timetable || this.defaultSettings.timetable;

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const newRecords = {};

    // Generate past 35 days up to today
    const today = new Date();

    for (let i = 35; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);

      const dayIndex = d.getDay();
      const dayName = daysOfWeek[dayIndex];
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // Skip Sunday (Weekend)
      if (dayIndex === 0) continue;

      // Occasional holiday (e.g. 2 holidays in the month)
      if (i === 22) {
        newRecords[dateStr] = {
          date: dateStr,
          isHoliday: true,
          holidayReason: 'College Tech Fest / Founder\'s Day',
          note: 'Annual cultural & tech symposium',
          periods: [],
          updatedAt: Date.now()
        };
        continue;
      }
      if (i === 11) {
        newRecords[dateStr] = {
          date: dateStr,
          isHoliday: true,
          holidayReason: 'National Holiday',
          note: 'Campus closed',
          periods: [],
          updatedAt: Date.now()
        };
        continue;
      }

      // Generate period attendance with realistic ~82-88% attendance pattern
      const daySubjects = timetable[dayName] || [];
      const periods = [];

      for (let p = 1; p <= periodsPerDay; p++) {
        const subject = daySubjects[p - 1] || `Period ${p}`;
        const timing = settings.periodTimings?.[p - 1] || `Period ${p}`;

        // Seed realistic attendance: high probability of present, occasional absent
        // Introduce occasional sick day or morning absent
        let status = 'present';
        if (i === 18) {
          // Full sick day
          status = 'absent';
        } else if (i === 7 && p <= 2) {
          // Late arrival
          status = 'absent';
        } else if (i === 15 && p === 4) {
          status = 'absent';
        } else if (i === 3 && p >= 5) {
          // Left early
          status = 'absent';
        } else if (Math.random() < 0.10) {
          status = 'absent';
        }

        periods.push({
          periodNumber: p,
          status,
          subject,
          time: timing
        });
      }

      newRecords[dateStr] = {
        date: dateStr,
        isHoliday: false,
        holidayReason: '',
        note: '',
        periods,
        updatedAt: Date.now()
      };
    }

    state.records = newRecords;
    this.saveState(state);
    return Object.keys(newRecords).length;
  },

  /**
   * Seed exact prompt scenario: 100 conducted, 85 attended periods
   */
  seedTestingScenario(scenarioNumber = 1) {
    const state = this.getState();
    state.records = {}; // clear for clean test

    if (scenarioNumber === 1 || scenarioNumber === 2 || scenarioNumber === 3) {
      state.settings.initialConductedPeriods = 100;
      state.settings.initialAttendedPeriods = 85;
      state.settings.targetPercentage = 75;
    }

    if (scenarioNumber === 2) {
      // 1 additional period attended
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      state.records[dateStr] = {
        date: dateStr,
        isHoliday: false,
        periods: [{ periodNumber: 1, status: 'present', subject: 'Subject 1' }]
      };
    } else if (scenarioNumber === 3) {
      // Miss 1 additional period from 101 conducted or 2 missed from 100
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      state.records[dateStr] = {
        date: dateStr,
        isHoliday: false,
        periods: [
          { periodNumber: 1, status: 'absent', subject: 'Subject 1' },
          { periodNumber: 2, status: 'absent', subject: 'Subject 2' }
        ]
      };
    } else if (scenarioNumber === 4) {
      // Full day 6 periods Present
      state.settings.initialConductedPeriods = 0;
      state.settings.initialAttendedPeriods = 0;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      state.records[dateStr] = {
        date: dateStr,
        isHoliday: false,
        periods: Array.from({ length: 6 }, (_, idx) => ({
          periodNumber: idx + 1,
          status: 'present',
          subject: `Period ${idx + 1}`
        }))
      };
    } else if (scenarioNumber === 5) {
      // Full day 6 periods Absent
      state.settings.initialConductedPeriods = 0;
      state.settings.initialAttendedPeriods = 0;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      state.records[dateStr] = {
        date: dateStr,
        isHoliday: false,
        periods: Array.from({ length: 6 }, (_, idx) => ({
          periodNumber: idx + 1,
          status: 'absent',
          subject: `Period ${idx + 1}`
        }))
      };
    } else if (scenarioNumber === 6) {
      // Holiday
      state.settings.initialConductedPeriods = 50;
      state.settings.initialAttendedPeriods = 40;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      state.records[dateStr] = {
        date: dateStr,
        isHoliday: true,
        holidayReason: 'College Festival / Holiday',
        periods: []
      };
    }

    this.saveState(state);
    return true;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppStorage;
}
if (typeof window !== 'undefined') {
  window.AppStorage = AppStorage;
}

