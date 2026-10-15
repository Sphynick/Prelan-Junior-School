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

/* ==========================================================================
   ADMISSION APPLICATION (shared by the public form and the admin dashboard)
   One schema drives: the form markup, validation, the admin detail view and
   the CSV export, so the two forms can never drift apart.
   ========================================================================== */

export const APPLICATION_STATUSES = [
  "New",
  "Under Review",
  "Assessment Scheduled",
  "Accepted",
  "Waitlisted",
  "Enrolled",
  "Declined"
];

const GRADE_OPTIONS = [
  ["PP1", "Pre-Primary 1 (PP1 · age 4)"],
  ["PP2", "Pre-Primary 2 (PP2 · age 5)"],
  ["Grade 1", "Grade 1 (age 6)"],
  ["Grade 2", "Grade 2 (age 7)"],
  ["Grade 3", "Grade 3 (age 8)"],
  ["Grade 4", "Grade 4 (age 9)"],
  ["Grade 5", "Grade 5 (age 10)"],
  ["Grade 6", "Grade 6 (age 11)"]
];

/**
 * Field definitions.  req = required on the public form,
 * officeReq = also required when staff enter an application manually.
 */
const APP_FIELDS = {
  childFirst:   { label: "Learner's first name", ph: "First name", req: true, officeReq: true },
  childSecond:  { label: "Learner's second name", ph: "Second name", req: true, officeReq: true },
  childThird:   { label: "Learner's third name", ph: "Third name (optional)" },
  dob:          { label: "Date of birth", type: "date", req: true },
  gender:       { label: "Gender", type: "select", options: [["Female", "Female"], ["Male", "Male"]], req: true },
  birthCertNo:  { label: "Birth certificate number", ph: "As written on the certificate" },
  nationality:  { label: "Nationality", def: "Kenyan" },
  grade:        { label: "Grade applying for", type: "select", options: GRADE_OPTIONS, req: true, officeReq: true },
  intake:       { label: "Preferred intake (term and year)", ph: "e.g. Term 1 2027", req: true },
  previousSchool: { label: "Previous school (if any)", ph: "Name of previous school" },
  lastClass:    { label: "Last class attended", ph: "e.g. Grade 2" },
  reasonLeaving:{ label: "Reason for leaving previous school", ph: "Optional" },
  residence:    { label: "Home area / estate / village", ph: "e.g. Nyathuna, Ngecha", req: true },
  transport:    { label: "Needs school transport?", type: "select", options: [["No", "No"], ["Yes", "Yes"]], def: "No" },
  medical:      { label: "Allergies, medical conditions or medication", type: "textarea", ph: "Write 'None' if not applicable" },
  specialNeeds: { label: "Learning support or special needs", type: "textarea", ph: "Anything the teachers should know to support your child" },
  parentFirst:  { label: "Parent / guardian first name", ph: "First name", req: true, officeReq: true },
  parentSecond: { label: "Parent / guardian second name", ph: "Second name", req: true, officeReq: true },
  parentThird:  { label: "Parent / guardian third name", ph: "Third name (optional)" },
  relationship: { label: "Relationship to the learner", type: "select", options: [["Mother", "Mother"], ["Father", "Father"], ["Guardian", "Guardian"], ["Other", "Other"]], req: true },
  parentId:     { label: "National ID number", ph: "Optional" },
  phone:        { label: "Phone number (M-Pesa / WhatsApp)", type: "tel", ph: "e.g. 0712 345 678", hint: "Kenyan format: 07XX / 01XX / +254", req: true, officeReq: true },
  altPhone:     { label: "Alternative phone", type: "tel", ph: "Optional" },
  email:        { label: "Email", type: "email", ph: "parent@example.com" },
  occupation:   { label: "Occupation", ph: "Optional" },
  address:      { label: "Postal / residential address", ph: "e.g. P.O. Box 123, Kikuyu" },
  parent2Name:  { label: "Full name", ph: "Optional" },
  parent2Relationship: { label: "Relationship to the learner", type: "select", options: [["", "Select"], ["Mother", "Mother"], ["Father", "Father"], ["Guardian", "Guardian"], ["Other", "Other"]] },
  parent2Phone: { label: "Phone number", type: "tel", ph: "Optional" },
  emergencyName: { label: "Emergency contact name", ph: "Someone we can reach if parents cannot be reached", req: true },
  emergencyRelationship: { label: "Relationship", ph: "e.g. Aunt, Neighbour", req: true },
  emergencyPhone: { label: "Emergency contact phone", type: "tel", ph: "e.g. 0722 000 000", req: true }
};

