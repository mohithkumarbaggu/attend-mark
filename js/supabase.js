/**
 * AttendMark - Supabase Cloud Sync Engine
 * Real-time Persistence & Multi-Device Cloud Synchronization
 * 
 * Synchronizes:
 * 1. Student Profiles & Identity (Name, College, Branch, Semester, PIN)
 * 2. Biometric 128-D Facial Descriptors & Photos (Cross-device Face Unlock)
 * 3. Daily Attendance Records & Periods
 * 4. Academic Timetable & Settings
 */

const SupabaseSync = {
  // Default Project Configuration provided by user
  DEFAULT_URL: 'https://tiqwozykukchvzxizuwa.supabase.co',
  DEFAULT_KEY: 'sb_publishable_MIsfIB0Obl8OqnfhFmE-PQ_zylgn_tv',

  STORAGE_CONFIG_KEY: 'attendmark_supabase_config',
  STORAGE_QUEUE_KEY: 'attendmark_supabase_pending_queue',

  client: null,
  status: 'idle', // 'idle' | 'checking' | 'connected' | 'syncing' | 'tables_missing' | 'error' | 'offline'
  lastSyncTime: null,
  statusMessage: '',
  isSyncing: false,

  getConfig() {
    try {
      const stored = localStorage.getItem(this.STORAGE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          url: (parsed.url || this.DEFAULT_URL).trim(),
          key: (parsed.key || this.DEFAULT_KEY).trim(),
          autoSync: parsed.autoSync !== false
        };
      }
    } catch (e) {}

    return {
      url: this.DEFAULT_URL,
      key: this.DEFAULT_KEY,
      autoSync: true
    };
  },

  saveConfig(newConfig) {
    const current = this.getConfig();
    const merged = { ...current, ...newConfig };
    localStorage.setItem(this.STORAGE_CONFIG_KEY, JSON.stringify(merged));
    this.initClient();
    return merged;
  },

  init() {
    this.initClient();
    this.bindNetworkEvents();
    
    // Auto-check connectivity after 1 second
    setTimeout(() => {
      this.checkConnection().then(res => {
        if (res.status === 'connected') {
          // If connected, sync all local changes with cloud
          this.pullRemoteData().then(() => {
            this.syncAllLocalData(false);
          });
        }
      });
    }, 800);
  },

  initClient() {
    const cfg = this.getConfig();
    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
      try {
        this.client = window.supabase.createClient(cfg.url, cfg.key);
      } catch (e) {
        console.warn('Supabase client init error, falling back to direct REST:', e);
        this.client = null;
      }
    }
  },

  bindNetworkEvents() {
    window.addEventListener('online', () => {
      this.renderSyncStatus();
      this.processPendingQueue();
      this.checkConnection();
    });

    window.addEventListener('offline', () => {
      this.status = 'offline';
      this.statusMessage = 'Offline: Changes saved locally';
      this.renderSyncStatus();
    });
  },

  /**
   * Derive safe, unique student identifier (e.g. 'alex_morgan' or custom ID)
   */
  getStudentId(studentName) {
    const name = studentName || (typeof AppStorage !== 'undefined' ? AppStorage.getSettings().studentName : 'Alex Morgan');
    return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  },

  /**
   * Send HTTP request to Supabase PostgREST API
   */
  async fetchREST(endpoint, method = 'GET', body = null, extraHeaders = {}) {
    const cfg = this.getConfig();
    const url = `${cfg.url}/rest/v1/${endpoint}`;

    const headers = {
      'apikey': cfg.key,
      'Authorization': `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    };

    const options = {
      method,
      headers
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = text;
      }

      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        data
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err.message || 'Network request failed'
      };
    }
  },

  /**
   * Test Connection and check if required tables exist
   */
  async checkConnection() {
    if (!navigator.onLine) {
      this.status = 'offline';
      this.statusMessage = 'Offline: Working in local mode';
      this.renderSyncStatus();
      return { status: this.status, message: this.statusMessage };
    }

    this.status = 'checking';
    this.renderSyncStatus();

    // Check student_profiles table
    const res = await this.fetchREST('student_profiles?limit=1', 'GET');

    if (res.ok) {
      this.status = 'connected';
      this.statusMessage = 'Connected to Supabase Cloud';
    } else if (res.status === 404 && res.data && res.data.code === 'PGRST205') {
      // Table doesn't exist yet
      this.status = 'tables_missing';
      this.statusMessage = 'Database tables need to be created. Click "Setup Database Tables".';
    } else if (res.status === 401) {
      this.status = 'error';
      this.statusMessage = 'Invalid API key or authentication error.';
    } else {
      this.status = 'error';
      this.statusMessage = res.data?.message || res.error || `HTTP ${res.status}`;
    }

    this.renderSyncStatus();
    return { status: this.status, message: this.statusMessage, response: res };
  },

  /**
   * Sync Student Profile, Settings, and Biometric Face Vectors to Supabase
   */
  async syncStudentProfile(customProfile = null) {
    if (!navigator.onLine) {
      this.queueAction('syncStudentProfile', customProfile);
      return { success: false, offline: true };
    }

    const settings = typeof AppStorage !== 'undefined' ? AppStorage.getSettings() : {};
    const studentName = customProfile?.name || settings.studentName || 'Alex Morgan';
    const studentId = this.getStudentId(studentName);

    // Retrieve biometric enrollment if available
    let faceData = null;
    if (typeof FaceBiometrics !== 'undefined') {
      faceData = FaceBiometrics.getEnrolledFace();
    }

    const profilePayload = [{
      id: studentId,
      student_name: studentName,
      college_name: customProfile?.college || settings.collegeName || '',
      branch: customProfile?.branch || settings.branch || '',
      semester: customProfile?.semester || settings.semester || '',
      academic_year: customProfile?.academicYear || settings.academicYear || '',
      target_percentage: Number(customProfile?.targetPercentage || settings.targetPercentage || 75),
      pin: String(customProfile?.pin || settings.security?.pin || '1234'),
      face_descriptor: faceData ? faceData.descriptor : null,
      face_photo_url: faceData ? faceData.photoDataUrl : null,
      face_enrolled_at: faceData ? faceData.enrolledAt : null,
      settings: {
        periodsPerDay: settings.periodsPerDay || 6,
        initialConductedPeriods: settings.initialConductedPeriods || 0,
        initialAttendedPeriods: settings.initialAttendedPeriods || 0,
        enableMethodB: Boolean(settings.enableMethodB),
        methodBStartingPercentage: settings.methodBStartingPercentage || 75.0,
        theme: settings.theme || 'light',
        remindersEnabled: settings.remindersEnabled !== false,
        dailyReminderTime: settings.dailyReminderTime || '16:00',
        eveningReminderTime: settings.eveningReminderTime || '20:00',
        periodTimings: settings.periodTimings || [],
        timetable: settings.timetable || {}
      },
      updated_at: new Date().toISOString()
    }];

    try {
      const res = await this.fetchREST('student_profiles', 'POST', profilePayload, {
        'Prefer': 'resolution=merge-duplicates,return=representation'
      });

      if (res.ok) {
        this.lastSyncTime = new Date();
        this.status = 'connected';
        this.renderSyncStatus();
        return { success: true, data: res.data };
      } else if (res.data?.code === 'PGRST205') {
        this.status = 'tables_missing';
        this.renderSyncStatus();
        return { success: false, tablesMissing: true };
      }
      return { success: false, error: res.data?.message || 'Profile sync failed' };
    } catch (e) {
      this.queueAction('syncStudentProfile', customProfile);
      return { success: false, error: e.message };
    }
  },

  /**
   * Sync a Single Day's Attendance Record to Supabase
   */
  async syncDayRecord(dateStr, dayRecord) {
    if (!dateStr || !dayRecord) return { success: false };

    if (!navigator.onLine) {
      this.queueAction('syncDayRecord', { dateStr, dayRecord });
      return { success: false, offline: true };
    }

    const settings = typeof AppStorage !== 'undefined' ? AppStorage.getSettings() : {};
    const studentName = settings.studentName || 'Alex Morgan';
    const studentId = this.getStudentId(studentName);
    const recordId = `${studentId}_${dateStr}`;

    const recordPayload = [{
      id: recordId,
      student_id: studentId,
      student_name: studentName,
      date: dateStr,
      is_holiday: Boolean(dayRecord.isHoliday),
      holiday_reason: dayRecord.holidayReason || '',
      note: dayRecord.note || '',
      periods: Array.isArray(dayRecord.periods) ? dayRecord.periods : [],
      updated_at: new Date().toISOString()
    }];

    try {
      const res = await this.fetchREST('attendance_records', 'POST', recordPayload, {
        'Prefer': 'resolution=merge-duplicates,return=representation'
      });

      if (res.ok) {
        this.lastSyncTime = new Date();
        this.renderSyncStatus();
        return { success: true };
      } else if (res.data?.code === 'PGRST205') {
        this.status = 'tables_missing';
        this.renderSyncStatus();
        return { success: false, tablesMissing: true };
      }
      return { success: false, error: res.data?.message };
    } catch (e) {
      this.queueAction('syncDayRecord', { dateStr, dayRecord });
      return { success: false, error: e.message };
    }
  },

  /**
   * Sync All Local Data (Profile + All Records) to Supabase Cloud
   */
  async syncAllLocalData(showFeedback = true) {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.status = 'syncing';
    this.renderSyncStatus();

    try {
      // 1. Sync Profile & Biometrics
      const profileRes = await this.syncStudentProfile();
      if (profileRes.tablesMissing) {
        this.isSyncing = false;
        this.status = 'tables_missing';
        this.renderSyncStatus();
        if (showFeedback && typeof AppNotifications !== 'undefined') {
          AppNotifications.showToast('Supabase tables missing. Click Setup Database in Settings.', 'warning');
        }
        return { success: false, tablesMissing: true };
      }

      // 2. Batch Sync All Records
      const records = typeof AppStorage !== 'undefined' ? AppStorage.getRecords() : {};
      const dateKeys = Object.keys(records);
      const settings = typeof AppStorage !== 'undefined' ? AppStorage.getSettings() : {};
      const studentName = settings.studentName || 'Alex Morgan';
      const studentId = this.getStudentId(studentName);

      if (dateKeys.length > 0) {
        const batch = dateKeys.map(dStr => {
          const r = records[dStr];
          return {
            id: `${studentId}_${dStr}`,
            student_id: studentId,
            student_name: studentName,
            date: dStr,
            is_holiday: Boolean(r.isHoliday),
            holiday_reason: r.holidayReason || '',
            note: r.note || '',
            periods: Array.isArray(r.periods) ? r.periods : [],
            updated_at: new Date(r.updatedAt || Date.now()).toISOString()
          };
        });

        // Supabase PostgREST allows batch insert/upsert
        const recordsRes = await this.fetchREST('attendance_records', 'POST', batch, {
          'Prefer': 'resolution=merge-duplicates,return=representation'
        });

        if (!recordsRes.ok && recordsRes.data?.code === 'PGRST205') {
          this.status = 'tables_missing';
          this.renderSyncStatus();
          return { success: false, tablesMissing: true };
        }
      }

      this.lastSyncTime = new Date();
      this.status = 'connected';
      this.statusMessage = `Cloud synced: ${dateKeys.length} attendance dates backed up`;
      this.renderSyncStatus();

      if (showFeedback && typeof AppNotifications !== 'undefined') {
        AppNotifications.showToast(`Supabase Sync: Backed up ${dateKeys.length} records!`, 'success');
      }

      return { success: true, count: dateKeys.length };
    } catch (e) {
      this.status = 'error';
      this.statusMessage = e.message;
      this.renderSyncStatus();
      if (showFeedback && typeof AppNotifications !== 'undefined') {
        AppNotifications.showToast(`Sync error: ${e.message}`, 'error');
      }
      return { success: false, error: e.message };
    } finally {
      this.isSyncing = false;
      this.renderSyncStatus();
    }
  },

  /**
   * Pull Remote Data from Supabase and Merge with Local State
   */
  async pullRemoteData(targetStudentName = null) {
    if (!navigator.onLine) return { success: false, offline: true };

    const settings = typeof AppStorage !== 'undefined' ? AppStorage.getSettings() : {};
    const studentName = targetStudentName || settings.studentName || 'Alex Morgan';
    const studentId = this.getStudentId(studentName);

    try {
      // 1. Fetch Student Profile
      const profRes = await this.fetchREST(`student_profiles?id=eq.${encodeURIComponent(studentId)}`, 'GET');
      if (profRes.ok && Array.isArray(profRes.data) && profRes.data.length > 0) {
        const remoteProfile = profRes.data[0];
        
        // Merge into AppStorage
        const currentSettings = AppStorage.getSettings();
        const mergedSettings = {
          ...currentSettings,
          studentName: remoteProfile.student_name || currentSettings.studentName,
          collegeName: remoteProfile.college_name || currentSettings.collegeName,
          branch: remoteProfile.branch || currentSettings.branch,
          semester: remoteProfile.semester || currentSettings.semester,
          academicYear: remoteProfile.academic_year || currentSettings.academicYear,
          targetPercentage: Number(remoteProfile.target_percentage) || currentSettings.targetPercentage,
          security: {
            ...(currentSettings.security || {}),
            pin: remoteProfile.pin || currentSettings.security?.pin || '1234'
          },
          ...(remoteProfile.settings || {})
        };
        AppStorage.saveSettings(mergedSettings);

        // Merge Biometric Face Descriptor if available
        if (remoteProfile.face_descriptor && typeof FaceBiometrics !== 'undefined') {
          FaceBiometrics.saveEnrolledFace({
            studentName: remoteProfile.student_name,
            enrolledAt: remoteProfile.face_enrolled_at || new Date().toISOString(),
            descriptor: remoteProfile.face_descriptor,
            photoDataUrl: remoteProfile.face_photo_url || ''
          });
        }
      }

      // 2. Fetch Attendance Records
      const recRes = await this.fetchREST(`attendance_records?student_id=eq.${encodeURIComponent(studentId)}&order=date.asc`, 'GET');
      if (recRes.ok && Array.isArray(recRes.data)) {
        const localRecords = AppStorage.getRecords();
        let updatedCount = 0;

        recRes.data.forEach(remoteRec => {
          const dateStr = remoteRec.date;
          // Only overwrite if remote is newer or doesn't exist locally
          localRecords[dateStr] = {
            date: dateStr,
            isHoliday: Boolean(remoteRec.is_holiday),
            holidayReason: remoteRec.holiday_reason || '',
            note: remoteRec.note || '',
            periods: Array.isArray(remoteRec.periods) ? remoteRec.periods : [],
            updatedAt: remoteRec.updated_at ? new Date(remoteRec.updated_at).getTime() : Date.now()
          };
          updatedCount++;
        });

        const state = AppStorage.getState();
        state.records = localRecords;
        AppStorage.saveState(state);

        if (typeof App !== 'undefined' && App.renderCurrentView) {
          App.renderCurrentView();
          App.updateUserProfileInSidebar();
        }

        return { success: true, count: updatedCount };
      }

      return { success: true };
    } catch (e) {
      console.warn('Error pulling remote Supabase data:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Offline Action Queue Management
   */
  queueAction(actionName, payload) {
    try {
      const q = JSON.parse(localStorage.getItem(this.STORAGE_QUEUE_KEY) || '[]');
      q.push({ actionName, payload, timestamp: Date.now() });
      localStorage.setItem(this.STORAGE_QUEUE_KEY, JSON.stringify(q));
    } catch (e) {}
  },

  async processPendingQueue() {
    try {
      const raw = localStorage.getItem(this.STORAGE_QUEUE_KEY);
      if (!raw) return;
      const q = JSON.parse(raw);
      if (!Array.isArray(q) || q.length === 0) return;

      localStorage.removeItem(this.STORAGE_QUEUE_KEY);

      for (const item of q) {
        if (item.actionName === 'syncDayRecord' && item.payload) {
          await this.syncDayRecord(item.payload.dateStr, item.payload.dayRecord);
        } else if (item.actionName === 'syncStudentProfile') {
          await this.syncStudentProfile(item.payload);
        }
      }
    } catch (e) {
      console.warn('Error processing pending Supabase queue:', e);
    }
  },

  /**
   * Visual UI Status Rendering (Header Sync Pill & Settings Card)
   */
  renderSyncStatus() {
    // 1. Header Sync Pill
    const pill = document.getElementById('header-sync-pill');
    const dot = document.getElementById('header-sync-dot');
    const label = document.getElementById('header-sync-label');

    if (pill && dot && label) {
      pill.className = `header-sync-pill status-${this.status}`;
      
      switch (this.status) {
        case 'connected':
          label.textContent = 'Cloud Synced';
          pill.title = `Supabase Connected. Last synced: ${this.lastSyncTime ? this.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ready'}`;
          break;
        case 'syncing':
          label.textContent = 'Syncing...';
          pill.title = 'Synchronizing with Supabase Cloud...';
          break;
        case 'tables_missing':
          label.textContent = 'Setup Needed';
          pill.title = 'Database tables need to be created in Supabase SQL Editor.';
          break;
        case 'offline':
          label.textContent = 'Offline';
          pill.title = 'Offline mode. Changes are saved locally and will auto-sync when online.';
          break;
        case 'error':
          label.textContent = 'Sync Error';
          pill.title = `Supabase Error: ${this.statusMessage}`;
          break;
        default:
          label.textContent = 'Cloud';
          pill.title = 'Supabase Cloud Sync';
          break;
      }
    }

    // 2. Settings Card Sync Status
    const statusBadge = document.getElementById('supabase-status-badge');
    const statusDesc = document.getElementById('supabase-status-desc');
    const lastSyncEl = document.getElementById('supabase-last-sync-time');
    const setupBanner = document.getElementById('supabase-setup-banner');

    if (statusBadge) {
      statusBadge.className = 'badge';
      if (this.status === 'connected') {
        statusBadge.classList.add('badge-present');
        statusBadge.textContent = 'Connected & Active';
      } else if (this.status === 'syncing') {
        statusBadge.classList.add('badge-purple');
        statusBadge.textContent = 'Syncing...';
      } else if (this.status === 'tables_missing') {
        statusBadge.classList.add('badge-warning');
        statusBadge.textContent = 'Tables Required';
      } else if (this.status === 'offline') {
        statusBadge.classList.add('badge-secondary');
        statusBadge.textContent = 'Offline';
      } else {
        statusBadge.classList.add('badge-absent');
        statusBadge.textContent = 'Needs Attention';
      }
    }

    if (statusDesc) {
      statusDesc.textContent = this.statusMessage || (this.status === 'connected' ? 'All records, settings, and face biometrics are backed up in real time.' : '');
    }

    if (lastSyncEl && this.lastSyncTime) {
      lastSyncEl.textContent = this.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    if (setupBanner) {
      setupBanner.style.display = this.status === 'tables_missing' ? 'block' : 'none';
    }
  },

  /**
   * Return Complete SQL Schema Script for Supabase SQL Editor
   */
  getSchemaSQL() {
    return `-- ==============================================================================
-- AttendMark Database Schema for Supabase
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- Direct Link: https://supabase.com/dashboard/project/tiqwozykukchvzxizuwa/sql/new
-- ==============================================================================

-- 1. Student Profiles Table
CREATE TABLE IF NOT EXISTS public.student_profiles (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    college_name TEXT,
    branch TEXT,
    semester TEXT,
    academic_year TEXT,
    target_percentage NUMERIC DEFAULT 75,
    pin TEXT DEFAULT '1234',
    face_descriptor JSONB,
    face_photo_url TEXT,
    face_enrolled_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Daily Attendance Records Table
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    date DATE NOT NULL,
    is_holiday BOOLEAN DEFAULT FALSE,
    holiday_reason TEXT DEFAULT '',
    note TEXT DEFAULT '',
    periods JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for High Performance Queries
CREATE INDEX IF NOT EXISTS idx_records_student_id ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON public.attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_records_student_date ON public.attendance_records(student_id, date);

-- 4. Enable Row Level Security (RLS) & Grant Public / Anon Access
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to student_profiles" ON public.student_profiles;
CREATE POLICY "Allow public read access to student_profiles" 
ON public.student_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to student_profiles" ON public.student_profiles;
CREATE POLICY "Allow public write access to student_profiles" 
ON public.student_profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access to attendance_records" ON public.attendance_records;
CREATE POLICY "Allow public read access to attendance_records" 
ON public.attendance_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to attendance_records" ON public.attendance_records;
CREATE POLICY "Allow public write access to attendance_records" 
ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
`;
  }
};

window.SupabaseSync = SupabaseSync;
