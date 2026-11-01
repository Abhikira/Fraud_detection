import './index.css';

const API_BASE = import.meta.env.VITE_API_URL || '';
const root = document.querySelector('#root');
let renderVersion = 0;
let reportImage = null;
let reportImagePreview = '';
let accountEditor = null;
let dashboardData = null;

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function getRole() {
  return localStorage.getItem('role');
}

function getToken() {
  return localStorage.getItem('token');
}

function decodeTokenPayload(token) {
  const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

function formatDate(value, options) {
  return value ? new Date(value).toLocaleDateString(undefined, options) : '';
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '';
}

function apiError(error, fallback) {
  const detail = error?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ');
  return fallback;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    const error = new Error(apiError({ data }, `Request failed (${response.status}).`));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  if (response.status === 204) return null;
  return response;
}

async function getJson(path) {
  return (await request(path)).json();
}

async function sendJson(path, method, body) {
  return (await request(path, {
    method,
    body: JSON.stringify(body),
  })).json();
}

function pageFrame(content) {
  const role = getRole();
  const dashboardPath = role === 'citizen' ? '/dashboard' : '/officer';
  return `
    <div class="flex flex-col min-h-screen">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <a href="/" class="text-base font-semibold tracking-tight text-slate-950">FraudWatch</a>
          <nav class="flex items-center gap-5">
            ${role
    ? `<a href="${dashboardPath}" class="text-sm font-medium text-slate-600 hover:text-slate-950">Dashboard</a>
       <button type="button" data-action="logout" class="text-sm font-medium text-slate-600 hover:text-slate-950">Sign out</button>`
    : `<a href="/login" class="text-sm font-medium text-slate-600 hover:text-slate-950">Sign in</a>
       <a href="/register" class="btn btn-primary">Create account</a>`}
          </nav>
        </div>
      </header>
      <main class="flex-grow">${content}</main>
      <footer class="bg-white border-t border-gray-200 mt-auto">
        <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p class="text-sm text-gray-500">&copy; ${new Date().getFullYear()} FraudWatch. All rights reserved.</p>
          <div class="flex gap-6 text-sm text-gray-500">
            <a href="/privacy" class="hover:text-primary">Privacy Policy</a>
            <a href="/terms" class="hover:text-primary">Terms &amp; Conditions</a>
          </div>
        </div>
      </footer>
    </div>`;
}

function renderHome() {
  return `
    <div class="mx-auto max-w-5xl px-6 py-20 sm:py-28">
      <section class="max-w-2xl">
        <p class="mb-4 text-sm font-medium text-slate-500">FraudWatch</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Report fraud. Follow every update.</h1>
        <p class="mt-5 max-w-xl text-lg leading-8 text-slate-600">Submit a report, keep your case details in one place, and stay informed as it is reviewed.</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="/register" class="btn btn-primary">Create an account</a>
          <a href="/login" class="btn btn-outline">Sign in</a>
        </div>
      </section>
    </div>`;
}

function renderLogin(error = '', submitting = false) {
  return `
    <div class="mx-auto max-w-5xl px-6 py-16">
      <section class="mx-auto max-w-md">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-950">Sign in</h1>
        <p class="mt-2 text-sm text-slate-600">Access your reports and cases.</p>
        ${error ? `<div role="alert" class="mt-5 border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(error)}</div>` : ''}
        <form data-form="login" class="mt-7 space-y-5">
          <div><label for="email" class="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input id="email" name="email" type="email" autocomplete="username" required class="input-field" /></div>
          <div><label for="password" class="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required class="input-field" /></div>
          <button type="submit" ${submitting ? 'disabled' : ''} class="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">${submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p class="mt-6 text-sm text-slate-600">Need a citizen account? <a href="/register" class="font-medium text-slate-950 underline underline-offset-4">Create one</a></p>
      </section>
    </div>`;
}

function renderRegister(error = '', submitting = false) {
  return `
    <div class="mx-auto max-w-5xl px-6 py-16">
      <section class="mx-auto max-w-md">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-950">Create a citizen account</h1>
        <p class="mt-2 text-sm text-slate-600">Use your account to submit and track fraud reports.</p>
        ${error ? `<div role="alert" class="mt-5 border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(error)}</div>` : ''}
        <form data-form="register" class="mt-7 space-y-5">
          <div><label for="full-name" class="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
            <input id="full-name" name="full_name" type="text" autocomplete="name" minlength="2" maxlength="100" required class="input-field" /></div>
          <div><label for="email" class="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" required class="input-field" /></div>
          <div><label for="phone" class="mb-1.5 block text-sm font-medium text-slate-700">Phone <span class="font-normal text-slate-500">(optional)</span></label>
            <input id="phone" name="phone" type="tel" autocomplete="tel" class="input-field" /></div>
          <div><label for="password" class="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <input id="password" name="password" type="password" autocomplete="new-password" minlength="6" required class="input-field" /></div>
          <button type="submit" ${submitting ? 'disabled' : ''} class="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">${submitting ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p class="mt-6 text-sm text-slate-600">Already have an account? <a href="/login" class="font-medium text-slate-950 underline underline-offset-4">Sign in</a></p>
      </section>
    </div>`;
}

function renderPrivacy() {
  return `
    <div class="max-w-3xl mx-auto px-4 py-16">
      <h1 class="text-3xl font-bold mb-8">Privacy Policy</h1>
      <div class="prose prose-slate max-w-none text-gray-600 space-y-4">
        <p>Last updated: October 2026</p>
        <p>Your privacy is important to us. It is FraudWatch's policy to respect your privacy regarding any information we may collect from you across our website.</p>
        <h2 class="text-xl font-semibold text-primary mt-6 mb-2">1. Information we collect</h2>
        <p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent.</p>
        <h2 class="text-xl font-semibold text-primary mt-6 mb-2">2. How we use information</h2>
        <p>We use the information we collect to operate our platform, provide fraud reporting services, and communicate with you regarding your cases.</p>
        <h2 class="text-xl font-semibold text-primary mt-6 mb-2">3. Data retention</h2>
        <p>We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we will protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.</p>
      </div>
    </div>`;
}

function renderTerms() {
  return `
    <div class="max-w-3xl mx-auto px-4 py-16">
      <h1 class="text-3xl font-bold mb-8">Terms and Conditions</h1>
      <div class="prose prose-slate max-w-none text-gray-600 space-y-4">
        <p>Welcome to FraudWatch!</p>
        <p>These terms and conditions outline the rules and regulations for the use of FraudWatch's Website.</p>
        <h2 class="text-xl font-semibold text-primary mt-6 mb-2">1. Terms</h2>
        <p>By accessing this website we assume you accept these terms and conditions. Do not continue to use FraudWatch if you do not agree to take all of the terms and conditions stated on this page.</p>
        <h2 class="text-xl font-semibold text-primary mt-6 mb-2">2. License</h2>
        <p>Unless otherwise stated, FraudWatch and/or its licensors own the intellectual property rights for all material on FraudWatch. All intellectual property rights are reserved.</p>
        <h2 class="text-xl font-semibold text-primary mt-6 mb-2">3. User Responsibilities</h2>
        <p>You must not: republish material from FraudWatch; sell, rent or sub-license material from FraudWatch; reproduce, duplicate or copy material from FraudWatch; or submit false or misleading fraud reports.</p>
      </div>
    </div>`;
}

function renderEvidence(reportId, evidence = []) {
  if (!evidence.length) return '<p class="text-sm text-slate-500">No images attached.</p>';
  return `<div class="space-y-4">${evidence.map((item) => `
    <div class="evidence-item" data-report-id="${Number(reportId)}" data-evidence-id="${Number(item.id)}">
      <p class="evidence-loading text-sm text-slate-500">Loading image…</p>
    </div>`).join('')}</div>`;
}

function renderDashboard(reports) {
  return `
    <div class="max-w-7xl mx-auto px-4 py-12">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-2xl font-bold text-primary">My Reports</h1>
        <a href="/report/new" class="btn btn-primary">File New Report</a>
      </div>
      <div class="card overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50"><tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
          </tr></thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${reports.map((report) => `<tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#${Number(report.id)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(report.title)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$${escapeHtml(report.amount_involved)}</td>
              <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-md bg-blue-100 text-blue-800">${escapeHtml(report.status)}</span></td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(formatDate(report.reported_at))}</td>
              <td class="px-6 py-4 text-sm">${renderEvidence(report.id, report.evidence)}</td>
            </tr>`).join('')}
            ${reports.length ? '' : '<tr><td colspan="6" class="px-6 py-8 text-center text-sm text-gray-500">No reports found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderNewReport(categories, error = '', submitting = false, loading = false) {
  return `
    <div class="mx-auto max-w-5xl px-6 py-12">
      <section class="mx-auto max-w-2xl">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-950">File a fraud report</h1>
        <p class="mt-2 text-sm text-slate-600">Fields marked required are needed to submit your report.</p>
        ${error ? `<div role="alert" class="mt-5 border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(error)}</div>` : ''}
        <form data-form="new-report" class="mt-7 space-y-5">
          <div><label for="title" class="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
            <input id="title" name="title" type="text" minlength="5" maxlength="150" required class="input-field" /></div>
          <div><label for="description" class="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
            <textarea id="description" name="description" required rows="4" class="input-field"></textarea></div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label for="amount" class="mb-1.5 block text-sm font-medium text-slate-700">Amount involved</label>
              <input id="amount" name="amount_involved" type="number" min="0.01" step="0.01" required class="input-field" /></div>
            <div><label for="incident-date" class="mb-1.5 block text-sm font-medium text-slate-700">Incident date</label>
              <input id="incident-date" name="incident_date" type="date" required class="input-field" /></div>
          </div>
          <div><label for="category" class="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
            <select id="category" name="category_id" required ${loading || !categories.length ? 'disabled' : ''} class="input-field">
              <option value="">Select a category</option>
              ${categories.map((category) => `<option value="${Number(category.id)}">${escapeHtml(category.name)}</option>`).join('')}
            </select></div>
          <div><label for="evidence-image" class="mb-1.5 block text-sm font-medium text-slate-700">Image evidence <span class="font-normal text-slate-500">(optional, up to 5 MB)</span></label>
            <input id="evidence-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" class="block w-full text-sm text-slate-600 file:mr-3 file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50" />
            <div id="image-preview"></div></div>
          <div class="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button type="button" data-action="cancel-report" class="btn btn-outline">Cancel</button>
            <button type="submit" ${submitting || loading || !categories.length ? 'disabled' : ''} class="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50">${submitting ? 'Submitting…' : 'Submit report'}</button>
          </div>
        </form>
      </section>
    </div>`;
}

function renderTimeline(logs = []) {
  if (!logs.length) return '<p class="text-sm text-gray-500 italic">No status updates yet.</p>';
  const sorted = [...logs].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
  return `<div class="relative border-l border-gray-200 ml-3 py-2">${sorted.map((log, index) => `
    <div class="mb-8 ml-6">
      <span class="absolute -left-3 flex items-center justify-center w-6 h-6 bg-white rounded-full ring-4 ring-white">
        ${index === sorted.length - 1
    ? '<svg class="w-5 h-5 text-accent" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    : '<svg class="w-5 h-5 text-green-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'}
      </span>
      <div class="flex flex-col">
        <h4 class="text-sm font-semibold text-primary">${escapeHtml(log.new_status)}</h4>
        <time class="block mb-1 text-xs font-normal text-gray-500">${escapeHtml(formatDateTime(log.changed_at))}</time>
        <p class="text-sm text-gray-600">Updated by: ${escapeHtml(log.changed_by)}</p>
      </div>
    </div>`).join('')}</div>`;
}

function renderCaseDetails(caseData, officers, error = '', saving = false) {
  if (!caseData) {
    return `<div class="mx-auto max-w-5xl px-6 py-12">
      <p role="alert" class="text-sm text-red-800">${escapeHtml(error || 'Case not found.')}</p>
      <a href="/officer" class="mt-4 inline-block text-sm font-medium underline underline-offset-4">Back to dashboard</a>
    </div>`;
  }
  const report = caseData.report;
  const isAdmin = getRole() === 'admin';
  return `
    <div class="mx-auto max-w-5xl px-6 py-10">
      <a href="/officer" class="text-sm font-medium text-slate-600 underline underline-offset-4">Back to cases</a>
      <div class="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div class="space-y-6">
          <section class="border border-slate-200 bg-white p-6">
            <p class="text-sm text-slate-500">Case #${Number(caseData.id)} · Report #${Number(caseData.report_id)}</p>
            <h1 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950">${escapeHtml(report?.title || 'Case details')}</h1>
            ${report ? `<p class="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">${escapeHtml(report.description)}</p>
              <dl class="mt-5 grid gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
                <div><dt class="text-slate-500">Amount involved</dt><dd class="mt-1 font-medium text-slate-900">${escapeHtml(report.amount_involved)}</dd></div>
                <div><dt class="text-slate-500">Incident date</dt><dd class="mt-1 font-medium text-slate-900">${escapeHtml(report.incident_date)}</dd></div>
              </dl>
              <div class="mt-5 border-t border-slate-200 pt-4"><h2 class="mb-3 text-sm font-semibold text-slate-900">Image evidence</h2>${renderEvidence(report.id, report.evidence)}</div>` : ''}
          </section>
          <section class="border border-slate-200 bg-white p-6">
            <h2 class="mb-4 text-lg font-semibold text-slate-950">Case history</h2>
            ${renderTimeline(caseData.status_logs)}
          </section>
        </div>
        <aside class="space-y-6">
          <section class="border border-slate-200 bg-white p-6">
            <h2 class="text-lg font-semibold text-slate-950">Case access</h2>
            <p class="mt-3 text-sm text-slate-600">Opened ${escapeHtml(formatDateTime(caseData.opened_at))}</p>
            <p class="mt-2 text-sm text-slate-600">${isAdmin ? 'Administrator access: all reports and cases.' : 'You can view and update cases assigned to you.'}</p>
          </section>
          <form data-form="case-update" class="space-y-4 border border-slate-200 bg-white p-6">
            <h2 class="text-lg font-semibold text-slate-950">Update case</h2>
            ${error ? `<p role="alert" class="text-sm text-red-800">${escapeHtml(error)}</p>` : ''}
            <div><label for="case-status" class="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
              <select id="case-status" name="case_status" class="input-field">${['Open', 'Investigating', 'Resolved', 'Closed'].map((value) => `<option ${caseData.case_status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
            <div><label for="case-priority" class="mb-1.5 block text-sm font-medium text-slate-700">Priority</label>
              <select id="case-priority" name="priority" class="input-field">${['Low', 'Medium', 'High'].map((value) => `<option ${caseData.priority === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
            ${isAdmin ? `<div><label for="assigned-officer" class="mb-1.5 block text-sm font-medium text-slate-700">Assigned officer</label>
              <select id="assigned-officer" name="officer_id" class="input-field"><option value="">Unassigned</option>${officers.map((officer) => `<option value="${Number(officer.id)}" ${Number(caseData.officer_id) === Number(officer.id) ? 'selected' : ''}>${escapeHtml(officer.full_name)}</option>`).join('')}</select></div>` : ''}
            <button type="submit" ${saving ? 'disabled' : ''} class="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">${saving ? 'Saving…' : 'Save changes'}</button>
          </form>
        </aside>
      </div>
    </div>`;
}

function renderOfficerForm(success = '') {
  return `<section class="mb-10 border border-slate-200 bg-white p-6">
    <h2 class="text-lg font-semibold text-slate-900">Add an officer</h2>
    <p class="mt-1 text-sm text-slate-600">Create an officer account. The password is stored securely as a hash.</p>
    ${success ? `<p role="status" class="mt-4 text-sm text-green-800">${escapeHtml(success)}</p>` : ''}
    <form data-form="create-officer" class="mt-5 grid gap-4 sm:grid-cols-2">
      <div><label for="officer-name" class="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
        <input id="officer-name" name="full_name" type="text" autocomplete="name" required minlength="2" maxlength="100" class="input-field" /></div>
      <div><label for="officer-email" class="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
        <input id="officer-email" name="email" type="email" autocomplete="email" required class="input-field" /></div>
      <div><label for="officer-password" class="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
        <input id="officer-password" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="72" class="input-field" /></div>
      <div class="flex items-end"><button type="submit" class="btn btn-primary w-full">Add officer</button></div>
    </form>
  </section>`;
}

function renderAdminAccounts(data) {
  if (data.loading) {
    return '<section class="mb-10 border border-slate-200 bg-white p-6"><h2 class="text-lg font-semibold text-slate-900">Manage accounts</h2><p class="mt-5 text-sm text-slate-600">Loading accounts…</p></section>';
  }
  const renderRows = (type, accounts) => `<div class="mt-4 overflow-x-auto border border-slate-200">
    <table class="min-w-full divide-y divide-slate-200">
      <thead class="bg-slate-50"><tr>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ID</th>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Name</th>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Email</th>
        <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">${type === 'citizen' ? 'Phone' : 'Department'}</th>
        <th class="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>
      </tr></thead>
      <tbody class="divide-y divide-slate-200 bg-white">
        ${accounts.map((account) => {
    if (accountEditor?.type === type && accountEditor.id === account.id) {
      return `<tr><td colspan="5" class="p-4"><form data-form="update-account" data-type="${type}" data-id="${Number(account.id)}" class="grid gap-4 sm:grid-cols-2">
        <div><label for="${type}-name" class="mb-1 block text-sm font-medium text-slate-700">Name</label><input id="${type}-name" name="full_name" required minlength="2" maxlength="100" class="input-field" value="${escapeHtml(accountEditor.full_name)}" /></div>
        <div><label for="${type}-email" class="mb-1 block text-sm font-medium text-slate-700">Email</label><input id="${type}-email" name="email" type="email" required class="input-field" value="${escapeHtml(accountEditor.email)}" /></div>
        ${type === 'citizen'
    ? `<div><label for="${type}-phone" class="mb-1 block text-sm font-medium text-slate-700">Phone</label><input id="${type}-phone" name="phone" type="tel" maxlength="20" class="input-field" value="${escapeHtml(accountEditor.phone)}" /></div>`
    : `<div><label for="${type}-department" class="mb-1 block text-sm font-medium text-slate-700">Department</label><select id="${type}-department" name="dept_id" class="input-field"><option value="">No department</option>${data.departments.map((dept) => `<option value="${Number(dept.id)}" ${String(accountEditor.dept_id) === String(dept.id) ? 'selected' : ''}>${escapeHtml(dept.name)}</option>`).join('')}</select></div>`}
        <div><label for="${type}-password" class="mb-1 block text-sm font-medium text-slate-700">New password (leave blank to keep current)</label><input id="${type}-password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="72" class="input-field" /></div>
        <div class="flex items-end gap-2"><button type="submit" class="btn btn-primary">Save changes</button><button type="button" data-action="cancel-edit" class="btn btn-outline">Cancel</button></div>
      </form></td></tr>`;
    }
    const dept = data.departments.find((item) => item.id === account.dept_id)?.name;
    return `<tr>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">#${Number(account.id)}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(account.full_name)}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${escapeHtml(account.email)}</td>
      <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${escapeHtml(type === 'citizen' ? (account.phone || '—') : (dept || '—'))}</td>
      <td class="whitespace-nowrap px-4 py-3 text-right"><div class="flex justify-end gap-3 text-sm">
        <button type="button" data-action="edit-account" data-type="${type}" data-id="${Number(account.id)}" class="font-medium text-slate-900 underline underline-offset-4">Edit</button>
        <button type="button" data-action="delete-account" data-type="${type}" data-id="${Number(account.id)}" class="font-medium text-red-700 underline underline-offset-4">Delete</button>
      </div></td>
    </tr>`;
  }).join('')}
        ${accounts.length ? '' : '<tr><td colspan="5" class="px-4 py-6 text-center text-sm text-slate-500">No accounts found.</td></tr>'}
      </tbody>
    </table>
  </div>`;

  return `<section class="mb-10 border border-slate-200 bg-white p-6">
    <h2 class="text-lg font-semibold text-slate-900">Manage accounts</h2>
    <p class="mt-1 text-sm text-slate-600">Update officer and citizen profiles or reset their passwords. Accounts with linked records cannot be deleted.</p>
    ${data.error ? `<p role="alert" class="mt-4 text-sm text-red-800">${escapeHtml(data.error)}</p>` : ''}
    ${data.notice ? `<p role="status" class="mt-4 text-sm text-green-800">${escapeHtml(data.notice)}</p>` : ''}
    <form data-form="create-department" class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="sm:max-w-sm sm:flex-1"><label for="new-department" class="mb-1 block text-sm font-medium text-slate-700">Add department</label><input id="new-department" name="name" required minlength="2" maxlength="100" class="input-field" /></div>
      <button type="submit" class="btn btn-outline">Add department</button>
    </form>
    <h3 class="mt-6 font-semibold text-slate-900">Officers</h3>${renderRows('officer', data.officers)}
    <h3 class="mt-8 font-semibold text-slate-900">Citizens</h3>${renderRows('citizen', data.users)}
  </section>`;
}

function renderOfficerDashboard(data) {
  const isAdmin = getRole() === 'admin';
  return `<div class="mx-auto max-w-5xl px-6 py-12">
    <div class="mb-8">
      <p class="text-sm font-medium text-slate-500">${isAdmin ? 'Administrator' : 'Officer'}</p>
      <h1 class="mt-1 text-2xl font-semibold tracking-tight text-slate-950">${isAdmin ? 'Case management' : 'My assigned cases'}</h1>
      <p class="mt-2 text-sm text-slate-600">${isAdmin ? 'Review all reports, assign cases, and oversee investigations.' : 'Review your assigned cases and update their progress.'}</p>
    </div>
    ${data.error ? `<div role="alert" class="mb-6 border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(data.error)}</div>` : ''}
    ${isAdmin ? renderOfficerForm(data.officerSuccess) : ''}
    ${isAdmin ? renderAdminAccounts(data.accounts) : ''}
    <section>
      <h2 class="mb-3 text-lg font-semibold text-slate-900">Cases</h2>
      ${data.loading ? '<p class="py-6 text-sm text-slate-600">Loading cases…</p>' : `<div class="overflow-x-auto border border-slate-200 bg-white">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50"><tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Case</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Report</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Priority</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Assigned officer</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Opened</th>
            <th class="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Details</th>
          </tr></thead>
          <tbody class="divide-y divide-slate-200">
            ${data.cases.map((item) => `<tr>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-700">#${Number(item.id)}</td>
              <td class="min-w-40 px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(item.report?.title || `Report #${item.report_id}`)}</td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-700">${escapeHtml(item.priority)}</td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-700">${escapeHtml(item.case_status)}</td>
              <td class="min-w-48 px-4 py-3">${isAdmin
    ? `<select aria-label="Assign case ${Number(item.id)}" data-action="assign-officer" data-case-id="${Number(item.id)}" class="input-field min-h-9 py-1"><option value="">Unassigned</option>${data.officers.map((officer) => `<option value="${Number(officer.id)}" ${Number(item.officer_id) === Number(officer.id) ? 'selected' : ''}>${escapeHtml(officer.full_name)}</option>`).join('')}</select>`
    : '<span class="text-sm text-slate-600">Assigned to you</span>'}</td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${escapeHtml(formatDate(item.opened_at))}</td>
              <td class="whitespace-nowrap px-4 py-3 text-right text-sm"><a href="/officer/case/${Number(item.id)}" class="font-medium text-slate-900 underline underline-offset-4">View</a></td>
            </tr>`).join('')}
            ${data.cases.length ? '' : `<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">${isAdmin ? 'No cases have been reported.' : 'No cases are assigned to you yet.'}</td></tr>`}
          </tbody>
        </table>
      </div>`}
    </section>
    ${isAdmin ? `<section class="mt-12">
      <h2 class="mb-3 text-lg font-semibold text-slate-900">All reports</h2>
      ${data.loading ? '' : data.reports.length === 0
    ? '<p class="border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">No reports have been filed.</p>'
    : `<div class="divide-y divide-slate-200 border border-slate-200 bg-white">${data.reports.map((report) => `<article class="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
      <div><h3 class="font-medium text-slate-950">${escapeHtml(report.title)}</h3>
        <p class="mt-1 text-sm text-slate-600">Report #${Number(report.id)} · ${escapeHtml(report.status)} · ${escapeHtml(formatDate(report.reported_at))}</p>
        <p class="mt-2 whitespace-pre-wrap text-sm text-slate-700">${escapeHtml(report.description)}</p></div>
      <div class="sm:w-52">${renderEvidence(report.id, report.evidence)}</div>
    </article>`).join('')}</div>`}
    </section>` : ''}
  </div>`;
}

async function loadAdminAccounts() {
  const [officers, users, departments] = await Promise.all([
    getJson('/api/cases/officers'),
    getJson('/api/admin/users'),
    getJson('/api/admin/departments'),
  ]);
  return { officers, users, departments, error: '', notice: '', loading: false };
}

async function loadPage(path, version) {
  let content;
  if (path === '/') content = renderHome();
  else if (path === '/login') content = renderLogin();
  else if (path === '/register') content = renderRegister();
  else if (path === '/privacy') content = renderPrivacy();
  else if (path === '/terms') content = renderTerms();
  else if (path === '/dashboard' || path === '/report/new') {
    if (getRole() !== 'citizen') {
      navigate(getToken() ? '/' : '/login', true);
      return;
    }
    if (path === '/dashboard') {
      content = '<div class="max-w-7xl mx-auto px-4 py-12 text-sm text-slate-600">Loading reports…</div>';
      root.innerHTML = pageFrame(content);
      try {
        const reports = await getJson('/api/reports/my-reports');
        if (version !== renderVersion) return;
        content = renderDashboard(reports);
      } catch (error) {
        if (version !== renderVersion) return;
        content = `<div class="max-w-7xl mx-auto px-4 py-12"><p role="alert" class="text-sm text-red-800">${escapeHtml(apiError(error, 'Could not load reports.'))}</p></div>`;
      }
    } else {
      content = '<div class="mx-auto max-w-5xl px-6 py-12 text-sm text-slate-600">Loading report categories…</div>';
      root.innerHTML = pageFrame(content);
      try {
        const categories = await getJson('/api/reports/categories');
        if (version !== renderVersion) return;
        content = renderNewReport(categories);
      } catch (error) {
        if (version !== renderVersion) return;
        content = renderNewReport([], apiError(error, 'Could not load report categories.'));
      }
    }
  } else if (path === '/officer' || path.startsWith('/officer/case/')) {
    if (!['officer', 'admin'].includes(getRole())) {
      navigate(getToken() ? '/' : '/login', true);
      return;
    }
    if (path === '/officer') {
      content = renderOfficerDashboard({
        loading: true, cases: [], officers: [], reports: [],
        accounts: { loading: true, officers: [], users: [], departments: [] },
        error: '', officerSuccess: '',
      });
      root.innerHTML = pageFrame(content);
      try {
        const [cases, officers, reports, accounts] = await Promise.all([
          getJson('/api/cases/'),
          getRole() === 'admin' ? getJson('/api/cases/officers') : Promise.resolve([]),
          getRole() === 'admin' ? getJson('/api/reports/') : Promise.resolve([]),
          getRole() === 'admin' ? loadAdminAccounts() : Promise.resolve(null),
        ]);
        if (version !== renderVersion) return;
        dashboardData = { loading: false, cases, officers, reports, accounts, error: '', officerSuccess: '' };
        content = renderOfficerDashboard(dashboardData);
      } catch (error) {
        if (version !== renderVersion) return;
        content = renderOfficerDashboard({
          loading: false, cases: [], officers: [], reports: [],
          accounts: { loading: false, officers: [], users: [], departments: [], error: apiError(error, 'Could not load account data.') },
          error: apiError(error, 'Could not load cases. Please try again.'),
        });
      }
    } else {
      const caseId = path.match(/^\/officer\/case\/(\d+)$/)?.[1];
      if (!caseId) {
        navigate('/', true);
        return;
      }
      content = '<p class="mx-auto max-w-5xl px-6 py-12 text-sm text-slate-600">Loading case…</p>';
      root.innerHTML = pageFrame(content);
      try {
        const [caseData, officers] = await Promise.all([
          getJson(`/api/cases/${caseId}`),
          getRole() === 'admin' ? getJson('/api/cases/officers') : Promise.resolve([]),
        ]);
        if (version !== renderVersion) return;
        content = renderCaseDetails(caseData, officers);
      } catch (error) {
        if (version !== renderVersion) return;
        content = renderCaseDetails(null, [], apiError(error, 'Could not load this case.'));
      }
    }
  } else {
    navigate('/', true);
    return;
  }
  if (version !== renderVersion) return;
  root.innerHTML = pageFrame(content);
  if (reportImagePreview && path === '/report/new') {
    const preview = document.querySelector('#image-preview');
    if (preview) preview.innerHTML = `<img src="${reportImagePreview}" alt="Selected evidence preview" class="mt-3 max-h-56 border border-slate-200 object-contain" />`;
  }
  loadEvidenceImages();
}

function navigate(path, replace = false) {
  if (replace) history.replaceState({}, '', path);
  else if (location.pathname !== path) history.pushState({}, '', path);
  accountEditor = null;
  renderVersion += 1;
  void loadPage(path, renderVersion);
  window.scrollTo(0, 0);
}

function loadEvidenceImages() {
  document.querySelectorAll('.evidence-item').forEach(async (element) => {
    const { reportId, evidenceId } = element.dataset;
    try {
      const response = await request(`/api/reports/${reportId}/evidence/${evidenceId}/image`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (!element.isConnected) {
        URL.revokeObjectURL(url);
        return;
      }
      element.innerHTML = `<a href="${url}" target="_blank" rel="noreferrer" class="block">
        <img src="${url}" alt="Evidence for report #${Number(reportId)}" class="max-h-80 max-w-full border border-slate-200 object-contain" />
        <span class="mt-1 inline-block text-xs text-slate-500">Open full image</span>
      </a>`;
      element.dataset.objectUrl = url;
    } catch {
      if (element.isConnected) element.innerHTML = '<p class="text-sm text-slate-500">Image could not be loaded.</p>';
    }
  });
}

function setFormError(form, message) {
  let alert = form.querySelector('[role="alert"]');
  if (!alert) {
    alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.className = 'mt-5 border border-red-200 bg-red-50 p-3 text-sm text-red-800';
    form.prepend(alert);
  }
  alert.textContent = message;
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (action) {
    const { action: actionName } = action.dataset;
    if (actionName === 'logout') {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      navigate('/login');
    } else if (actionName === 'cancel-report') {
      reportImage = null;
      reportImagePreview = '';
      navigate('/dashboard');
    } else if (actionName === 'cancel-edit') {
      accountEditor = null;
      if (dashboardData) root.innerHTML = pageFrame(renderOfficerDashboard(dashboardData));
    } else if (actionName === 'edit-account') {
      const records = action.dataset.type === 'officer' ? dashboardData.accounts.officers : dashboardData.accounts.users;
      const account = records.find((item) => item.id === Number(action.dataset.id));
      if (account) {
        accountEditor = {
          type: action.dataset.type,
          id: account.id,
          full_name: account.full_name,
          email: account.email,
          phone: account.phone || '',
          dept_id: account.dept_id ? String(account.dept_id) : '',
        };
        root.innerHTML = pageFrame(renderOfficerDashboard(dashboardData));
      }
    } else if (actionName === 'delete-account') {
      void deleteAccount(action.dataset.type, Number(action.dataset.id));
    }
    return;
  }
  const anchor = event.target.closest('a[href]');
  if (anchor && anchor.origin === location.origin && !anchor.target && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    navigate(anchor.pathname);
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  if (target.matches('[data-action="assign-officer"]')) {
    const caseId = Number(target.dataset.caseId);
    try {
      const updated = await sendJson(`/api/cases/${caseId}`, 'PATCH', {
        officer_id: target.value ? Number(target.value) : null,
      });
      dashboardData.cases = dashboardData.cases.map((item) => (
        item.id === caseId ? { ...item, officer_id: updated.officer_id } : item
      ));
    } catch (error) {
      dashboardData.error = apiError(error, 'Could not assign this case.');
      root.innerHTML = pageFrame(renderOfficerDashboard(dashboardData));
    }
  }
  if (target.id === 'evidence-image') {
    const file = target.files?.[0] || null;
    if (file && file.size > 5 * 1024 * 1024) {
      reportImage = null;
      reportImagePreview = '';
      target.value = '';
      setFormError(target.form, 'Choose an image that is 5 MB or smaller.');
      return;
    }
    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reportImage = null;
      reportImagePreview = '';
      target.value = '';
      setFormError(target.form, 'Choose a JPEG, PNG, or WebP image.');
      return;
    }
    reportImage = file;
    reportImagePreview = file ? URL.createObjectURL(file) : '';
    const preview = document.querySelector('#image-preview');
    if (preview) {
      preview.innerHTML = reportImagePreview
        ? `<img src="${reportImagePreview}" alt="Selected evidence preview" class="mt-3 max-h-56 border border-slate-200 object-contain" />`
        : '';
    }
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const formType = form.dataset.form;
  const formData = new FormData(form);
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    if (formType === 'login') {
      const body = new URLSearchParams();
      body.set('username', formData.get('email'));
      body.set('password', formData.get('password'));
      const response = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const result = await response.json();
      const payload = decodeTokenPayload(result.access_token);
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('role', payload.role);
      navigate(payload.role === 'citizen' ? '/dashboard' : '/officer');
    } else if (formType === 'register') {
      await sendJson('/api/auth/register', 'POST', {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        phone: formData.get('phone') || null,
        password: formData.get('password'),
      });
      navigate('/login');
    } else if (formType === 'new-report') {
      const report = new FormData();
      ['title', 'description', 'amount_involved', 'incident_date', 'category_id'].forEach((field) => {
        report.append(field, formData.get(field));
      });
      if (reportImage) report.append('image', reportImage);
      await request('/api/reports/with-evidence', { method: 'POST', body: report });
      reportImage = null;
      reportImagePreview = '';
      navigate('/dashboard');
    } else if (formType === 'create-officer') {
      const response = await sendJson('/api/cases/officers', 'POST', {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        password: formData.get('password'),
      });
      dashboardData.accounts.officers.push(response);
      dashboardData.accounts.officers.sort((first, second) => first.full_name.localeCompare(second.full_name));
      dashboardData.officers = dashboardData.accounts.officers;
      dashboardData.officerSuccess = `Officer ${response.full_name} was added.`;
      root.innerHTML = pageFrame(renderOfficerDashboard(dashboardData));
    } else if (formType === 'create-department') {
      const response = await sendJson('/api/admin/departments', 'POST', { name: formData.get('name') });
      dashboardData.accounts.departments.push(response);
      dashboardData.accounts.departments.sort((first, second) => first.name.localeCompare(second.name));
      dashboardData.accounts.notice = `Department ${response.name} was added.`;
      root.innerHTML = pageFrame(renderOfficerDashboard(dashboardData));
    } else if (formType === 'update-account') {
      const type = form.dataset.type;
      const id = Number(form.dataset.id);
      const payload = {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        ...(type === 'citizen'
          ? { phone: formData.get('phone') || null }
          : { dept_id: formData.get('dept_id') ? Number(formData.get('dept_id')) : null }),
        ...(formData.get('password') ? { password: formData.get('password') } : {}),
      };
      const account = await sendJson(`/api/admin/${type === 'citizen' ? 'users' : 'officers'}/${id}`, 'PATCH', payload);
      const records = type === 'citizen' ? dashboardData.accounts.users : dashboardData.accounts.officers;
      const index = records.findIndex((item) => item.id === id);
      if (index >= 0) records[index] = account;
      if (type === 'officer') {
        dashboardData.officers = dashboardData.accounts.officers;
      }
      dashboardData.accounts.notice = 'Account updated.';
      accountEditor = null;
      root.innerHTML = pageFrame(renderOfficerDashboard(dashboardData));
    } else if (formType === 'case-update') {
      const path = location.pathname;
      const caseId = path.match(/^\/officer\/case\/(\d+)$/)?.[1];
      const payload = {
        case_status: formData.get('case_status'),
        priority: formData.get('priority'),
      };
      if (getRole() === 'admin') {
        payload.officer_id = formData.get('officer_id') ? Number(formData.get('officer_id')) : null;
      }
      await sendJson(`/api/cases/${caseId}`, 'PATCH', payload);
      await loadPage(path, ++renderVersion);
    }
  } catch (error) {
    if (form.isConnected) {
      const message = error.status === 401 && formType === 'login'
        ? 'Email or password is incorrect.'
        : apiError(error, 'Could not complete the request. Please try again.');
      setFormError(form, message);
      if (submitButton) submitButton.disabled = false;
    } else if (formType === 'create-officer' || formType === 'create-department' || formType === 'update-account') {
      dashboardData.accounts.error = apiError(error, 'Could not save this change.');
      root.innerHTML = pageFrame(renderOfficerDashboard(dashboardData));
    }
  }
});

async function deleteAccount(type, id) {
  const records = type === 'officer' ? dashboardData.accounts.officers : dashboardData.accounts.users;
  const account = records.find((item) => item.id === id);
  if (!account || !window.confirm(`Delete ${account.full_name}'s account? This is only allowed when it has no linked records.`)) return;
  try {
    await request(`/api/admin/${type === 'citizen' ? 'users' : 'officers'}/${id}`, { method: 'DELETE' });
    const key = type === 'citizen' ? 'users' : 'officers';
    dashboardData.accounts[key] = dashboardData.accounts[key].filter((item) => item.id !== id);
    if (type === 'officer') dashboardData.officers = dashboardData.accounts.officers;
    dashboardData.accounts.notice = `${account.full_name}'s account was deleted.`;
    root.innerHTML = pageFrame(renderOfficerDashboard(dashboardData));
  } catch (error) {
    dashboardData.accounts.error = apiError(error, 'Could not delete this account.');
    root.innerHTML = pageFrame(renderOfficerDashboard(dashboardData));
  }
}

window.addEventListener('popstate', () => {
  renderVersion += 1;
  void loadPage(location.pathname, renderVersion);
});

if (getToken() && !getRole()) {
  try {
    const tokenPayload = decodeTokenPayload(getToken());
    localStorage.setItem('role', tokenPayload.role);
  } catch {
    localStorage.removeItem('token');
  }
}

void loadPage(location.pathname, ++renderVersion);
