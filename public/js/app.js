const LabApp = {
  tokenKey: 'lab_token',
  draftKey: 'lab_report_draft',

  getToken() {
    return localStorage.getItem(this.tokenKey) || '';
  },

  setToken(token) {
    if (token) localStorage.setItem(this.tokenKey, token);
    else localStorage.removeItem(this.tokenKey);
  },

  async api(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || 'Request failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  async requireAuth() {
    try {
      const data = await this.api('/api/auth/me');
      return data.user;
    } catch (err) {
      this.setToken('');
      window.location.href = '/login';
      return null;
    }
  },

  async logout() {
    try { await this.api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    this.setToken('');
    window.location.href = '/login';
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  emptyDraft() {
    return {
      editId: null,
      patient_name: '',
      owner_phone: '',
      pet_name: '',
      species: '',
      breed: '',
      age: '',
      sex: '',
      referring_vet: '',
      sample_date: this.today(),
      report_date: this.today(),
      remarks: '',
      status: 'final',
      panel_ids: [],
      results: {},
    };
  },

  getDraft() {
    try {
      const raw = sessionStorage.getItem(this.draftKey);
      if (!raw) return this.emptyDraft();
      return { ...this.emptyDraft(), ...JSON.parse(raw) };
    } catch (_) {
      return this.emptyDraft();
    }
  },

  saveDraft(partial) {
    const next = { ...this.getDraft(), ...partial };
    sessionStorage.setItem(this.draftKey, JSON.stringify(next));
    return next;
  },

  clearDraft() {
    sessionStorage.removeItem(this.draftKey);
  },

  normalizeSpecies(value) {
    const s = String(value || '').trim().toLowerCase();
    if (s === 'cat' || s === 'feline') return 'Cat';
    if (s === 'dog' || s === 'canine') return 'Dog';
    return value || '';
  },

  renderStepper(activeStep) {
    const steps = [
      { n: 1, label: 'Patient', href: '/report/new' },
      { n: 2, label: 'Tests', href: '/report/new/tests' },
      { n: 3, label: 'Results', href: '/report/new/results' },
      { n: 4, label: 'Preview', href: '/report/new/preview' },
    ];
    return `
      <div class="wizard-steps">
        ${steps.map((s) => `
          <div class="wizard-step ${s.n === activeStep ? 'active' : ''} ${s.n < activeStep ? 'done' : ''}">
            <span>${s.n}</span> ${s.label}
          </div>
        `).join('')}
      </div>
    `;
  },

  guardStep(minFields) {
    const draft = this.getDraft();
    if (minFields.includes('patient') && (!draft.patient_name || !draft.pet_name || !draft.species)) {
      window.location.href = '/report/new';
      return null;
    }
    if (minFields.includes('tests') && !(draft.panel_ids || []).length) {
      window.location.href = '/report/new/tests';
      return null;
    }
    return draft;
  },
};
