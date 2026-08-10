const LabApp = {
  tokenKey: 'lab_token',
  draftKey: 'lab_report_draft',
  version: 5,

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
      included_parameter_ids: null,
      parameter_ids_snapshot: [],
      results: {},
    };
  },

  getDraft() {
    try {
      const raw = localStorage.getItem(this.draftKey) || sessionStorage.getItem(this.draftKey);
      if (!raw) return this.emptyDraft();
      const parsed = JSON.parse(raw);
      const draft = { ...this.emptyDraft(), ...parsed };
      draft.panel_ids = (draft.panel_ids || []).map(Number).filter(Boolean);
      draft.species = this.normalizeSpecies(draft.species);
      if (Array.isArray(draft.included_parameter_ids)) {
        draft.included_parameter_ids = draft.included_parameter_ids.map(Number).filter(Boolean);
      } else {
        draft.included_parameter_ids = null;
      }
      draft.parameter_ids_snapshot = (draft.parameter_ids_snapshot || []).map(Number).filter(Boolean);
      if (draft.results && typeof draft.results === 'object') {
        const clean = {};
        Object.keys(draft.results).forEach((k) => {
          clean[String(k)] = draft.results[k];
        });
        draft.results = clean;
      } else {
        draft.results = {};
      }
      return draft;
    } catch (_) {
      return this.emptyDraft();
    }
  },

  saveDraft(partial) {
    const next = { ...this.getDraft(), ...partial };
    if (partial && partial.panel_ids) {
      next.panel_ids = partial.panel_ids.map(Number).filter(Boolean);
    }
    if (partial && Object.prototype.hasOwnProperty.call(partial, 'included_parameter_ids')) {
      next.included_parameter_ids = Array.isArray(partial.included_parameter_ids)
        ? partial.included_parameter_ids.map(Number).filter(Boolean)
        : null;
    }
    if (partial && partial.parameter_ids_snapshot) {
      next.parameter_ids_snapshot = partial.parameter_ids_snapshot.map(Number).filter(Boolean);
    }
    if (partial && partial.species != null) {
      next.species = this.normalizeSpecies(partial.species);
    }
    const json = JSON.stringify(next);
    localStorage.setItem(this.draftKey, json);
    try { sessionStorage.setItem(this.draftKey, json); } catch (_) {}
    return next;
  },

  /** Which parameters are included for print (default: all current panel params). */
  resolveIncludedParameterIds(allParamIds, draft) {
    const all = (allParamIds || []).map(Number).filter(Boolean);
    const d = draft || this.getDraft();
    if (!Array.isArray(d.included_parameter_ids)) {
      return all;
    }
    const saved = new Set(d.included_parameter_ids.map(Number));
    const snapshot = new Set((d.parameter_ids_snapshot || []).map(Number));
    return all.filter((id) => saved.has(id) || !snapshot.has(id));
  },

  clearDraft() {
    localStorage.removeItem(this.draftKey);
    try { sessionStorage.removeItem(this.draftKey); } catch (_) {}
  },

  normalizeSpecies(value) {
    const s = String(value || '').trim().toLowerCase();
    if (s === 'cat' || s === 'feline') return 'Cat';
    if (s === 'dog' || s === 'canine') return 'Dog';
    return value || '';
  },

  hasPatient(draft) {
    const d = draft || this.getDraft();
    return !!(d.patient_name && d.pet_name && (d.species === 'Dog' || d.species === 'Cat'));
  },

  hasTests(draft) {
    const d = draft || this.getDraft();
    return Array.isArray(d.panel_ids) && d.panel_ids.length > 0;
  },

  renderStepper(activeStep) {
    const steps = [
      { n: 1, label: 'Patient' },
      { n: 2, label: 'Tests' },
      { n: 3, label: 'Results' },
      { n: 4, label: 'Preview' },
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
    if (minFields.includes('patient') && !this.hasPatient(draft)) {
      window.location.replace('/report/new');
      return null;
    }
    if (minFields.includes('tests') && !this.hasTests(draft)) {
      window.location.replace('/report/new/tests');
      return null;
    }
    return draft;
  },
};