/** Form layout. A row is an array of field names; {legend, f} groups name boxes under one legend. */
const APP_SECTIONS = [
  { title: "Learner's details", rows: [
    { legend: "Learner's name", f: ["childFirst", "childSecond", "childThird"] },
    ["dob", "gender"], ["birthCertNo", "nationality"], ["grade", "intake"]
  ]},
  { title: "Previous school", note: "Skip this section for a first-time (Pre-Primary) learner.", rows: [
    ["previousSchool", "lastClass"], ["reasonLeaving"]
  ]},
  { title: "Home & transport", rows: [["residence", "transport"]] },
  { title: "Health & learning needs", rows: [["medical"], ["specialNeeds"]] },
  { title: "Parent / guardian", rows: [
    { legend: "Parent / guardian name", f: ["parentFirst", "parentSecond", "parentThird"] },
    ["relationship", "parentId"], ["phone", "altPhone"], ["email", "occupation"], ["address"]
  ]},
  { title: "Second parent / guardian (optional)", rows: [["parent2Name", "parent2Relationship"], ["parent2Phone"]] },
  { title: "Emergency contact", rows: [["emergencyName", "emergencyRelationship"], ["emergencyPhone"]] }
];

const APP_DOCUMENTS = [
  "Birth certificate copy",
  "Two passport-size photos",
  "Previous school report (transfers)",
  "Parent / guardian ID copy"
];

function fieldHtml(name, pfx, office, inLegend) {
  const d = APP_FIELDS[name];
  const id = `${pfx}-${name}`;
  const required = !office && d.req;
  const star = required ? ' <span style="color:#b42318">*</span>' : "";
  const common = `id="${id}" name="${name}" class="form-control"${d.ph ? ` placeholder="${escapeHtml(d.ph)}"` : ""}${inLegend ? ` aria-label="${escapeHtml(d.label)}"` : ""}${required ? " required" : ""}`;
  let control;
  if (d.type === "select") {
    const opts = d.options.map(([v, t]) => `<option value="${escapeHtml(v)}"${d.def === v ? " selected" : ""}>${escapeHtml(t)}</option>`).join("");
    const blank = d.options.some(o => o[0] === "") ? "" : `<option value="" disabled${d.def ? "" : " selected"}>Select</option>`;
    control = `<select ${common}>${blank}${opts}</select>`;
  } else if (d.type === "textarea") {
    control = `<textarea ${common} rows="2"></textarea>`;
  } else {
    control = `<input type="${d.type || "text"}" ${common}${d.def ? ` value="${escapeHtml(d.def)}"` : ""}${d.type === "date" ? ' max="' + new Date().toISOString().slice(0, 10) + '"' : ""}>`;
  }
  if (inLegend) return `<div class="form-group">${control}</div>`;
  return `<div class="form-group"><label class="form-label" for="${id}">${escapeHtml(d.label)}${star}</label>${control}${d.hint ? `<span class="form-hint">${escapeHtml(d.hint)}</span>` : ""}</div>`;
}

/**
 * Builds the whole application form body into `container`.
 * office = true is used by staff in the admin dashboard (fewer required fields,
 * no declaration tick-box).
 */
export function renderApplicationForm(container, { office = false, idPrefix = "ap" } = {}) {
  if (!container) return;
  let html = office ? "" : '<input type="text" name="website_trap" class="website-trap" tabindex="-1" autocomplete="off" aria-hidden="true">';

  APP_SECTIONS.forEach((sec, i) => {
    html += `<section class="app-section"><h3 class="app-section-title"><span class="app-num">${i + 1}</span>${escapeHtml(sec.title)}</h3>`;
    if (sec.note) html += `<p class="form-hint" style="margin:-4px 0 12px">${escapeHtml(sec.note)}</p>`;
    html += '<div class="app-section-body">';
    sec.rows.forEach((row) => {
      if (Array.isArray(row)) {
        const cells = row.map(n => fieldHtml(n, idPrefix, office, false)).join("");
        html += row.length === 2 ? `<div class="form-grid form-grid-2">${cells}</div>` : cells;
      } else {
        const star = !office ? ' <span style="color:#b42318">*</span>' : "";
        html += `<fieldset class="name-fieldset"><legend>${escapeHtml(row.legend)}${star}</legend><div class="name-row">${row.f.map(n => fieldHtml(n, idPrefix, office, true)).join("")}</div></fieldset>`;
      }
    });
    html += "</div></section>";
  });

  const docs = APP_DOCUMENTS.map(d => `<label class="check-inline"><input type="checkbox" name="documents" value="${escapeHtml(d)}"> ${escapeHtml(d)}</label>`).join("");
  html += `<section class="app-section"><h3 class="app-section-title"><span class="app-num">${APP_SECTIONS.length + 1}</span>Documents ${office ? "received" : "you will bring"}</h3><p class="form-hint" style="margin:-4px 0 12px">${office ? "Tick the documents already received by the school office." : "Tick what you already have. You can submit the rest at the school office."}</p><div class="check-grid">${docs}</div></section>`;

  if (!office) {
    html += `<section class="app-section"><label class="check-inline consent"><input type="checkbox" name="consent" value="yes"> <span>I confirm that the information given is true and I consent to Prelan Junior School storing and using it for admission and school administration, in line with the Kenya Data Protection Act, 2019. <span style="color:#b42318">*</span></span></label></section>`;
  }
  container.innerHTML = html;
}

