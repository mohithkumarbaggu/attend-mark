/**
 * My Attendance Tracker - Notification & Toast System
 * Handles web notifications, in-app banners, and toast alerts.
 */

const AppNotifications = {
  toastContainer: null,

  init() {
    this.createToastContainer();
    this.checkAttendanceWarnings();
  },

  createToastContainer() {
    if (document.getElementById('toast-container')) {
      this.toastContainer = document.getElementById('toast-container');
      return;
    }
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    this.toastContainer = container;
  },

  /**
   * Display modern toast notification
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'} type
   * @param {number} duration
   */
  showToast(message, type = 'info', duration = 3500) {
    if (!this.toastContainer) this.createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
    } else {
      iconSvg = '<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>';
    }

    toast.innerHTML = `
      <div class="toast-body">
        ${iconSvg}
        <span class="toast-message">${message}</span>
      </div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.dismissToast(toast);
    });

    this.toastContainer.appendChild(toast);

    // Auto dismiss
    setTimeout(() => {
      this.dismissToast(toast);
    }, duration);
  },

  dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 280);
  },

  /**
   * Request native browser notifications permission
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      this.showToast('Browser notifications are not supported on this device.', 'warning');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.showToast('Notifications enabled successfully!', 'success');
        this.sendNativeNotification(
          'My Attendance Tracker',
          'Reminders are now active. We will help you stay on track!'
        );
        return true;
      } else {
        this.showToast('Notification permission was denied.', 'info');
        return false;
      }
    } catch (e) {
      console.warn('Notification permission error:', e);
      return false;
    }
  },

  /**
   * Send Native OS Notification if permitted
   */
  sendNativeNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%238B5CF6" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        });
      } catch (e) {
        console.warn('Native notification failed:', e);
      }
    }
  },

  /**
   * Check attendance and surface warnings if below target
   */
  checkAttendanceWarnings() {
    if (typeof window === 'undefined' || !window.AppStorage || !window.AttendanceCalculator) return;
    const settings = window.AppStorage.getSettings();
    const records = window.AppStorage.getRecords();
    const stats = window.AttendanceCalculator.calculateStats(records, settings);

    if (stats.totalConducted > 0 && stats.currentPercentage < stats.targetPercentage) {
      const banner = document.getElementById('attendance-warning-banner');
      if (banner) {
        banner.style.display = 'flex';
        const msg = banner.querySelector('.warning-message');
        if (msg) {
          msg.textContent = `Warning: Your current attendance (${stats.currentPercentage}%) has dropped below your ${stats.targetPercentage}% target. You need to attend ${stats.targetAnalysis.periodsToAttend} consecutive periods (${stats.targetAnalysis.daysToAttend} days) to recover.`;
        }
      }
    } else {
      const banner = document.getElementById('attendance-warning-banner');
      if (banner) banner.style.display = 'none';
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppNotifications;
}
if (typeof window !== 'undefined') {
  window.AppNotifications = AppNotifications;
}

