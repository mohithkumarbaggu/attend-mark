# My Attendance Tracker (AttendMark)

A personal, responsive, mobile-first college attendance management web application built with **HTML5**, **CSS3**, and **Vanilla JavaScript**. Designed with the Apple design language, Linear dashboard polish, Notion minimalism, and modern fintech UI aesthetics.

---

## 🌟 Key Features

1. **Dashboard**
   - **Circular SVG Progress Ring**: Visual indicator of your current attendance percentage.
   - **8 Core Metric Cards**: Conducted periods, Attended periods, Missed periods, Monthly attendance %, Total working days, Present days (full & partial), Entire-day absences, and Target goal.
   - **Attendance Progress Bar & Target Marker**: Real-time progress toward your goal.
   - **Recent Activity Feed**: Quick inspection and 1-click editing of recent daily logs.
   - **Automatic Status Badges**: Dynamic indicators for Safe Zone, On Track, At Risk, or Critical Shortfall.

2. **Daily Period-wise Attendance Marking**
   - **Date Picker & Quick Stepper**: Easily navigate between days or jump to today with one click.
   - **Configurable Periods**: Defaults to 6 periods per day (customizable from 1 to 12 in Settings).
   - **Timetable Subject Integration**: Period cards automatically load subject names from your weekly schedule.
   - **Tactile Color Coding**: High-contrast Green for Present, Red for Absent.
   - **One-Click Batch Actions**: "Mark All Present", "Mark All Absent", and "Clear Day".
   - **Holidays & Days Without Classes**: Toggle days as holidays with a reason; holiday periods are excluded from the conducted count.
   - **Duplicate Entry Prevention**: Automatically updates existing records by date key without duplicate entries.

3. **Attendance Calculation Engine**
   - **Method A (Period-Based Formula)**:
     $$\text{Attendance \%} = \left(\frac{\text{Total Attended Periods}}{\text{Total Conducted Periods}}\right) \times 100$$
     Automatically recalculates whenever any period status changes. Supports initial baseline periods.
   - **Method B (Custom Daily Adjustment Tracker)**:
     - Full-day attendance: $+0.5$ percentage points
     - Entire-day absence: $-3.0$ percentage points
     - Kept strictly separate from Method A and displayed in a dedicated card when enabled in Settings.

4. **Target & Bunk Calculator**
   - **Consecutive Periods to Attend**: Calculated dynamically using:
     $$x = \left\lceil \frac{T \cdot C - 100 \cdot A}{100 - T} \right\rceil$$
   - **Periods You Can Safely Miss / Bunk**:
     $$y = \left\lfloor \frac{100 \cdot A - T \cdot C}{T} \right\rfloor$$
   - **What-If Simulation Sliders**: Interactively test attending or missing the next $N$ periods to see real-time projected percentages.

5. **Attendance Calendar**
   - Monthly view with color-coded day cells:
     - **Green**: Full Attendance
     - **Yellow**: Partial Attendance
     - **Red**: Full Absence
     - **Grey**: Holiday / Campus Closed
     - **Blue**: Today
   - Click any date to view period breakdowns and jump directly to editing.

6. **Attendance History**
   - Filter by: "All Records", "This Week", "This Month", "Previous Month".
   - Search by date, day, subject, or note.
   - Sort by Date (newest/oldest) or Attendance % (high/low).
   - Edit or delete individual entries.

7. **Reports & Analytics (Zero-Dependency Custom Charts)**
   - **Cumulative Attendance Progress Line Chart** with target benchmark line.
   - **Weekly Trends Bar Chart** (Present vs Absent per day).
   - **Present vs Absent Donut Chart** with centered stats.
   - **Monthly Comparison Chart**.
   - **Day-of-Week Breakdown** (Monday through Saturday).
   - **Export CSV**: Complete spreadsheet with daily breakdowns and summary totals.
   - **Print / PDF Report**: Clean printable layout styled with `@media print`.

8. **Settings & Data Management**
   - Profile: Student name, college name, branch, academic year, semester.
   - Timetable Editor: Customize period subject names for Monday through Saturday.
   - Theme Switcher: Light Mode (Apple aesthetic) and Dark Mode (Linear aesthetic).
   - Data Privacy: 100% client-side storage via `localStorage`.
   - Backup & Restore: Export/Import complete app state as JSON.
   - Automated 7-Scenario Verification Test Runner built right into the UI.

---

## 🚀 How to Run the Application

No installation or build steps required. Simply open `index.html` in any modern web browser:

```bash
# Option 1: Open directly in your browser on macOS
open index.html

# Option 2: Run with Python's built-in HTTP server
python3 -m http.server 8080
# Then open http://localhost:8080 in your browser
```

---

## 🧪 Verification of the 7 Required Test Scenarios

Open `tests/test-scenarios.html` in your browser or click **"Verify All 7 Scenarios"** under Settings in the app:

| Scenario | Description | Expected | Result |
| :--- | :--- | :--- | :--- |
| **Scenario 1** | 100 conducted periods, 85 attended periods | Attendance = 85.00% | **PASSED** |
| **Scenario 2** | Attend one additional period (86/101) | Attendance = 85.15% | **PASSED** |
| **Scenario 3** | Miss additional periods (85/102) | Attendance = 83.33% | **PASSED** |
| **Scenario 4** | Full day with 6 periods, all Present | 6 periods recorded, Full Present Day = 1 | **PASSED** |
| **Scenario 5** | Entire day absent (6 periods) | 6 conducted, 0 attended, Full Absent Day = 1 | **PASSED** |
| **Scenario 6** | Holiday handling | 0 conducted added; conducted count unchanged | **PASSED** |
| **Scenario 7** | Refresh browser | All data persists in localStorage | **PASSED** |

---

## 📁 Project Architecture

```
Attend Mark/
├── index.html                  # Main responsive single-page web application
├── README.md                   # Documentation and usage guide
├── css/
│   └── styles.css              # Apple/Linear design system, light/dark themes, print styles
├── js/
│   ├── calculator.js           # Pure math engine for Method A, Method B, & target metrics
│   ├── storage.js              # Persistence wrapper, JSON backup/restore, & demo seed data
│   ├── charts.js               # Retina Canvas charting engine (zero external dependencies)
│   ├── export.js               # CSV exporter & print-friendly PDF generation
│   ├── notifications.js        # Web Notifications API & in-app toast notification system
│   └── app.js                  # View router, DOM bindings, calendar, daily marker, & test runner
└── tests/
    ├── test-scenarios.html     # Standalone browser test runner for all 7 scenarios
    └── test-scenarios.js       # Node/JS verification test suite
```

