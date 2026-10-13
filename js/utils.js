/**
 * PRELAN JUNIOR SCHOOL - SHARED UTILITIES
 * Security, Form Validation, Image Compression & Helpers
 */

/**
 * Escapes HTML characters to prevent XSS attacks when rendering strings.
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Validates and normalizes Kenyan phone numbers (07XX..., 01XX..., +254..., 254...)
 * @param {string} phone 
 * @returns {{ valid: boolean, formatted: string, message?: string }}
 */
export function validateKenyanPhone(phone) {
  if (!phone) {
    return { valid: false, formatted: '', message: 'Phone number is required.' };
  }
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Matches: 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, 2541XXXXXXXX, +2547XXXXXXXX, +2541XXXXXXXX
  const kenyanRegex = /^(?:(?:\+?254)|0)?([17]\d{8})$/;
  const match = cleaned.match(kenyanRegex);

  if (!match) {
    return {
      valid: false,
      formatted: phone,
      message: 'Please enter a valid Kenyan phone number (e.g. 0712 345 678, 0110 123 456, or +254 712 345 678).'
    };
  }

  // Standardize to E.164: +254XXXXXXXXX
  const formatted = `+254${match[1]}`;
  return { valid: true, formatted };
}

/**
 * Formats a numeric value into Kenyan Shillings (KES)
 * @param {number|string} amount 
 * @returns {string}
 */
export function formatKES(amount) {
  if (amount === null || amount === undefined || amount === '' || amount === '____') {
    return 'KES ____';
  }
  const num = Number(amount);
  if (isNaN(num)) return `KES ${amount}`;
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Formats a Firestore Timestamp, Date, or ISO string into human readable format
 * @param {any} timestamp 
 * @returns {string}
 */
export function formatDate(timestamp) {
  if (!timestamp) return '—';
  try {
    let date;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return String(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return String(timestamp);
  }
}

/**
 * Displays a toast notification message
 * @param {string} message 
 * @param {'success'|'error'|'info'} type 
 * @param {number} durationMs 
 */
export function showToast(message, type = 'info', durationMs = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const iconMap = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  const icon = document.createElement('span');
  icon.style.fontWeight = 'bold';
  icon.style.fontSize = '1.2rem';
  icon.textContent = iconMap[type] || 'ℹ';

  const text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

/**
 * Compresses an image file client-side to ensure it remains under 200KB for Firestore storage.
 * @param {File} file 
 * @param {number} maxWidth 
 * @param {number} maxHeight 
 * @param {number} quality 
 * @returns {Promise<string>} Base64 data URL
 */
export function compressImageToBase64(file, maxWidth = 800, maxHeight = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable.'));

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with specified quality
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Verify approximate size in KB
        const approxSizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
        if (approxSizeKb > 250 && quality > 0.4) {
          // Re-compress if still above threshold
          const lowerQualityUrl = canvas.toDataURL('image/jpeg', 0.5);
          return resolve(lowerQualityUrl);
        }

        resolve(dataUrl);
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Checks honeypot field for anti-spam.
 * @param {HTMLFormElement} form 
 * @param {string} fieldName 
 * @returns {boolean} True if clean, False if bot filled it out
 */
export function verifyHoneypot(form, fieldName = 'website_trap') {
  const trapField = form.elements[fieldName];
  if (trapField && trapField.value.trim() !== '') {
    return false; // Spam bot detected
  }
  return true;
}

/**
 * Checks client-side cooldown rate limit
 * @param {string} key 
 * @param {number} cooldownSeconds 
 * @returns {{ allowed: boolean, remainingSeconds: number }}
 */
export function checkRateLimit(key, cooldownSeconds = 15) {
  const storageKey = `rate_limit_${key}`;
  const lastTime = localStorage.getItem(storageKey);
  const now = Date.now();
  if (lastTime) {
    const elapsed = (now - Number(lastTime)) / 1000;
    if (elapsed < cooldownSeconds) {
      return {
        allowed: false,
        remainingSeconds: Math.ceil(cooldownSeconds - elapsed)
      };
    }
  }
  localStorage.setItem(storageKey, String(now));
  return { allowed: true, remainingSeconds: 0 };
}

/**
 * Exports data rows to CSV file in browser
 * @param {string} filename 
 * @param {Array<Object>} rows 
 * @param {Array<{ key: string, label: string }>} columns 
 */
export function exportToCSV(filename, rows, columns) {
  if (!rows || !rows.length) {
    showToast('No records available to export.', 'info');
    return;
  }

  const headerRow = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const dataRows = rows.map(row => {
    return columns.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) val = '';
      if (val instanceof Date) val = val.toISOString();
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
