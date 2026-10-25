
(() => {
  "use strict";

  const STORAGE = Object.freeze({
    workspace: "nexoraHcmWorkspace",
    setupComplete: "nexoraHcmSetupComplete",
    rememberedEmail: "nexoraHcmRememberedEmail",
    employees: "nexoraHcmEmployees",
    attendance: "nexoraHcmAttendance",
    leaves: "nexoraHcmLeaveRequests",
    preferences: "nexoraHcmPreferences"
  });

  let storageWarningShown = false;
  const unreadableStorageKeys = new Set();
  function reportStorageIssue(message) {
    if (storageWarningShown || !document.body) return;
    storageWarningShown = true;
    const warning = document.createElement("div");
    warning.className = "alert alert-warning storage-recovery-alert";
    warning.setAttribute("role", "alert");
    warning.textContent = `${message} Existing stored values have not been deleted. Check browser storage before making changes.`;
    const target = document.querySelector(".page-container") || document.querySelector(".auth-panel__inner") || document.body;
    target.prepend(warning);
  }

  function markStorageUnreadable(key, message) {
    unreadableStorageKeys.add(key);
    reportStorageIssue(message);
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      try {
        const value = JSON.parse(raw);
        if (value === null || value === undefined) return fallback;
        return value;
      } catch (error) {
        console.warn(`Saved value for ${key} is not valid JSON; the original value was preserved.`, error);
        markStorageUnreadable(key, `Saved data for “${key}” could not be read.`);
        return fallback;
      }
    } catch (error) {
      console.warn(`Browser storage is unavailable while reading ${key}.`, error);
      reportStorageIssue("Browser storage is unavailable.");
      return fallback;
    }
  }

  function localDateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function writeJSON(key, value) {
    if (unreadableStorageKeys.has(key)) {
      console.warn(`Saving to ${key} was blocked to protect its unreadable original value.`);
      reportStorageIssue(`Saving to “${key}” was blocked because its original value could not be read.`);
      return false;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save local demo data for ${key}.`, error);
      return false;
    }
  }

  function text(value, fallback = "—") {
    if (value === null || value === undefined || String(value).trim() === "") return fallback;
    return String(value).trim();
  }

  function formatDate(value) {
    if (!value) return "—";
    const raw = String(value).slice(0, 10);
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "—";
    let preferences = {};
    const settings = readJSON("hcmLiteSettings", {});
    if (settings && typeof settings === "object" && settings.preferences) preferences = settings.preferences;
    const day = String(date.getDate()).padStart(2, "0"), month = String(date.getMonth() + 1).padStart(2, "0"), year = date.getFullYear();
    if (preferences.dateFormat === "iso") return `${year}-${month}-${day}`;
    if (preferences.dateFormat === "mdy") return `${month}/${day}/${year}`;
    if (preferences.dateFormat === "dmy") return `${day}/${month}/${year}`;
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function getWorkspace() {
    const value = readJSON(STORAGE.workspace, {});
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      markStorageUnreadable(STORAGE.workspace, `Saved data for “${STORAGE.workspace}” has an unexpected structure.`);
      return {};
    }
    return value;
  }

  function initials(name) {
    const parts = text(name, "Employee").split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
  }

  function make(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function setFeedback(element, message, type = "info") {
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
    element.classList.remove("is-error", "is-success");
    if (type === "error") element.classList.add("is-error");
    if (type === "success") element.classList.add("is-success");
  }

  function initSharedShell() {
    const sidebar = document.querySelector(".app-sidebar");
    const toggle = document.querySelector("[data-sidebar-toggle]");
    const backdrop = document.querySelector(".sidebar-backdrop");
    const setOpen = (open) => {
      if (!sidebar) return;
      sidebar.classList.toggle("is-open", open);
      backdrop?.classList.toggle("is-visible", open);
      document.body.classList.toggle("sidebar-open", open);
      toggle?.setAttribute("aria-expanded", String(open));
    };
    const clearDemoSession = () => {
      try { sessionStorage.removeItem("nexoraHcmDemoSession"); }
      catch (error) { console.warn("Demo session could not be cleared from session storage.", error); }
      try { localStorage.removeItem("nexoraHcmCurrentEmployee"); }
      catch (error) { console.warn("The remembered employee selection could not be cleared.", error); }
    };
    const showDemoNotice = (message) => {
      let notice = document.getElementById("hcm-demo-notice");
      if (!notice) {
        notice = make("div", "hcm-demo-notice");
        notice.id = "hcm-demo-notice";
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        document.body.append(notice);
      }
      notice.textContent = message;
      notice.classList.add("is-visible");
      window.clearTimeout(notice.dismissTimer);
      notice.dismissTimer = window.setTimeout(() => notice.classList.remove("is-visible"), 3600);
    };
    const closeProfileMenus = () => document.querySelectorAll(".profile-menu-popover").forEach((menu) => {
      menu.hidden = true;
      menu.previousElementSibling?.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll("[data-profile-menu]").forEach((profile) => {
      if (profile.tagName !== "BUTTON") { profile.setAttribute("role", "button"); profile.setAttribute("tabindex", "0"); }
      profile.setAttribute("aria-haspopup", "true");
      profile.setAttribute("aria-expanded", "false");
      const menu = make("div", "profile-menu-popover");
      menu.hidden = true;
      [["setting.html", "bi-gear", "Settings"], ["employee.html", "bi-person-badge", "Employee Portal"], ["index.html", "bi-box-arrow-right", "Sign Out"]].forEach(([href, icon, label]) => {
        const link = make("a", "profile-menu-popover__link");
        link.href = href;
        link.append(make("i", `bi ${icon}`), make("span", "", label));
        if (href === "index.html") {
          link.classList.add("profile-menu-popover__link--signout");
          link.addEventListener("click", clearDemoSession);
        }
        menu.append(link);
      });
      profile.insertAdjacentElement("afterend", menu);
      const toggleProfile = (event) => {
        if (event) event.preventDefault();
        const shouldOpen = menu.hidden;
        closeProfileMenus();
        menu.hidden = !shouldOpen;
        profile.setAttribute("aria-expanded", String(shouldOpen));
      };
      profile.addEventListener("click", toggleProfile);
      profile.addEventListener("keydown", (event) => {
        if (profile.tagName !== "BUTTON" && (event.key === "Enter" || event.key === " ")) toggleProfile(event);
      });
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-profile-menu]") && !event.target.closest(".profile-menu-popover")) closeProfileMenus();
    });
    document.querySelectorAll(".notification-button").forEach((button) => button.addEventListener("click", () => showDemoNotice("Notifications are a visual demo only; no email, SMS, or push messages are sent.")));
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    sidebar?.querySelectorAll("a[href]").forEach((link) => {
      const destination = link.getAttribute("href");
      if (["admin.html", "employees.html", "attendance.html", "leaves.html", "employee.html", "payship.html", "setting.html"].includes(destination)) {
        const active = destination === currentPage;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
      if (destination === "index.html") link.dataset.signOut = "true";
    });
    toggle?.addEventListener("click", () => setOpen(!sidebar?.classList.contains("is-open")));
    document.querySelectorAll("[data-global-search]").forEach((form) => form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input[name='q']");
      const query = input?.value.trim().slice(0, 120) || "";
      window.location.href = query ? `employees.html?q=${encodeURIComponent(query)}` : "employees.html";
    }));
    backdrop?.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { setOpen(false); closeProfileMenus(); } });
    sidebar?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      if (link.dataset.signOut === "true") clearDemoSession();
      if (window.innerWidth < 1200) setOpen(false);
    }));
    if (window.bootstrap?.Tooltip) {
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => window.bootstrap.Tooltip.getOrCreateInstance(element));
    }
    document.querySelectorAll("[data-current-year]").forEach((element) => { element.textContent = String(new Date().getFullYear()); });
    const now = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date());
    document.querySelectorAll("[data-current-date]").forEach((element) => { element.textContent = now; });
    document.querySelectorAll("[data-dismiss-alert]").forEach((button) => button.addEventListener("click", () => button.closest(".alert")?.remove()));
    const refreshWorkspaceLabels = () => {
      const workspace = getWorkspace();
      document.querySelectorAll("[data-company-name]").forEach((element) => { element.textContent = text(workspace?.companyName, "Nexora HR Solutions"); });
      document.querySelectorAll("[data-admin-name]").forEach((element) => { element.textContent = text(workspace?.adminName, "Admin User"); });
    };
    refreshWorkspaceLabels();
    window.addEventListener("storage", (event) => { if ([STORAGE.workspace, "hcmLiteSettings"].includes(event.key) || event.key === null) refreshWorkspaceLabels(); });
    window.addEventListener("nexora:settings-changed", (event) => {
      const companyName = event.detail?.company?.companyName;
      if (companyName) document.querySelectorAll("[data-company-name]").forEach((element) => { element.textContent = companyName; });
    });
  }

  function initLogin() {
    const form = document.getElementById("login-form");
    if (!form) return;
    const email = document.getElementById("login-email");
    const password = document.getElementById("login-password");
    const role = document.getElementById("login-role");
    const remember = document.getElementById("remember-email");
    const feedback = document.getElementById("login-feedback");
    const submit = document.getElementById("login-submit");
    const togglePassword = document.getElementById("toggle-password");
    const workspace = getWorkspace();
    const welcomeCopy = document.getElementById("auth-welcome-copy");
    if (workspace.companyName && welcomeCopy) welcomeCopy.textContent = `Sign in to continue to ${workspace.companyName}.`;
    let savedEmail = "";
    try { savedEmail = localStorage.getItem(STORAGE.rememberedEmail) || ""; }
    catch (error) { console.warn("Remembered email is unavailable because browser storage could not be read.", error); }
    if (savedEmail && email) { email.value = savedEmail; if (remember) remember.checked = true; }

    togglePassword?.addEventListener("click", () => {
      const visible = password.type === "password";
      password.type = visible ? "text" : "password";
      togglePassword.setAttribute("aria-label", visible ? "Hide password" : "Show password");
      togglePassword.setAttribute("aria-pressed", String(visible));
      const icon = togglePassword.querySelector("i");
      if (icon) icon.className = visible ? "bi bi-eye-slash" : "bi bi-eye";
    });
    email?.addEventListener("input", () => email.classList.remove("is-invalid"));
    password?.addEventListener("input", () => password.classList.remove("is-invalid"));
    document.getElementById("forgot-password")?.addEventListener("click", (event) => {
      event.preventDefault();
      setFeedback(feedback, "This is a demo workspace, so no password reset is needed. Enter any valid email and a non-empty password to continue.", "info");
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      setFeedback(feedback, "");
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      email.classList.toggle("is-invalid", !validEmail);
      password.classList.toggle("is-invalid", !password.value);
      if (!validEmail || !password.value) {
        setFeedback(feedback, "Please correct the highlighted fields to continue.", "error");
        form.querySelector(":invalid")?.focus();
        return;
      }
      try {
        if (remember?.checked) localStorage.setItem(STORAGE.rememberedEmail, email.value.trim());
        else localStorage.removeItem(STORAGE.rememberedEmail);
      } catch (error) { console.warn("The optional remembered-email preference could not be saved.", error); }
      try { sessionStorage.setItem("nexoraHcmDemoSession", JSON.stringify({ role: role.value, email: email.value.trim(), startedAt: new Date().toISOString() })); }
      catch (error) { console.warn("Demo session could not be saved to session storage.", error); }
      submit.disabled = true;
      const label = submit.querySelector("span");
      const oldLabel = label?.textContent;
      if (label) label.textContent = "Opening your workspace…";
      setFeedback(feedback, "Demo details accepted. Opening your workspace…", "success");
      window.setTimeout(() => {
        window.location.href = role.value === "employee" ? "employee.html" : "admin.html";
      }, 300);
      window.setTimeout(() => { submit.disabled = false; if (label) label.textContent = oldLabel || "Sign in to HCM Lite"; }, 1800);
    });

    const setupForm = document.getElementById("setup-form");
    setupForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const company = document.getElementById("setup-company");
      const admin = document.getElementById("setup-admin");
      const adminEmail = document.getElementById("setup-email");
      const inputs = [company, admin, adminEmail];
      let valid = true;
      inputs.forEach((input) => {
        const okay = input.value.trim() !== "" && (input.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()));
        input.classList.toggle("is-invalid", !okay);
        valid = valid && okay;
      });
      const setupFeedback = document.getElementById("setup-feedback");
      if (!valid) { setFeedback(setupFeedback, "Please complete all required fields using a valid email address.", "error"); return; }
      const existing = getWorkspace();
      const saved = { ...existing, companyName: company.value.trim(), adminName: admin.value.trim(), adminEmail: adminEmail.value.trim(), updatedAt: new Date().toISOString() };
      if (!writeJSON(STORAGE.workspace, saved)) { setFeedback(setupFeedback, "Your browser could not save this setup. Check local storage permissions and try again.", "error"); return; }
      try { localStorage.setItem(STORAGE.setupComplete, "true"); }
      catch (error) { console.warn("Workspace setup was saved, but its completion flag could not be stored.", error); }
      if (email && !email.value) email.value = saved.adminEmail;
      if (welcomeCopy) welcomeCopy.textContent = `Sign in to continue to ${saved.companyName}.`;
      setFeedback(setupFeedback, `Workspace created for ${saved.companyName}. You can now sign in using demo access.`, "success");
      document.querySelectorAll("[data-company-name]").forEach((element) => { element.textContent = saved.companyName; });
      const modal = document.getElementById("setup-modal");
      window.setTimeout(() => { if (window.bootstrap?.Modal && modal) window.bootstrap.Modal.getOrCreateInstance(modal).hide(); }, 900);
    });
    setupForm?.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => input.classList.remove("is-invalid")));
  }

  function getEmployees() {
    const data = readJSON(STORAGE.employees, []);
    if (!Array.isArray(data)) { markStorageUnreadable(STORAGE.employees, `Saved data for “${STORAGE.employees}” is not an employee list.`); return []; }
    return data.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  }
  function getLeaves() { const data = readJSON(STORAGE.leaves, []); if (!Array.isArray(data)) { markStorageUnreadable(STORAGE.leaves, `Saved data for “${STORAGE.leaves}” is not a leave-request list.`); return []; } return data.filter((item) => item && typeof item === "object" && !Array.isArray(item)); }
  function getAttendance() { const data = readJSON(STORAGE.attendance, []); if (!Array.isArray(data)) { markStorageUnreadable(STORAGE.attendance, `Saved data for “${STORAGE.attendance}” is not an attendance list.`); return []; } return data.filter((item) => item && typeof item === "object" && !Array.isArray(item)); }

  function initAdminDashboard() {
    if (!document.getElementById("dash-total-employees")) return;
    function renderDashboard() {
    const employees = getEmployees();
    const leaves = getLeaves();
    const attendance = getAttendance();
    const today = localDateKey();
    const todaysAttendance = attendance.filter((item) => item.date === today);
    const present = todaysAttendance.filter((item) => ["present", "late"].includes(String(item.status || "").toLowerCase()));
    const employeeIds = new Set(employees.map((item) => String(item.id)));
    const onLeaveIds = new Set(employees.filter((item) => String(item.status || "").toLowerCase() === "on leave").map((item) => String(item.id)));
    leaves.filter((item) => String(item.status || "").toLowerCase() === "approved" && item.startDate && item.endDate && item.startDate <= today && item.endDate >= today && employeeIds.has(String(item.employeeId))).forEach((item) => onLeaveIds.add(String(item.employeeId)));
    const onLeave = onLeaveIds.size;
    const pending = leaves.filter((item) => String(item.status || "pending").toLowerCase() === "pending").length;
    document.getElementById("dash-total-employees").textContent = employees.length;
    document.getElementById("dash-present").textContent = present.length;
    document.getElementById("dash-on-leave").textContent = onLeave;
    document.getElementById("dash-pending").textContent = pending;
    const attendanceCount = { present: 0, absent: 0, late: 0, leave: 0 };
    todaysAttendance.forEach((record) => { const status = String(record.status || "").toLowerCase(); if (status === "present") attendanceCount.present++; else if (status === "absent") attendanceCount.absent++; else if (status === "late") attendanceCount.late++; else if (["on leave", "leave"].includes(status)) attendanceCount.leave++; });
    [ ["attendance-present-count", attendanceCount.present], ["attendance-absent-count", attendanceCount.absent], ["attendance-late-count", attendanceCount.late], ["attendance-leave-count", attendanceCount.leave] ].forEach(([id, value]) => { document.getElementById(id).textContent = value; });
    const rate = document.getElementById("attendance-rate");
    rate.textContent = todaysAttendance.length ? `${Math.round(((attendanceCount.present + attendanceCount.late) / todaysAttendance.length) * 100)}%` : "—";
    const ring = document.querySelector(".attendance-ring");
    if (ring && todaysAttendance.length) ring.style.background = `conic-gradient(var(--brand-500) ${Math.round((attendanceCount.present / todaysAttendance.length) * 360)}deg, var(--brand-100) 0deg)`;
    const attendanceEmpty = document.getElementById("attendance-empty"); if (attendanceEmpty) attendanceEmpty.hidden = todaysAttendance.length > 0;

    const leaveBody = document.getElementById("dashboard-leaves");
    if (leaveBody) {
      leaveBody.replaceChildren();
      const recentLeaves = leaves.slice().sort((a, b) => String(b.requestDate || "").localeCompare(String(a.requestDate || ""))).slice(0, 5);
      if (!recentLeaves.length) { const tr = make("tr"); const td = make("td"); td.colSpan = 4; td.append(make("div", "dashboard-empty", "")); const empty = td.firstChild; empty.append(make("i", "bi bi-calendar2-check"), make("p", "", "No leave requests yet"), make("span", "", "Saved leave requests will appear here.")); tr.append(td); leaveBody.append(tr); }
      recentLeaves.forEach((item) => { const tr = make("tr"); const employeeTd = make("td"); employeeTd.append(make("strong", "dashboard-table-name", text(item.employeeName, "Employee"))); const typeTd = make("td", "", text(item.leaveType)); const datesTd = make("td", "", `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`); const statusTd = make("td"); const status = text(item.status, "Pending"); statusTd.append(make("span", `employee-status ${status.toLowerCase() === "approved" ? "employee-status--active" : status.toLowerCase() === "rejected" ? "employee-status--inactive" : "employee-status--leave"}`, status)); tr.append(employeeTd, typeTd, datesTd, statusTd); leaveBody.append(tr); });
    }
    const employeeList = document.getElementById("dashboard-employees");
    if (employeeList) {
      employeeList.replaceChildren();
      const recent = employees.slice().sort((a, b) => String(b.joiningDate || "").localeCompare(String(a.joiningDate || ""))).slice(0, 5);
      if (!recent.length) { const empty = make("div", "dashboard-empty"); empty.append(make("i", "bi bi-people"), make("p", "", "No employee records yet"), make("span", "", "Add an employee to get started.")); employeeList.append(empty); }
      recent.forEach((item, index) => { const row = make("div", "dashboard-employee-row"); row.append(make("span", `employee-avatar employee-avatar--${index % 5}`, initials(item.name))); const details = make("span", "dashboard-employee-row__details"); details.append(make("strong", "", text(item.name, "Employee")), make("small", "", `${text(item.jobTitle, "Role not set")} · ${text(item.department, "No department")}`)); row.append(details, make("span", `employee-status dashboard-employee-row__status ${String(item.status).toLowerCase() === "active" ? "employee-status--active" : String(item.status).toLowerCase() === "on leave" ? "employee-status--leave" : "employee-status--inactive"}`, text(item.status, "Active"))); employeeList.append(row); });
    }
    const helper = document.getElementById("smart-helper-list");
    if (helper) {
      helper.replaceChildren(); const suggestions = [];
      if (pending) suggestions.push(["bi bi-calendar2-check", `Review ${pending} pending leave request${pending === 1 ? "" : "s"}.`]);
      if (!attendance.length) suggestions.push(["bi bi-clock-history", "Record attendance to complete today’s overview."]);
      const missing = employees.filter((item) => !item.email || !item.department || !item.jobTitle).length;
      if (missing) suggestions.push(["bi bi-person-lines-fill", `Complete missing details for ${missing} employee profile${missing === 1 ? "" : "s"}.`]);
      if (!employees.length) suggestions.push(["bi bi-person-plus", "Add employee records to start building your directory."]);
      if (!pending && employees.length) suggestions.push(["bi bi-check-circle", "No pending leave requests are recorded right now."]);
      if (!suggestions.length) suggestions.push(["bi bi-clipboard-check", "Your saved records look ready for a routine review."]);
      suggestions.slice(0, 3).forEach(([icon, label]) => { const li = make("li"); li.append(make("i", icon), make("span", "", label)); helper.append(li); });
    }
    const greeting = document.getElementById("dashboard-greeting");
    if (greeting) { const hour = new Date().getHours(); greeting.textContent = `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, Admin`; }
    renderDashboardAnalytics(employees);
    }
    renderDashboard();
    window.addEventListener("storage", (event) => {
      if ([STORAGE.employees, STORAGE.attendance, STORAGE.leaves, MODULE_KEYS.payroll, MODULE_KEYS.settings, STORAGE.workspace].includes(event.key) || event.key === null) renderDashboard();
    });
    ["nexora:employees-changed", "nexora:attendance-changed", "nexora:leaves-changed", "nexora:settings-changed"].forEach((name) => window.addEventListener(name, renderDashboard));
  }

  function renderDashboardAnalytics(employees) {
    const hiringLine = document.getElementById("hiring-pipeline-line");
    if (hiringLine) {
      const hiringPoints = document.getElementById("hiring-pipeline-points");
      if (hiringPoints) hiringPoints.setAttribute("aria-label", "Illustrative hiring pipeline trend; applicant records are not stored in this demo.");
    }
    const chart = document.getElementById("payroll-chart-donut");
    const legend = document.getElementById("payroll-chart-legend");
    const empty = document.getElementById("payroll-chart-empty");
    if (!chart || !legend || !empty) return;
    const records = moduleRead(MODULE_KEYS.payroll, []);
    const payroll = Array.isArray(records) ? records.filter((record) => record && typeof record === "object") : [];
    const totals = new Map();
    payroll.forEach((record) => {
      const employee = employees.find((item) => String(item.id) === String(record.employeeId));
      if (!employee) return;
      const amounts = [record.basicSalary, record.housingAllowance, record.transportAllowance, record.otherAllowances, record.bonus].map((value) => value === undefined || value === null || value === "" ? 0 : Number(value));
      if (!amounts.every((amount) => Number.isFinite(amount) && amount >= 0)) return;
      const department = text(employee.department, "Unassigned department");
      totals.set(department, (totals.get(department) || 0) + amounts.reduce((sum, amount) => sum + amount, 0));
    });
    const entries = [...totals.entries()].filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
    legend.replaceChildren();
    if (!entries.length) {
      chart.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    chart.hidden = false;
    const palette = ["#0C287B", "#0C8EF4", "#8C83E6", "#39A88B", "#E484AC", "#E6A23C", "#66758C"];
    const grandTotal = entries.reduce((sum, [, amount]) => sum + amount, 0);
    let cursor = 0;
    const segments = entries.map(([department, amount], index) => {
      const start = cursor;
      cursor += amount / grandTotal * 100;
      const color = palette[index % palette.length];
      const item = make("div", "payroll-chart-legend-item");
      const swatch = make("span", "payroll-chart-swatch");
      swatch.style.backgroundColor = color;
      swatch.setAttribute("aria-hidden", "true");
      const label = make("span", "payroll-chart-legend-label", department);
      const value = make("strong", "", `${Math.round(amount / grandTotal * 100)}%`);
      item.append(swatch, label, value);
      legend.append(item);
      return `${color} ${start}% ${cursor}%`;
    });
    chart.style.background = `conic-gradient(${segments.join(", ")})`;
    chart.setAttribute("aria-label", `Department payroll earnings distribution based on ${payroll.length} saved payroll record(s).`);
  }

  function initEmployeeManagement() {
    const tableBody = document.getElementById("employee-table-body");
    if (!tableBody) return;
    const form = document.getElementById("employee-form");
    const formModalEl = document.getElementById("employee-form-modal");
    const viewModalEl = document.getElementById("employee-view-modal");
    const deleteModalEl = document.getElementById("employee-delete-modal");
    if (!window.bootstrap?.Modal || !formModalEl || !viewModalEl || !deleteModalEl) return;
    const formModal = window.bootstrap.Modal.getOrCreateInstance(formModalEl);
    const viewModal = window.bootstrap.Modal.getOrCreateInstance(viewModalEl);
    const deleteModal = window.bootstrap.Modal.getOrCreateInstance(deleteModalEl);
    const fields = { id: document.getElementById("employee-record-id"), name: document.getElementById("employee-name"), email: document.getElementById("employee-email"), phone: document.getElementById("employee-phone"), department: document.getElementById("employee-department"), jobTitle: document.getElementById("employee-job-title"), joiningDate: document.getElementById("employee-joining-date"), status: document.getElementById("employee-status"), notes: document.getElementById("employee-notes") };
    const search = document.getElementById("employee-search"); const departmentFilter = document.getElementById("employee-department-filter"); const statusFilter = document.getElementById("employee-status-filter");
    let editingId = null; let selectedId = null; let deletingId = null;
    const currentEmployees = () => getEmployees();
    const initialQuery = new URLSearchParams(window.location.search).get("q");
    if (initialQuery) search.value = initialQuery.slice(0, 120);
    const saveEmployees = (list) => { if (!writeJSON(STORAGE.employees, list)) { showAlert("Could not save records. Your browser may be blocking local storage.", "danger"); return false; } window.dispatchEvent(new CustomEvent("nexora:employees-changed", { detail: { count: list.length } })); return true; };
    function showAlert(message, type = "success") { const alert = document.getElementById("employee-alert"); if (!alert) return; alert.className = `alert alert-${type} employee-alert`; alert.textContent = message; alert.hidden = false; window.setTimeout(() => { if (alert.textContent === message) alert.hidden = true; }, 4200); }
    function showToast(message, title = "Changes saved") { const toastEl = document.getElementById("employee-toast"); if (!toastEl || !window.bootstrap?.Toast) { showAlert(message); return; } document.getElementById("employee-toast-title").textContent = title; document.getElementById("employee-toast-message").textContent = message; window.bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3200 }).show(); }
    function statusClass(status) { return status === "Active" ? "employee-status--active" : status === "On Leave" ? "employee-status--leave" : "employee-status--inactive"; }
    function renderSummary(list) {
      document.getElementById("employee-total").textContent = list.length;
      document.getElementById("employee-active").textContent = list.filter((item) => text(item.status, "Active") === "Active").length;
      document.getElementById("employee-on-leave").textContent = list.filter((item) => text(item.status) === "On Leave").length;
      document.getElementById("employee-departments").textContent = new Set(list.map((item) => text(item.department, "").toLowerCase()).filter(Boolean)).size;
    }
    function renderDepartmentFilter(list) {
      const selected = departmentFilter.value;
      departmentFilter.replaceChildren(new Option("All departments", ""));
      [...new Map(list.map((item) => [text(item.department, "").trim().toLowerCase(), text(item.department, "").trim()]).filter(([key, value]) => key && value)).values()].sort((a,b) => a.localeCompare(b)).forEach((department) => departmentFilter.add(new Option(department, department)));
      if ([...departmentFilter.options].some((option) => option.value === selected)) departmentFilter.value = selected;
    }
    function createAction(label, icon, action, extraClass = "") { const button = make("button", `employee-action-btn ${extraClass}`, ""); button.type = "button"; button.setAttribute("aria-label", `${label} employee`); button.title = `${label} employee`; button.dataset.action = action; button.append(make("i", `bi ${icon}`)); return button; }
    function renderTable() {
      const all = currentEmployees(); renderSummary(all); renderDepartmentFilter(all);
      const query = search.value.trim().toLowerCase(); const department = departmentFilter.value; const status = statusFilter.value;
      const filtered = all.filter((item) => {
        const haystack = [item.id, item.name, item.email, item.jobTitle, item.department].map((value) => text(value, "").toLowerCase()).join(" ");
        return (!query || haystack.includes(query)) && (!department || text(item.department, "") === department) && (!status || text(item.status, "Active") === status);
      });
      tableBody.replaceChildren();
      const countText = `${filtered.length} ${filtered.length === 1 ? "employee" : "employees"}`;
      document.getElementById("employee-result-count").textContent = countText;
      document.getElementById("employee-table-summary").textContent = `Showing ${filtered.length} of ${all.length} employees`;
      if (!filtered.length) {
        const row = make("tr"); const cell = make("td"); cell.colSpan = 7;
        const empty = make("div", "employee-empty-state"); empty.append(make("span", "employee-empty-state__icon")); empty.firstChild.append(make("i", "bi bi-search"));
        empty.append(make("h3", "", all.length ? "No matching employees" : "Your directory starts here"), make("p", "", all.length ? "Try adjusting your search or filters to find a matching record." : "Add your first employee to build a central place for your people records."));
        if (!all.length) { const add = make("button", "btn btn-primary btn-sm", "Add first employee"); add.type = "button"; add.dataset.emptyAdd = "true"; add.prepend(make("i", "bi bi-plus-lg me-1")); empty.append(add); }
        cell.append(empty); row.append(cell); tableBody.append(row); return;
      }
      filtered.forEach((employee, index) => {
        const row = make("tr"); const personCell = make("td"); const person = make("div", "employee-person"); person.append(make("span", `employee-avatar employee-avatar--${index % 5}`, initials(employee.name)));
        const details = make("span", "employee-person__details"); details.append(make("strong", "", text(employee.name, "Employee")), make("small", "", text(employee.email, "No email provided"))); person.append(details); personCell.append(person);
        row.append(personCell, make("td", "employee-id", text(employee.id)), make("td", "", text(employee.department)), make("td", "", text(employee.jobTitle)), make("td", "", formatDate(employee.joiningDate)));
        const statusCell = make("td"); const status = text(employee.status, "Active"); statusCell.append(make("span", `employee-status ${statusClass(status)}`, status)); row.append(statusCell);
        const actions = make("td"); const actionGroup = make("div", "employee-actions"); actionGroup.append(createAction("View", "bi-eye", "view"), createAction("Edit", "bi-pencil", "edit"), createAction("Delete", "bi-trash3", "delete", "employee-action-btn--delete")); actionGroup.querySelectorAll("button").forEach((button) => { button.dataset.employeeId = text(employee.id, ""); }); actions.append(actionGroup); row.append(actions); tableBody.append(row);
      });
    }
    function resetForm() { form.reset(); editingId = null; fields.id.value = ""; form.classList.remove("was-validated"); form.querySelectorAll(".is-invalid,.is-valid").forEach((element) => element.classList.remove("is-invalid", "is-valid")); const feedback = document.getElementById("employee-form-feedback"); feedback.hidden = true; feedback.textContent = ""; document.getElementById("employee-form-title").textContent = "Add New Employee"; const submit = document.getElementById("employee-form-submit"); submit.replaceChildren(make("i", "bi bi-person-plus me-1"), document.createTextNode("Add Employee")); }
    function openAdd() { resetForm(); fields.joiningDate.value = localDateKey(); formModal.show(); window.setTimeout(() => fields.name.focus(), 180); }
    function openEdit(id) { const employee = currentEmployees().find((item) => String(item.id) === String(id)); if (!employee) return; resetForm(); editingId = employee.id; fields.id.value = employee.id; fields.name.value = text(employee.name, ""); fields.email.value = text(employee.email, ""); fields.phone.value = text(employee.phone, ""); fields.department.value = text(employee.department, ""); fields.jobTitle.value = text(employee.jobTitle, ""); fields.joiningDate.value = text(employee.joiningDate, ""); fields.status.value = text(employee.status, "Active"); fields.notes.value = text(employee.notes, ""); document.getElementById("employee-form-title").textContent = "Edit Employee"; const submit = document.getElementById("employee-form-submit"); submit.replaceChildren(make("i", "bi bi-check2 me-1"), document.createTextNode("Save changes")); formModal.show(); window.setTimeout(() => fields.name.focus(), 180); }
    function openView(id) {
      const employee = currentEmployees().find((item) => String(item.id) === String(id)); if (!employee) return; selectedId = employee.id;
      const content = document.getElementById("employee-view-content"); content.replaceChildren();
      const header = make("div", "employee-detail-header"); header.append(make("span", `employee-avatar employee-avatar--${Math.abs(String(employee.id).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 5}`, initials(employee.name)));
      const identity = make("div"); identity.append(make("h3", "", text(employee.name, "Employee")), make("p", "", text(employee.jobTitle, "Role not set"))); header.append(identity, make("span", `employee-status ms-auto ${statusClass(text(employee.status, "Active"))}`, text(employee.status, "Active"))); content.append(header);
      const grid = make("div", "employee-detail-grid"); [["Employee ID", employee.id], ["Email address", employee.email], ["Phone number", employee.phone], ["Department", employee.department], ["Job title", employee.jobTitle], ["Joining date", formatDate(employee.joiningDate)], ["Employment status", employee.status], ["Notes", employee.notes]].forEach(([label, value]) => { const field = make("div", "employee-detail-field"); field.append(make("span", "", label), make("strong", "", text(value))); grid.append(field); }); content.append(grid); viewModal.show();
    }
    function openDelete(id) { const employee = currentEmployees().find((item) => String(item.id) === String(id)); if (!employee) return; deletingId = employee.id; document.getElementById("employee-delete-name").textContent = text(employee.name, "this employee"); deleteModal.show(); }
    function generateId(list) { const used = new Set(list.map((item) => String(item.id || "").toUpperCase())); let next = 1001; while (used.has(`EMP-${next}`)) next++; return `EMP-${next}`; }
    function validateForm() {
      let valid = true; const name = fields.name.value.trim(); const emailValue = fields.email.value.trim(); const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
      const required = [fields.name, fields.email, fields.department, fields.jobTitle, fields.joiningDate, fields.status];
      required.forEach((field) => { const okay = field.value.trim() !== ""; field.classList.toggle("is-invalid", !okay); valid = valid && okay; });
      fields.email.classList.toggle("is-invalid", !emailValid);
      if (!emailValid) valid = false;
      const duplicate = currentEmployees().some((item) => String(item.email || "").trim().toLowerCase() === emailValue.toLowerCase() && String(item.id) !== String(editingId));
      if (duplicate) { fields.email.classList.add("is-invalid"); const feedback = fields.email.parentElement.querySelector(".invalid-feedback"); if (feedback) feedback.textContent = "This email address is already assigned to another employee."; valid = false; }
      else { const feedback = fields.email.parentElement.querySelector(".invalid-feedback"); if (feedback) feedback.textContent = "Enter a valid email address."; }
      if (fields.joiningDate.value && Number.isNaN(new Date(`${fields.joiningDate.value}T00:00:00`).getTime())) { fields.joiningDate.classList.add("is-invalid"); valid = false; }
      if (!name) fields.name.classList.add("is-invalid");
      return valid;
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault(); const feedback = document.getElementById("employee-form-feedback"); feedback.hidden = true;
      if (!validateForm()) { form.classList.add("was-validated"); feedback.textContent = "Please review the highlighted fields. Email addresses must be valid and unique."; feedback.hidden = false; form.querySelector(".is-invalid")?.focus(); return; }
      const list = currentEmployees(); const existingIndex = list.findIndex((item) => String(item.id) === String(editingId));
      const record = { id: editingId || generateId(list), name: fields.name.value.trim(), email: fields.email.value.trim(), phone: fields.phone.value.trim(), department: fields.department.value.trim(), jobTitle: fields.jobTitle.value.trim(), joiningDate: fields.joiningDate.value, status: fields.status.value, notes: fields.notes.value.trim() };
      if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...record }; else list.push(record);
      if (!saveEmployees(list)) return;
      renderTable(); formModal.hide(); resetForm(); showToast(existingIndex >= 0 ? "Employee details updated successfully." : `${record.name} was added to the directory.`, existingIndex >= 0 ? "Employee updated" : "Employee added");
    });
    tableBody.addEventListener("click", (event) => {
      const emptyAdd = event.target.closest("[data-empty-add]");
      if (emptyAdd) { openAdd(); return; }
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.employeeId;
      if (button.dataset.action === "view") openView(id);
      else if (button.dataset.action === "edit") openEdit(id);
      else if (button.dataset.action === "delete") openDelete(id);
    });
    document.getElementById("open-add-employee")?.addEventListener("click", openAdd);
    document.getElementById("refresh-employees")?.addEventListener("click", () => { renderTable(); showAlert("Employee directory refreshed.", "success"); });
    [search, departmentFilter, statusFilter].forEach((control) => control?.addEventListener("input", renderTable));
    document.getElementById("clear-employee-filters")?.addEventListener("click", () => { search.value = ""; departmentFilter.value = ""; statusFilter.value = ""; renderTable(); search.focus(); });
    document.getElementById("employee-view-edit")?.addEventListener("click", () => { const id = selectedId; viewModal.hide(); if (id !== null) window.setTimeout(() => openEdit(id), 180); });
    document.getElementById("confirm-delete-employee")?.addEventListener("click", () => { if (deletingId === null) return; const list = currentEmployees(); const target = list.find((item) => String(item.id) === String(deletingId)); const next = list.filter((item) => String(item.id) !== String(deletingId)); if (target && saveEmployees(next)) { renderTable(); deleteModal.hide(); showToast(`${text(target.name, "Employee")} was removed from the directory. Related leave, attendance, and payroll history was preserved.`, "Employee deleted"); } deletingId = null; });
    formModalEl.addEventListener("hidden.bs.modal", resetForm);
    viewModalEl.addEventListener("hidden.bs.modal", () => { selectedId = null; });
    deleteModalEl.addEventListener("hidden.bs.modal", () => { deletingId = null; });
    window.addEventListener("storage", (event) => { if ([STORAGE.employees, MODULE_KEYS.settings].includes(event.key) || event.key === null) renderTable(); });
    window.addEventListener("nexora:settings-changed", renderTable);
    renderTable();
  }


    const MODULE_KEYS = Object.freeze({ settings: "hcmLiteSettings", payroll: "hcmLitePayrollRecords" });
  const defaultSettings = () => ({ company: { companyName: "Nexora HR Solutions", companyEmail: "", phone: "", address: "", city: "", country: "", website: "", registrationNumber: "" }, schedule: { start: "09:00", end: "17:00", grace: 15, hours: 8, workingDays: [1, 2, 3, 4, 5] }, leavePolicy: { annual: 14, sick: 10, casual: 8 }, preferences: { currency: "PKR", dateFormat: "dmy", notifyLeaves: true, notifyAttendance: true, notifyPayslip: true } });
  function moduleRead(key, fallback) { return readJSON(key, fallback); }
  function moduleWrite(key, value) { return writeJSON(key, value); }
  function moduleEmployees() { const value = moduleRead(STORAGE.employees, []); if (!Array.isArray(value)) { markStorageUnreadable(STORAGE.employees, `Saved data for “${STORAGE.employees}” is not an employee list.`); return []; } return value.filter((x) => x && typeof x === "object" && !Array.isArray(x)); }
  function moduleLeaves() { const value = moduleRead(STORAGE.leaves, []); if (!Array.isArray(value)) { markStorageUnreadable(STORAGE.leaves, `Saved data for “${STORAGE.leaves}” is not a leave-request list.`); return []; } return value.filter((x) => x && typeof x === "object" && !Array.isArray(x)); }
  function moduleAttendance() { const value = moduleRead(STORAGE.attendance, []); if (!Array.isArray(value)) { markStorageUnreadable(STORAGE.attendance, `Saved data for “${STORAGE.attendance}” is not an attendance list.`); return []; } return value.filter((x) => x && typeof x === "object" && !Array.isArray(x)); }
  function moduleToast(message, title = "Updated") { const el = document.getElementById("global-toast"); if (el && window.bootstrap?.Toast) { const t = document.getElementById("global-toast-title"); const m = document.getElementById("global-toast-message"); if (t) t.textContent = title; if (m) m.textContent = message; window.bootstrap.Toast.getOrCreateInstance(el, { delay: 3500 }).show(); } else { const alert = document.querySelector(".page-container .alert[role='status']"); if (alert) { alert.className = "alert alert-success"; alert.textContent = message; alert.hidden = false; } } }
  function moduleDate(value) { if (!value) return "—"; const raw=String(value).slice(0,10); const d = new Date(`${raw}T00:00:00`); if(Number.isNaN(d.getTime()))return "—"; const prefs=moduleRead(MODULE_KEYS.settings,defaultSettings())?.preferences||defaultSettings().preferences; if(prefs.dateFormat==="iso")return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; if(prefs.dateFormat==="mdy")return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`; if(prefs.dateFormat==="dmy")return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(d); }
  function moduleTime(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d); }
  function moduleDays(start, end) { const a = new Date(`${start}T00:00:00`); const b = new Date(`${end}T00:00:00`); return Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a ? 0 : Math.round((b-a)/86400000)+1; }
  function moduleModal(id) { const el = document.getElementById(id); return el && window.bootstrap?.Modal ? window.bootstrap.Modal.getOrCreateInstance(el) : null; }

  function defaultDemoEmployees() {
    return [
      { id: "EMP-1001", name: "Ayesha Khan", email: "ayesha.khan@nexora.demo", phone: "+92 300 1234567", department: "Engineering", jobTitle: "Frontend Developer", joiningDate: "2023-11-14", status: "Active", notes: "Strong UI/UX focus and fast delivery.", demoSalary: 92000 },
      { id: "EMP-1002", name: "Hamza Ali", email: "hamza.ali@nexora.demo", phone: "+92 310 7654321", department: "Operations", jobTitle: "Operations Manager", joiningDate: "2022-09-09", status: "Active", notes: "Coordinates team planning and daily workflows.", demoSalary: 118000 },
      { id: "EMP-1003", name: "Sana Malik", email: "sana.malik@nexora.demo", phone: "+92 321 6543210", department: "Finance", jobTitle: "Senior Accountant", joiningDate: "2021-07-20", status: "On Leave", notes: "Currently on planned leave.", demoSalary: 105000 },
      { id: "EMP-1004", name: "Usman Tariq", email: "usman.tariq@nexora.demo", phone: "+92 333 2345678", department: "Human Resources", jobTitle: "HR Executive", joiningDate: "2024-02-03", status: "Active", notes: "Supports onboarding and employee lifecycle tasks.", demoSalary: 76000 }
    ];
  }

  function defaultDemoPayrollRecords(employees = defaultDemoEmployees()) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return employees.map((employee, index) => {
      const salary = Number(employee.demoSalary) || [92000, 118000, 105000, 76000][index] || 85000;
      const basic = salary;
      const housing = Math.round(salary * 0.18);
      const transport = Math.round(salary * 0.06);
      const bonus = Math.round(salary * 0.04);
      const tax = Math.round(salary * 0.06);
      const provident = Math.round(salary * 0.05);
      return {
        id: `PAY-${Date.now() + index}`,
        employeeId: employee.id,
        period,
        basicSalary: basic,
        housingAllowance: housing,
        transportAllowance: transport,
        otherAllowances: 0,
        bonus,
        tax,
        providentFund: provident,
        otherDeductions: 0,
        paymentDate: `${period}-28`,
        isDemo: true,
        createdAt: new Date().toISOString()
      };
    });
  }

  function defaultDemoAttendance(employees = defaultDemoEmployees()) {
    return employees.slice(0, 3).map((employee, index) => ({
      id: `ATT-${Date.now() + index}`,
      employeeId: employee.id,
      employeeName: employee.name,
      status: index === 2 ? "On Leave" : "Present",
      date: localDateKey(new Date()),
      notes: index === 2 ? "Approved leave" : "Clocked in on time",
      updatedAt: new Date().toISOString(),
      checkIn: new Date(Date.now() - 3 * 3600000).toISOString(),
      checkOut: new Date(Date.now() - 2 * 3600000).toISOString()
    }));
  }

  function resetDemoData({ keepWorkspace = false } = {}) {
    const keys = [STORAGE.employees, STORAGE.attendance, STORAGE.leaves, MODULE_KEYS.payroll, MODULE_KEYS.settings, STORAGE.setupComplete, STORAGE.rememberedEmail];
    keys.forEach((key) => {
      try { localStorage.removeItem(key); } catch (error) { console.warn(`Unable to clear demo key ${key}.`, error); }
    });

    if (!keepWorkspace) {
      try { localStorage.removeItem(STORAGE.workspace); } catch (error) { console.warn("Unable to clear workspace data.", error); }
    }

    const workspace = getWorkspace();
    const safeWorkspace = {
      companyName: text(workspace?.companyName, "Nexora HR Solutions"),
      adminName: text(workspace?.adminName, "Admin User"),
      adminEmail: text(workspace?.adminEmail, "admin@nexora.demo"),
      updatedAt: new Date().toISOString()
    };
    writeJSON(STORAGE.workspace, safeWorkspace);

    const employees = defaultDemoEmployees();
    const payroll = defaultDemoPayrollRecords(employees);
    writeJSON(STORAGE.employees, employees);
    writeJSON(STORAGE.leaves, []);
    writeJSON(STORAGE.attendance, defaultDemoAttendance(employees));
    writeJSON(MODULE_KEYS.settings, defaultSettings());
    writeJSON(MODULE_KEYS.payroll, payroll);
    window.dispatchEvent(new CustomEvent("nexora:employees-changed"));
    window.dispatchEvent(new CustomEvent("nexora:attendance-changed"));
    window.dispatchEvent(new CustomEvent("nexora:leaves-changed"));
    window.dispatchEvent(new CustomEvent("nexora:settings-changed", { detail: defaultSettings() }));
    return employees;
  }

  function ensureDemoSeedData() {
    const employees = getEmployees();
    const payroll = moduleRead(MODULE_KEYS.payroll, []);
    const leaves = getLeaves();
    const attendance = getAttendance();
    const hasAnyData = employees.length || payroll.length || leaves.length || attendance.length;
    if (!hasAnyData) {
      resetDemoData();
      return true;
    }
    return false;
  }

  function initSettingsPage() {
    const form = document.getElementById("settings-form"); if (!form) return;
    const $ = (id) => document.getElementById(id);
    const defaults = defaultSettings();
    function getSettings() { const saved = moduleRead(MODULE_KEYS.settings, null); const workspace = getWorkspace(); const companyDefaults = { ...defaults.company, companyName: text(workspace?.companyName, defaults.company.companyName) }; if (!saved || typeof saved !== "object" || Array.isArray(saved)) { if (saved !== null) markStorageUnreadable(MODULE_KEYS.settings, `Saved data for “${MODULE_KEYS.settings}” has an unexpected structure.`); return { ...defaults, company: companyDefaults }; } const section = value => value && typeof value === "object" && !Array.isArray(value) ? value : {}; ["company","schedule","leavePolicy","preferences"].forEach(key => { if (saved[key] !== undefined && (!saved[key] || typeof saved[key] !== "object" || Array.isArray(saved[key]))) markStorageUnreadable(MODULE_KEYS.settings, `Saved “${key}” settings in “${MODULE_KEYS.settings}” are invalid.`); }); const company = section(saved.company), rawSchedule = section(saved.schedule), schedule = { ...defaults.schedule, ...rawSchedule }; if (rawSchedule.workingDays !== undefined && !Array.isArray(rawSchedule.workingDays)) { markStorageUnreadable(MODULE_KEYS.settings, `Saved work-day settings in “${MODULE_KEYS.settings}” are invalid.`); schedule.workingDays = defaults.schedule.workingDays.slice(); } else schedule.workingDays = (Array.isArray(rawSchedule.workingDays) ? rawSchedule.workingDays : defaults.schedule.workingDays).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6); return { company: { ...companyDefaults, ...company, companyName: text(company.companyName, companyDefaults.companyName) }, schedule, leavePolicy: { ...defaults.leavePolicy, ...section(saved.leavePolicy) }, preferences: { ...defaults.preferences, ...section(saved.preferences) } }; }
    function setStatus(message) { $("settings-save-status").textContent = message; }
    function fill() { const s = getSettings(); Object.entries({"setting-company-name":s.company.companyName,"setting-company-email":s.company.companyEmail,"setting-phone":s.company.phone,"setting-address":s.company.address,"setting-city":s.company.city,"setting-country":s.company.country,"setting-website":s.company.website,"setting-registration":s.company.registrationNumber,"setting-work-start":s.schedule.start,"setting-work-end":s.schedule.end,"setting-grace":s.schedule.grace,"setting-hours":s.schedule.hours,"setting-annual":s.leavePolicy.annual,"setting-sick":s.leavePolicy.sick,"setting-casual":s.leavePolicy.casual,"setting-currency":s.preferences.currency,"setting-date-format":s.preferences.dateFormat}).forEach(([id,v])=>{ if ($(id)) $(id).value = v ?? ""; }); $("setting-notify-leaves").checked=!!s.preferences.notifyLeaves; $("setting-notify-attendance").checked=!!s.preferences.notifyAttendance; $("setting-notify-payslip").checked=!!s.preferences.notifyPayslip; document.querySelectorAll("#setting-working-days input").forEach(el=>el.checked=s.schedule.workingDays.map(Number).includes(Number(el.value))); form.classList.remove("was-validated"); form.querySelectorAll(".is-invalid").forEach(el=>el.classList.remove("is-invalid")); $("setting-days-error").hidden=true; }
    fill();
    form.addEventListener("input",()=>setStatus("Unsaved changes"));
    form.addEventListener("submit",(event)=>{ event.preventDefault(); form.classList.add("was-validated"); const start=$("setting-work-start"),end=$("setting-work-end"),grace=$("setting-grace"),hours=$("setting-hours"),allowances=[$("setting-annual"),$("setting-sick"),$("setting-casual")]; let valid=form.checkValidity(); [start,end].forEach(el=>el.classList.remove("is-invalid")); if(start.value && end.value && end.value<=start.value){end.classList.add("is-invalid");end.setCustomValidity("End time must be later than start time.");valid=false;} else end.setCustomValidity(""); if(Number(grace.value)<0||!Number.isFinite(Number(grace.value))){grace.classList.add("is-invalid");valid=false;} if(!(Number(hours.value)>0&&Number(hours.value)<=24)){hours.classList.add("is-invalid");valid=false;} allowances.forEach(el=>{if(el.value===""||Number(el.value)<0||Number(el.value)>365){el.classList.add("is-invalid");valid=false;}}); const workingDays=[...document.querySelectorAll("#setting-working-days input:checked")].map(el=>Number(el.value)); $("setting-days-error").hidden=workingDays.length>0; if(!workingDays.length)valid=false; if(!valid){setStatus("Please review highlighted fields"); form.querySelector(":invalid,.is-invalid")?.focus(); const alert=$("settings-alert");alert.className="alert alert-danger";alert.textContent="Some settings need attention. Review the highlighted fields and try again.";alert.hidden=false;return;} const value={company:{companyName:$('setting-company-name').value.trim(),companyEmail:$('setting-company-email').value.trim(),phone:$('setting-phone').value.trim(),address:$('setting-address').value.trim(),city:$('setting-city').value.trim(),country:$('setting-country').value.trim(),website:$('setting-website').value.trim(),registrationNumber:$('setting-registration').value.trim()},schedule:{start:start.value,end:end.value,grace:Number(grace.value),hours:Number(hours.value),workingDays},leavePolicy:{annual:Number($('setting-annual').value),sick:Number($('setting-sick').value),casual:Number($('setting-casual').value)},preferences:{currency:$('setting-currency').value,dateFormat:$('setting-date-format').value,notifyLeaves:$('setting-notify-leaves').checked,notifyAttendance:$('setting-notify-attendance').checked,notifyPayslip:$('setting-notify-payslip').checked}}; if(!moduleWrite(MODULE_KEYS.settings,value)){moduleToast("Settings could not be saved. Check browser storage permissions.","Save failed");return;} const workspace = getWorkspace(); if (workspace && typeof workspace === "object") { const nextWorkspace = { ...workspace, companyName: value.company.companyName, updatedAt: new Date().toISOString() }; if (!writeJSON(STORAGE.workspace, nextWorkspace)) moduleToast("Settings were saved, but the shared workspace label could not be synchronized.", "Partial save"); } document.querySelectorAll("[data-company-name]").forEach(el=>el.textContent=value.company.companyName); setStatus(`Saved at ${new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`); $("settings-alert").className="alert alert-success"; $("settings-alert").textContent="Your company settings have been saved in this browser."; $("settings-alert").hidden=false; window.dispatchEvent(new CustomEvent("nexora:settings-changed",{detail:value})); moduleToast("Company profile, schedule, policy and preferences saved.","Settings saved"); });
    $("settings-reset").addEventListener("click",()=>{ if(!window.confirm("Discard unsaved edits and restore the last saved settings?"))return; fill(); setStatus("Restored saved values"); $("settings-alert").hidden=true; });
    $("settings-clear-demo-data")?.addEventListener("click",()=>{ if(!window.confirm("This will wipe the saved employee, leave, attendance, payroll, and settings data in this browser and restore the default demo records. Continue?"))return; resetDemoData(); fill(); setStatus("Demo data reset"); const alert=$("settings-alert"); alert.className="alert alert-warning"; alert.textContent="Saved demo data was cleared and replaced with a fresh default dataset."; alert.hidden=false; moduleToast("Demo data reset. Fresh employee, leave, and payroll records are ready.", "Demo data reset"); });
  }

  function initLeaveManagementPage() {
    const body=document.getElementById("leave-table-body"); if(!body)return; const $=id=>document.getElementById(id); let selectedId=null, pendingDecision=null;
    const detailModal=moduleModal("leave-detail-modal"), confirmModal=moduleModal("leave-confirm-modal"), addLeaveModal=moduleModal("leave-form-modal");
    function populateLeaveEmployees(){const select=$("leave-employee-select"),current=select.value,employees=moduleEmployees();select.replaceChildren(new Option("Choose employee",""));employees.forEach(employee=>{select.add(new Option(`${text(employee.name,"Employee")} · ${text(employee.id)}`,String(employee.id)));});if(current&&[...select.options].some(option=>option.value===current))select.value=current;}
    function save(list){if(!moduleWrite(STORAGE.leaves,list)){moduleToast("Could not save leave changes to this browser.","Save failed");return false;}window.dispatchEvent(new CustomEvent("nexora:leaves-changed"));return true;}
    function statusClass(s){const status=String(s||"").toLowerCase();return status==="approved"?"employee-status--active":status==="rejected"?"employee-status--inactive":"employee-status--leave";}
    function populateDepartments(){const select=$("leave-department-filter"),chosen=select.value,emps=moduleEmployees();select.replaceChildren(new Option("All departments",""));[...new Set(emps.map(e=>text(e.department,"")).filter(Boolean))].sort().forEach(d=>select.add(new Option(d,d)));if([...select.options].some(o=>o.value===chosen))select.value=chosen;}
    function render(){const list=moduleLeaves();$("leave-total").textContent=list.length;$("leave-pending").textContent=list.filter(x=>text(x.status,"Pending").toLowerCase()==="pending").length;$("leave-approved").textContent=list.filter(x=>text(x.status,"").toLowerCase()==="approved").length;$("leave-rejected").textContent=list.filter(x=>text(x.status,"").toLowerCase()==="rejected").length;populateDepartments();const q=$("leave-search").value.trim().toLowerCase(),st=$("leave-status-filter").value,typ=$("leave-type-filter").value,dep=$("leave-department-filter").value,emps=moduleEmployees();const filtered=list.filter(x=>{const emp=emps.find(e=>String(e.id)===String(x.employeeId));const hay=[x.employeeName,x.employeeId,x.leaveType,x.reason].map(v=>text(v,"").toLowerCase()).join(" ");return(!q||hay.includes(q))&&(!st||text(x.status,"Pending").toLowerCase()===st.toLowerCase())&&(!typ||x.leaveType===typ)&&(!dep||text(emp?.department,"")===dep);}).sort((a,b)=>String(b.requestDate||"").localeCompare(String(a.requestDate||"")));body.replaceChildren();$("leave-result-count").textContent=`${filtered.length} request${filtered.length===1?"":"s"}`;$("leave-table-summary").textContent=`Showing ${filtered.length} of ${list.length} requests`;if(!filtered.length){const tr=make("tr"),td=make("td");td.colSpan=9;const empty=make("div","employee-empty-state");empty.append(make("span","employee-empty-state__icon"));empty.firstChild.append(make("i","bi bi-calendar2-check"));empty.append(make("h3","",list.length?"No matching requests":"No leave requests yet"),make("p","",list.length?"Try another search term or clear the filters.":"Employee-submitted requests will appear here when available."));td.append(empty);tr.append(td);body.append(tr);return;}filtered.forEach((x,i)=>{const tr=make("tr"),person=make("td"),wrap=make("div","employee-person");wrap.append(make("span",`employee-avatar employee-avatar--${i%5}`,initials(x.employeeName)));const info=make("span","employee-person__details");info.append(make("strong","",text(x.employeeName,"Employee")),make("small","",text(x.employeeId)));wrap.append(info);person.append(wrap);tr.append(person,make("td","",text(x.leaveType)),make("td","",moduleDate(x.startDate)),make("td","",moduleDate(x.endDate)),make("td","",String(Number(x.days)||moduleDays(x.startDate,x.endDate)||0)),make("td","",moduleDate(String(x.requestDate||"").slice(0,10))));const reason=make("td","leave-reason-cell",text(x.reason,"No reason provided"));reason.title=text(x.reason,"");tr.append(reason);const sc=make("td");sc.append(make("span",`employee-status ${statusClass(text(x.status,"Pending"))}`,text(x.status,"Pending")));tr.append(sc);const ac=make("td"),group=make("div","employee-actions");[["View details","bi-eye","view"],["Approve","bi-check2","approve"],["Reject","bi-x-lg","reject"]].forEach(([label,icon,action])=>{if(action!=="view"&&text(x.status,"Pending").toLowerCase()!=="pending")return;const b=make("button","employee-action-btn","");b.type="button";b.setAttribute("aria-label",`${label}: ${text(x.employeeName,"employee")}`);b.title=label;b.dataset.action=action;b.dataset.id=x.id;b.append(make("i",`bi ${icon}`));if(action==="reject")b.classList.add("employee-action-btn--delete");group.append(b);});ac.append(group);tr.append(ac);body.append(tr);});}
    function openDetail(id){const x=moduleLeaves().find(r=>String(r.id)===String(id));if(!x)return;selectedId=x.id;const emp=moduleEmployees().find(e=>String(e.id)===String(x.employeeId));const box=$("leave-detail-content");box.replaceChildren();[["Employee",text(x.employeeName,"Employee")],["Employee ID",text(x.employeeId)],["Department",text(emp?.department,"Not provided")],["Leave type",text(x.leaveType)],["Start date",moduleDate(x.startDate)],["End date",moduleDate(x.endDate)],["Days",String(Number(x.days)||moduleDays(x.startDate,x.endDate))],["Request date",moduleDate(String(x.requestDate||"").slice(0,10))],["Reason",text(x.reason,"No reason provided")],["Status",text(x.status,"Pending")]].forEach(([label,value])=>{const field=make("div","employee-detail-field");field.append(make("span","",label),make("strong","",value));box.append(field);});$("leave-review-note").textContent=x.reviewedAt?`Reviewed ${new Date(x.reviewedAt).toLocaleString()}${x.rejectionReason?` · Reason: ${x.rejectionReason}`:""}`:"No review has been recorded.";const pending=text(x.status,"Pending")==="Pending";$("leave-detail-approve").hidden=!pending;$("leave-detail-reject").hidden=!pending;detailModal?.show();}
    function askDecision(id,decision){const x=moduleLeaves().find(r=>String(r.id)===String(id));if(!x||x.status!=="Pending")return;pendingDecision={id:x.id,decision};$("leave-confirm-title").textContent=decision==="Approved"?"Approve leave request?":"Reject leave request?";$("leave-confirm-message").textContent=`${decision} the ${text(x.leaveType,"leave")} request from ${text(x.employeeName,"this employee")}? This decision will be shared with the Employee Portal.`;$("leave-rejection-reason").value="";$("leave-confirm-action").textContent=decision==="Approved"?"Approve request":"Reject request";confirmModal?.show();}
    body.addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;if(b.dataset.action==="view")openDetail(b.dataset.id);else askDecision(b.dataset.id,b.dataset.action==="approve"?"Approved":"Rejected");});$("leave-detail-approve").addEventListener("click",()=>{if(selectedId!==null){detailModal?.hide();askDecision(selectedId,"Approved");}});$("leave-detail-reject").addEventListener("click",()=>{if(selectedId!==null){detailModal?.hide();askDecision(selectedId,"Rejected");}});$("leave-confirm-action").addEventListener("click",()=>{if(!pendingDecision)return;const list=moduleLeaves(),i=list.findIndex(x=>String(x.id)===String(pendingDecision.id));if(i<0||text(list[i].status,"").toLowerCase()!=="pending"){confirmModal?.hide();pendingDecision=null;render();return;}list[i]={...list[i],status:pendingDecision.decision,reviewedAt:new Date().toISOString(),reviewedBy:text(getWorkspace().adminName,"Admin User"),...(pendingDecision.decision==="Rejected"?{rejectionReason:$('leave-rejection-reason').value.trim()}:{} )};if(save(list)){confirmModal?.hide();render();moduleToast(`Request ${pendingDecision.decision.toLowerCase()} successfully.`,"Leave request updated");}pendingDecision=null;});    ["leave-search","leave-status-filter","leave-type-filter","leave-department-filter"].forEach(id=>$(id).addEventListener("input",render));$("leave-clear-filters").addEventListener("click",()=>{["leave-search","leave-status-filter","leave-type-filter","leave-department-filter"].forEach(id=>$(id).value="");render();});$("open-add-leave").addEventListener("click",()=>{populateLeaveEmployees();const form=$("leave-form");form.reset();form.classList.remove("was-validated");$("leave-form-feedback").hidden=true;$("leave-form-feedback").textContent="";$("leave-form-start").value=localDateKey();$("leave-form-end").value=localDateKey();$("leave-form-status").value="Pending";addLeaveModal?.show();});$("leave-form").addEventListener("submit",event=>{event.preventDefault();const form=event.currentTarget;const employeeId=$("leave-employee-select").value,start=$("leave-form-start").value,end=$("leave-form-end").value,type=$("leave-form-type").value,status=$("leave-form-status").value,reason=$("leave-form-reason").value.trim();const feedback=$("leave-form-feedback");form.classList.add("was-validated");$("leave-form-end").setCustomValidity(end&&start&&end<start?"End date must be on or after the start date.":"");let valid=form.checkValidity()&&!!employeeId&&!!start&&!!end&&!!type&&end>=start&&reason.length>=8;if(!employeeId){feedback.textContent="Please select an employee before creating a leave record.";feedback.hidden=false;return;}const employees=moduleEmployees();const employee=employees.find(item=>String(item.id)===String(employeeId));if(!employee){feedback.textContent="The selected employee could not be found in the directory.";feedback.hidden=false;return;}const list=moduleLeaves();const overlap=list.some(item=>String(item.employeeId)===String(employee.id)&&["pending","approved"].includes(String(item.status||"").toLowerCase())&&start<=item.endDate&&end>=item.startDate);if(overlap){feedback.textContent="These dates overlap an existing pending or approved leave request. Choose another date range.";feedback.hidden=false;return;}if(!valid){feedback.textContent="Please complete the highlighted fields and provide a reason of at least 8 characters.";feedback.hidden=false;form.querySelector(":invalid")?.focus();return;}const record={id:`LEAVE-${Date.now()}`,employeeId:employee.id,employeeName:employee.name,leaveType:type,startDate:start,endDate:end,days:moduleDays(start,end),reason,status:status||"Pending",requestDate:new Date().toISOString(),reviewedAt:status==="Approved"||status==="Rejected"?new Date().toISOString():null,reviewedBy:status==="Approved"||status==="Rejected"?text(getWorkspace().adminName,"Admin User"):null,rejectionReason:status==="Rejected"?"Manual entry":""};list.push(record);if(save(list)){form.reset();addLeaveModal?.hide();render();moduleToast(`${employee.name} leave record saved.`,"Leave added");}});$("leave-export").addEventListener("click",()=>{const rows=moduleLeaves();if(!rows.length){moduleToast("There are no leave requests to export.","Nothing to export");return;}const fields=["id","employeeName","employeeId","leaveType","startDate","endDate","days","requestDate","reason","status","reviewedAt","rejectionReason"];const csv=[fields.join(","),...rows.map(r=>fields.map(k=>`"${String(r[k]??"").replace(/^([=+@-])/,"'$1").replace(/"/g,'""')}"`).join(","))].join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));const a=make("a");a.href=url;a.download="nexora-leave-requests.csv";a.click();URL.revokeObjectURL(url);});window.addEventListener("storage",e=>{if([STORAGE.leaves,STORAGE.employees,MODULE_KEYS.settings].includes(e.key)||e.key===null)render();});window.addEventListener("nexora:leaves-changed",render);window.addEventListener("nexora:settings-changed",render);render();  }

  function initEmployeePortal() {
    const selector=document.getElementById("self-employee-select");if(!selector)return;const $=id=>document.getElementById(id);const leaveModal=moduleModal("self-leave-modal");let current=null;
    function saveAttendance(list){if(!moduleWrite(STORAGE.attendance,list)){moduleToast("Attendance could not be saved.","Save failed");return false;}window.dispatchEvent(new CustomEvent("nexora:attendance-changed"));return true;}
    function currentDay(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
    function loadEmployeeOptions(){const employees=moduleEmployees(),previous=selector.value;selector.replaceChildren(new Option("Choose employee profile",""));employees.forEach(e=>selector.add(new Option(`${text(e.name,"Employee")} · ${text(e.id)}`,String(e.id))));let wanted=previous;try{wanted=previous||localStorage.getItem("nexoraHcmCurrentEmployee")||"";}catch(error){console.warn("The remembered employee selection is unavailable.",error);}if(employees.some(e=>String(e.id)===wanted))selector.value=wanted;else if(employees.length===1)selector.value=String(employees[0].id);current=employees.find(e=>String(e.id)===selector.value)||null;}
    function duration(a,b){if(!a||!b)return "—";const start=new Date(a),end=new Date(b);if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return "—";const mins=Math.round((end-start)/60000);return `${Math.floor(mins/60)}h ${mins%60}m`;}
    function renderAttendance(){const all=moduleAttendance().filter(a=>current&&String(a.employeeId)===String(current.id));const today=all.find(a=>a.date===currentDay());const openEarlier=all.some(a=>a.date!==currentDay()&&a.checkIn&&!a.checkOut);const status=today?(today.checkOut?"Checked out":today.checkIn?"Checked in":"Not checked in"):"Not checked in";$("self-attendance-status").textContent=status;$("self-attendance-badge").textContent=status;$("self-attendance-badge").className=`employee-status ${status==="Checked out"||status==="Checked in"?"employee-status--active":"employee-status--inactive"}`;$("self-check-in").textContent=moduleTime(today?.checkIn);$("self-check-out").textContent=moduleTime(today?.checkOut);$("self-duration").textContent=today?.checkOut?duration(today.checkIn,today.checkOut):today?.checkIn?duration(today.checkIn,new Date().toISOString()):"—";$("self-check-in-btn").disabled=!current||!!today?.checkIn||openEarlier;$("self-check-out-btn").disabled=!current||!today?.checkIn||!!today?.checkOut||openEarlier;$("self-attendance-help").textContent=!current?"Select an employee profile to use attendance.":openEarlier?"An earlier attendance session is still open. Cross-day sessions are not supported in this demo; correct the saved record before continuing.":status==="Not checked in"?"Start your attendance session when you are ready.":status==="Checked in"?"Your session is running. Check out when you finish.":"Your attendance session is complete for today.";const tbody=$("self-attendance-history");tbody.replaceChildren();const recent=all.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10);if(!recent.length){const tr=make("tr"),td=make("td");td.colSpan=5;const empty=make("div","employee-empty-state");empty.append(make("span","employee-empty-state__icon"));empty.firstChild.append(make("i","bi bi-clock"));empty.append(make("h3","","No attendance history"),make("p","","Your saved sessions will appear here."));td.append(empty);tr.append(td);tbody.append(tr);}else recent.forEach(a=>{const tr=make("tr");tr.append(make("td","",moduleDate(a.date)),make("td","",moduleTime(a.checkIn)),make("td","",moduleTime(a.checkOut)),make("td","",a.checkOut?duration(a.checkIn,a.checkOut):a.checkIn?duration(a.checkIn,new Date().toISOString()):"—"));const td=make("td");td.append(make("span",`employee-status ${a.checkOut?"employee-status--active":"employee-status--leave"}`,a.checkOut?"Completed":a.checkIn?"In progress":text(a.status,"Recorded")));tr.append(td);tbody.append(tr);});}
    function renderProfile(){const e=current;$("self-name").textContent=text(e?.name,"Demo employee");$("self-role").textContent=e?`${text(e.jobTitle,"Role not set")} · ${text(e.department,"No department")}`:"No employee profile selected";$("self-greeting").textContent=e?`Welcome, ${text(e.name,"there").split(" ")[0]}`:"Welcome to your portal";$("self-subtitle").textContent=e?"Here’s your personal attendance and leave overview.":"Select an employee record to view your personal HR information.";$("self-avatar").textContent=initials(e?.name);$("self-id").textContent=text(e?.id);$("self-email").textContent=text(e?.email);$("self-department").textContent=text(e?.department);$("self-status").textContent=text(e?.status);$("self-today-date").textContent=new Intl.DateTimeFormat(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());}
    function renderLeave(){const list=moduleLeaves().filter(l=>current&&String(l.employeeId)===String(current.id)).sort((a,b)=>String(b.requestDate||"").localeCompare(String(a.requestDate||"")));const box=$("self-leave-list");box.replaceChildren();if(!list.length){const empty=make("div","employee-empty-state");empty.append(make("span","employee-empty-state__icon"));empty.firstChild.append(make("i","bi bi-calendar2-check"));empty.append(make("h3","","No leave requests yet"),make("p","","Apply for leave to see its status here."));const btn=make("button","btn btn-outline-primary btn-sm","Apply for leave");btn.type="button";btn.addEventListener("click",()=>leaveModal?.show());empty.append(btn);box.append(empty);}else list.forEach(l=>{const row=make("article","self-leave-request");const icon=make("span","self-leave-request__icon");icon.append(make("i","bi bi-calendar2-week"));const info=make("div","self-leave-request__info");info.append(make("strong","",text(l.leaveType,"Leave")),make("span","",`${moduleDate(l.startDate)} – ${moduleDate(l.endDate)} · ${Number(l.days)||moduleDays(l.startDate,l.endDate)} day(s)`),make("small","",`Requested ${moduleDate(String(l.requestDate||"").slice(0,10))} · ${text(l.reason,"No reason provided")}`));if(l.rejectionReason)info.append(make("small","self-rejection-note",`Review note: ${l.rejectionReason}`));row.append(icon,info,make("span",`employee-status ${String(l.status||"").toLowerCase()==="approved"?"employee-status--active":String(l.status||"").toLowerCase()==="rejected"?"employee-status--inactive":"employee-status--leave"}`,text(l.status,"Pending")));box.append(row);});const settings=moduleRead(MODULE_KEYS.settings,defaultSettings()),policy={...defaultSettings().leavePolicy,...(settings?.leavePolicy||{})};const map=[{key:"annual",type:"Annual Leave",ids:["balance-annual","balance-annual-bar","balance-annual-meta"]},{key:"sick",type:"Sick Leave",ids:["balance-sick","balance-sick-bar","balance-sick-meta"]},{key:"casual",type:"Casual Leave",ids:["balance-casual","balance-casual-bar","balance-casual-meta"]}];map.forEach(item=>{const allowance=Number(policy[item.key])||0,used=list.filter(l=>l.leaveType===item.type&&String(l.status||"").toLowerCase()==="approved").reduce((sum,l)=>sum+(Number(l.days)||moduleDays(l.startDate,l.endDate)),0),remaining=Math.max(0,allowance-used);$(item.ids[0]).replaceChildren(document.createTextNode(String(remaining)+" "),make("small","","days left"));$(item.ids[1]).style.width=`${allowance?Math.min(100,used/allowance*100):0}%`;$(item.ids[2]).textContent=`${used} used of ${allowance} demo-policy days`;});}
    function refresh(){loadEmployeeOptions();renderProfile();renderAttendance();renderLeave();}
    selector.addEventListener("change",()=>{current=moduleEmployees().find(e=>String(e.id)===selector.value)||null;try{if(current)localStorage.setItem("nexoraHcmCurrentEmployee",String(current.id));else localStorage.removeItem("nexoraHcmCurrentEmployee");}catch(error){console.warn("The employee selection could not be remembered.",error);}renderProfile();renderAttendance();renderLeave();});
    $("self-check-in-btn").addEventListener("click",()=>{if(!current)return;const list=moduleAttendance(),day=currentDay();const openRecord=list.find(a=>String(a.employeeId)===String(current.id)&&a.checkIn&&!a.checkOut);if(openRecord){moduleToast(openRecord.date===day?"You have already checked in today.":"An earlier attendance session is still open. Overnight sessions are not supported; resolve that record before checking in again.","Check-in unavailable");return;}list.push({id:`ATT-${Date.now()}`,employeeId:current.id,date:day,checkIn:new Date().toISOString(),checkOut:null,status:"Present"});if(saveAttendance(list)){renderAttendance();moduleToast("Check-in recorded for this demo session.","Checked in");}});
    $("self-check-out-btn").addEventListener("click",()=>{if(!current)return;const list=moduleAttendance(),day=currentDay(),record=list.find(a=>String(a.employeeId)===String(current.id)&&a.date===day&&a.checkIn&&!a.checkOut);if(!record){const older=list.some(a=>String(a.employeeId)===String(current.id)&&a.checkIn&&!a.checkOut);if(older)moduleToast("This attendance session began on a previous date. Cross-day check-out is not supported in this demo.","Check-out unavailable");return;}const checkOut=new Date(),checkIn=new Date(record.checkIn);if(Number.isNaN(checkIn.getTime())||checkOut<checkIn){moduleToast("The current time is earlier than the saved check-in time. Correct the device clock before checking out.","Invalid attendance time");return;}record.checkOut=checkOut.toISOString();record.status="Present";if(saveAttendance(list)){renderAttendance();moduleToast("Check-out recorded successfully.","Checked out");}});
    $("self-open-leave").addEventListener("click",()=>{if(!current){moduleToast("Add an employee record and select it before applying for leave.","Select employee");return;}$("self-leave-form").reset();$("self-leave-form").classList.remove("was-validated");$("self-leave-feedback").hidden=true;leaveModal?.show();});
    $("self-leave-form").addEventListener("submit",event=>{event.preventDefault();const form=event.currentTarget,start=$("self-leave-start").value,end=$("self-leave-end").value,reason=$("self-leave-reason").value.trim();form.classList.add("was-validated");let valid=form.checkValidity()&&!!current&&!!start&&!!end&&end>=start&&reason.length>=8;$("self-leave-end").setCustomValidity(end&&start&&end<start?"End date must be on or after start date.":"");const feedback=$("self-leave-feedback");if(!current){feedback.textContent="Select an employee profile before submitting a request.";feedback.hidden=false;return;}const list=moduleLeaves(),overlap=list.some(l=>String(l.employeeId)===String(current.id)&&["pending","approved"].includes(String(l.status||"").toLowerCase())&&start<=l.endDate&&end>=l.startDate);if(overlap){feedback.textContent="These dates overlap an existing pending or approved request. Please choose different dates.";feedback.hidden=false;return;}if(!valid){feedback.textContent="Please complete all fields, use a valid date range, and enter a reason of at least 8 characters.";feedback.hidden=false;form.querySelector(":invalid")?.focus();return;}const rec={id:`LEAVE-${Date.now()}`,employeeId:current.id,employeeName:current.name,leaveType:$("self-leave-type").value,startDate:start,endDate:end,days:moduleDays(start,end),reason,status:"Pending",requestDate:new Date().toISOString(),reviewedAt:null,reviewedBy:null,rejectionReason:""};list.push(rec);if(moduleWrite(STORAGE.leaves,list)){window.dispatchEvent(new CustomEvent("nexora:leaves-changed"));leaveModal?.hide();form.reset();renderLeave();moduleToast("Your leave request has been submitted for review.","Request submitted");}else{feedback.textContent="The request could not be saved. Check browser storage permissions.";feedback.hidden=false;}});
    window.addEventListener("storage",e=>{if([STORAGE.employees,STORAGE.leaves,STORAGE.attendance,MODULE_KEYS.settings].includes(e.key))refresh();});window.addEventListener("nexora:leaves-changed",renderLeave);window.addEventListener("nexora:attendance-changed",()=>{renderAttendance();});window.addEventListener("nexora:employees-changed",refresh);window.addEventListener("nexora:settings-changed",renderLeave);refresh();
  }

  function initAttendancePage() {
    const tableBody = document.getElementById("attendance-table-body");
    if (!tableBody) return;

    const form = document.getElementById("attendance-form");
    const employeeSelect = document.getElementById("attendance-employee");
    const dateInput = document.getElementById("attendance-date");
    const statusSelect = document.getElementById("attendance-status");
    const notesInput = document.getElementById("attendance-notes");

    const readAttendance = () => {
      const data = readJSON(STORAGE.attendance, []);
      if (!Array.isArray(data)) {
        markStorageUnreadable(STORAGE.attendance, `Saved data for “${STORAGE.attendance}” is not an attendance list.`);
        return [];
      }
      return data.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    };

    const readEmployees = () => {
      const data = readJSON(STORAGE.employees, []);
      if (!Array.isArray(data)) {
        markStorageUnreadable(STORAGE.employees, `Saved data for “${STORAGE.employees}” is not an employee list.`);
        return [];
      }
      return data.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    };

    function statusBadge(status) {
      const normalized = String(status || "Present").toLowerCase();
      if (normalized === "late") return "employee-status employee-status--leave";
      if (normalized === "absent") return "employee-status employee-status--inactive";
      return "employee-status employee-status--active";
    }

    function populateEmployees() {
      const employees = readEmployees();
      const storedValue = employeeSelect.value;
      employeeSelect.replaceChildren(new Option("Choose employee", ""));
      employees.forEach((employee) => {
        employeeSelect.add(new Option(`${text(employee.name, "Employee")} · ${text(employee.id)}`, String(employee.id)));
      });
      if (storedValue && [...employeeSelect.options].some((option) => option.value === storedValue)) {
        employeeSelect.value = storedValue;
      }
      if (!employeeSelect.value && employees.length === 1) {
        employeeSelect.value = String(employees[0].id);
      }
    }

    function renderSummary() {
      const records = readAttendance();
      const date = dateInput.value || localDateKey();
      const todayRecords = records.filter((item) => item.date === date);
      document.getElementById("attendance-summary-total").textContent = String(todayRecords.length);
      document.getElementById("attendance-summary-present").textContent = String(todayRecords.filter((item) => String(item.status).toLowerCase() === "present").length);
      document.getElementById("attendance-summary-late").textContent = String(todayRecords.filter((item) => String(item.status).toLowerCase() === "late").length);
      document.getElementById("attendance-summary-absent").textContent = String(todayRecords.filter((item) => String(item.status).toLowerCase() === "absent").length);
      document.getElementById("attendance-summary-leave").textContent = String(todayRecords.filter((item) => String(item.status).toLowerCase() === "on leave").length);
    }

    function renderTable() {
      const records = readAttendance();
      const date = dateInput.value || localDateKey();
      const data = records.filter((item) => item.date === date).sort((a, b) => String(a.employeeName || "").localeCompare(String(b.employeeName || "")));

      document.getElementById("attendance-result-count").textContent = `${data.length} ${data.length === 1 ? "record" : "records"}`;
      tableBody.replaceChildren();

      if (!data.length) {
        const row = make("tr");
        const cell = make("td");
        const empty = make("div", "employee-empty-state");
        const icon = make("span", "employee-empty-state__icon");
        icon.append(make("i", "bi bi-calendar-check"));
        empty.append(icon, make("h3", "", "No attendance logged yet"), make("p", "", "Use the form below to record today’s attendance."));
        cell.colSpan = 5;
        cell.append(empty);
        row.append(cell);
        tableBody.append(row);
        return;
      }

      data.forEach((item) => {
        const row = make("tr");
        row.append(
          make("td", "", text(item.employeeName, "Employee")),
          make("td", "", text(item.employeeId, "—")),
          make("td", "", text(item.status, "Present")),
          make("td", "", text(item.notes, "—")),
          make("td", "", "")
        );
        const statusCell = row.lastElementChild;
        statusCell.append(make("span", statusBadge(item.status), text(item.status, "Present")));
        tableBody.append(row);
      });
    }

    function renderAll() {
      populateEmployees();
      renderSummary();
      renderTable();
    }

    dateInput.value = localDateKey();
    dateInput.addEventListener("change", () => {
      renderSummary();
      renderTable();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const employeeId = employeeSelect.value;
      const date = dateInput.value || localDateKey();
      const status = statusSelect.value || "Present";
      const notes = notesInput.value.trim();
      const employees = readEmployees();
      const employee = employees.find((item) => String(item.id) === String(employeeId));

      if (!employeeId || !employee) {
        moduleToast("Choose a valid employee before saving attendance.", "Attendance update");
        return;
      }

      const records = readAttendance();
      const index = records.findIndex((item) => String(item.employeeId) === String(employeeId) && String(item.date) === String(date));
      const entry = {
        id: index >= 0 ? records[index].id : `ATT-${Date.now()}`,
        employeeId: employee.id,
        employeeName: employee.name,
        status,
        date,
        notes,
        updatedAt: new Date().toISOString()
      };

      if (index >= 0) records[index] = entry;
      else records.push(entry);

      if (!writeJSON(STORAGE.attendance, records)) {
        moduleToast("Attendance could not be saved in this browser.", "Save failed");
        return;
      }

      window.dispatchEvent(new CustomEvent("nexora:attendance-changed", { detail: entry }));
      form.reset();
      statusSelect.value = "Present";
      dateInput.value = date;
      renderAll();
      moduleToast(`${employee.name} attendance saved for ${formatDate(date)}.`, "Attendance updated");
    });

    window.addEventListener("nexora:employees-changed", renderAll);
    window.addEventListener("storage", (event) => {
      if ([STORAGE.employees, STORAGE.attendance].includes(event.key) || event.key === null) renderAll();
    });
    renderAll();
  }

  function initPayslipPage() {
    const employeeSelect=document.getElementById("payroll-employee");if(!employeeSelect)return;const $=id=>document.getElementById(id);const months=["January","February","March","April","May","June","July","August","September","October","November","December"];const now=new Date();months.forEach((m,i)=>employeeSelect && $("payroll-month").add(new Option(m,String(i+1).padStart(2,"0"))));for(let y=now.getFullYear()-2;y<=now.getFullYear()+1;y++)$("payroll-year").add(new Option(String(y),String(y)));$("payroll-month").value=String(now.getMonth()+1).padStart(2,"0");$("payroll-year").value=String(now.getFullYear());
    function employees(){return moduleEmployees();}function records(){const r=moduleRead(MODULE_KEYS.payroll,[]);if(!Array.isArray(r)){markStorageUnreadable(MODULE_KEYS.payroll, `Saved data for “${MODULE_KEYS.payroll}” is not a payroll-record list.`);return [];}return r.filter(x=>x&&typeof x==="object"&&!Array.isArray(x));}function selectedPeriod(){return `${$("payroll-year").value}-${$("payroll-month").value}`;}function settings(){return moduleRead(MODULE_KEYS.settings,defaultSettings());}function currency(){return settings()?.preferences?.currency||"PKR";}function money(value){const n=Number(value);if(!Number.isFinite(n)||n<0)return "—";try{return new Intl.NumberFormat(undefined,{style:"currency",currency:currency(),maximumFractionDigits:2}).format(n);}catch{return `${currency()} ${n.toLocaleString(undefined,{maximumFractionDigits:2})}`;}}function components(r){const numeric=value=>value===undefined||value===null||value===""?0:Number(value);const earnings=[numeric(r.basicSalary),numeric(r.housingAllowance),numeric(r.transportAllowance),numeric(r.otherAllowances),numeric(r.bonus)],deductions=[numeric(r.tax),numeric(r.providentFund),numeric(r.otherDeductions)];const gross=earnings.reduce((a,b)=>a+b,0),totalDeductions=deductions.reduce((a,b)=>a+b,0);const valid=[...earnings,...deductions,gross,totalDeductions].every(n=>Number.isFinite(n)&&n>=0);return {earnings,deductions,gross,totalDeductions,valid};}
    function populateEmployees(){const old=employeeSelect.value;employeeSelect.replaceChildren(new Option("Choose employee",""));employees().forEach(e=>employeeSelect.add(new Option(`${text(e.name,"Employee")} · ${text(e.id)}`,String(e.id))));if([...employeeSelect.options].some(o=>o.value===old))employeeSelect.value=old;}
    function setEmpty(title,message){$("payslip-document").hidden=true;$("payslip-empty").hidden=false;$("payslip-empty-title").textContent=title;$("payslip-empty-text").textContent=message;$("payroll-record-hint").textContent=message;$("payslip-warning").hidden=true;}
    function render(){const emp=employees().find(e=>String(e.id)===employeeSelect.value),period=selectedPeriod(),list=records(),matching=list.filter(r=>r.period===period);$("payroll-period-summary").textContent=`${months[Number($("payroll-month").value)-1]} ${$("payroll-year").value}`;$("payroll-employee-count").textContent=new Set(matching.map(r=>String(r.employeeId))).size;const totals=matching.map(components).filter(c=>c.valid);$("payroll-total-earnings").textContent=totals.length?money(totals.reduce((s,c)=>s+c.gross,0)):money(0);$("payroll-total-deductions").textContent=totals.length?money(totals.reduce((s,c)=>s+c.totalDeductions,0)):money(0);if(!employees().length){setEmpty("No employee records found","Add employee records first. Employee options are loaded from the shared employee directory.");return;}if(!emp){setEmpty("Choose an employee and pay period","Select an employee and period to view a saved record or create an illustrative demo record.");return;}const rec=list.find(r=>String(r.employeeId)===String(emp.id)&&r.period===period);if(!rec){setEmpty("No payslip for this period",`No payroll record exists for ${text(emp.name,"this employee")} in ${period}. Create an illustrative demo record explicitly if you need a preview.`);return;}const c=components(rec);if(!c.valid){setEmpty("Payroll record needs correction","One or more monetary fields are invalid. Correct the saved demo record before viewing or printing.");return;}$("payslip-empty").hidden=true;$("payslip-document").hidden=false;$("payroll-record-hint").textContent=rec.isDemo?"Illustrative demo payroll record selected.":"Saved payroll record selected.";$("payslip-demo-stamp").hidden=!rec.isDemo;$("slip-employee-name").textContent=text(emp.name,"Employee");$("slip-employee-id").textContent=text(emp.id);$("slip-employee-title").textContent=text(emp.jobTitle);$("slip-employee-department").textContent=text(emp.department);$("slip-employee-email").textContent=text(emp.email);$("slip-payment-date").textContent=moduleDate(rec.paymentDate);$("payslip-period-label").textContent=`${months[Number($("payroll-month").value)-1]} ${$("payroll-year").value}`;$("slip-gross").textContent=money(c.gross);$("slip-deductions-total").textContent=money(c.totalDeductions);const netSalary=c.gross-c.totalDeductions;$("slip-net").textContent=netSalary<0?`−${money(Math.abs(netSalary))}`:money(netSalary);const ebox=$("slip-earnings"),dbox=$("slip-deductions");ebox.replaceChildren();dbox.replaceChildren();[["Basic salary",rec.basicSalary],["Housing allowance",rec.housingAllowance],["Transport allowance",rec.transportAllowance],["Other allowances",rec.otherAllowances],["Bonus",rec.bonus]].forEach(([label,value])=>{const row=make("div","payslip-line-item");row.append(make("span","",label),make("strong","",money(Number(value)||0)));ebox.append(row);});[["Tax",rec.tax],["Provident fund",rec.providentFund],["Other deductions",rec.otherDeductions]].forEach(([label,value])=>{const row=make("div","payslip-line-item");row.append(make("span","",label),make("strong","",money(Number(value)||0)));dbox.append(row);});const warning=$("payslip-warning");if(c.totalDeductions>c.gross){warning.textContent="Warning: deductions exceed gross earnings. Net salary is shown as a negative amount; review this illustrative record.";warning.hidden=false;}else warning.hidden=true;}
    function refresh(){populateEmployees();render();}$("payroll-view").addEventListener("click",render);[employeeSelect,$("payroll-month"),$("payroll-year")].forEach(el=>el.addEventListener("change",render));$("payroll-clear").addEventListener("click",()=>{employeeSelect.value="";$("payroll-month").value=String(now.getMonth()+1).padStart(2,"0");$("payroll-year").value=String(now.getFullYear());render();});$("payroll-create-demo").addEventListener("click",()=>{const emp=employees().find(e=>String(e.id)===employeeSelect.value);if(!emp){moduleToast("Choose an employee before creating a demo payslip.","Select employee");return;}const period=selectedPeriod(),list=records();if(list.some(r=>String(r.employeeId)===String(emp.id)&&r.period===period)){moduleToast("A payroll record already exists for this employee and period.","Record already exists");render();return;}const base=Number(emp.demoSalary);const salary=Number.isFinite(base)&&base>0?base:85000;const rec={id:`PAY-${Date.now()}`,employeeId:emp.id,period,basicSalary:salary,housingAllowance:Math.round(salary*.2),transportAllowance:Math.round(salary*.05),otherAllowances:0,bonus:0,tax:Math.round(salary*.05),providentFund:Math.round(salary*.03),otherDeductions:0,paymentDate:`${period}-28`,isDemo:true,createdAt:new Date().toISOString()};list.push(rec);if(moduleWrite(MODULE_KEYS.payroll,list)){render();moduleToast("An illustrative demo payslip was created and labelled DEMO.","Demo record created");}});$("payslip-print").addEventListener("click",()=>{if($("payslip-document").hidden){moduleToast("Select a valid saved payslip before printing.","No payslip selected");return;}window.print();});window.addEventListener("storage",e=>{if([STORAGE.employees,MODULE_KEYS.payroll,MODULE_KEYS.settings].includes(e.key))refresh();});window.addEventListener("nexora:employees-changed",refresh);window.addEventListener("nexora:settings-changed",render);refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureDemoSeedData();
    initSharedShell();
    initLogin();
    initAdminDashboard();
    initEmployeeManagement();
    initSettingsPage();
    initLeaveManagementPage();
    initEmployeePortal();
    initAttendancePage();
    initPayslipPage();
  }, { once: true });
})();