/** Short reference the parent can quote, e.g. PJS-261014-K7Q2 */
export function generateReference() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 4; i++) tail += chars[Math.floor(Math.random() * chars.length)];
  return `PJS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${tail}`;
}

/**
 * Reads + validates the application form.
 * Returns { ok:true, data } or { ok:false, field, message }.
 */
export function collectApplication(form, { office = false } = {}) {
  const val = (n) => {
    const el = form.elements[n];
    return el && el.value !== undefined && el.type !== "checkbox" ? String(el.value).trim() : "";
  };
  const fail = (field, message) => ({ ok: false, field, message });

  for (const [name, d] of Object.entries(APP_FIELDS)) {
    const needed = office ? d.officeReq : d.req;
    if (needed && !val(name)) {
      return fail(name, `Please fill in: ${d.label}.`);
    }
  }

  const data = {};
  Object.keys(APP_FIELDS).forEach((n) => { data[n] = val(n); });

  // Date of birth sanity check
  if (data.dob) {
    const born = new Date(data.dob);
    const now = new Date();
    const age = (now - born) / (365.25 * 24 * 3600 * 1000);
    if (isNaN(born.getTime()) || age < 2 || age > 16) {
      return fail("dob", "Please check the learner's date of birth.");
    }
  }

  // Phones
  for (const n of ["phone", "altPhone", "parent2Phone", "emergencyPhone"]) {
    if (data[n]) {
      const r = validateKenyanPhone(data[n]);
      if (!r.valid) return fail(n, `${APP_FIELDS[n].label}: ${r.message}`);
      data[n] = r.formatted;
    }
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return fail("email", "Please enter a valid email address.");
  }

  const consent = form.elements["consent"];
  if (!office && !(consent && consent.checked)) {
    return fail("consent", "Please tick the declaration at the bottom of the form.");
  }

  data.childName = [data.childFirst, data.childSecond, data.childThird].filter(Boolean).join(" ");
  data.parentName = [data.parentFirst, data.parentSecond, data.parentThird].filter(Boolean).join(" ");
  data.documents = Array.from(form.querySelectorAll('input[name="documents"]:checked')).map((c) => c.value);
  data.consent = true;
  return { ok: true, data };
}

/** Sections shown in the admin "review application" window */
export const APPLICATION_DETAIL = [
  { title: "Learner", items: [["Name", "childName"], ["Date of birth", "dob"], ["Gender", "gender"], ["Birth cert. no.", "birthCertNo"], ["Nationality", "nationality"], ["Grade applying for", "grade"], ["Preferred intake", "intake"]] },
  { title: "Previous school", items: [["School", "previousSchool"], ["Last class", "lastClass"], ["Reason for leaving", "reasonLeaving"]] },
  { title: "Home & health", items: [["Home area", "residence"], ["School transport", "transport"], ["Medical / allergies", "medical"], ["Learning support needs", "specialNeeds"]] },
  { title: "Parent / guardian", items: [["Name", "parentName"], ["Relationship", "relationship"], ["ID number", "parentId"], ["Phone", "phone"], ["Alt. phone", "altPhone"], ["Email", "email"], ["Occupation", "occupation"], ["Address", "address"]] },
  { title: "Second parent / guardian", items: [["Name", "parent2Name"], ["Relationship", "parent2Relationship"], ["Phone", "parent2Phone"]] },
  { title: "Emergency contact", items: [["Name", "emergencyName"], ["Relationship", "emergencyRelationship"], ["Phone", "emergencyPhone"]] }
];
