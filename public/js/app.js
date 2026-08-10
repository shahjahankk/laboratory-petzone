const LabApp = {
  tokenKey: 'lab_token',
  draftKey: 'lab_report_draft',
  version: 11,

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

  async uploadImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    const headers = {};
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Image upload failed');
    }
    return data.image;
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
      clinical_notes: '',
      status: 'final',
      panel_ids: [],
      included_parameter_ids: null,
      parameter_ids_snapshot: [],
      results: {},
      images: [],
      forms: {},
    };
  },

  emptyUltrasound() {
    return {
      us_types: [],
      us_type_other: '',
    };
  },

  getUltrasound(draft) {
    const d = draft || this.getDraft();
    return { ...this.emptyUltrasound(), ...((d.forms && d.forms.ULTRASOUND) || {}) };
  },

  /** Print/preview: always blank checkboxes so doctor can tick by hand. */
  renderUltrasoundTypeHtml(_data) {
    const box = this.mark(false);
    return `
      <div class="skin-section us-type-print">
        <h3>Ultrasound Type</h3>
        <div class="tick-row">
          <span>${box} Complete Abdomen</span>
          <span>${box} Abdominal Focused</span>
          <span>${box} Urinary Tract</span>
          <span>${box} Reproductive</span>
          <span>${box} Pregnancy</span>
          <span>${box} Thoracic</span>
          <span>${box} Other: ________</span>
        </div>
      </div>
    `;
  },

  /** Empty lined remarks area for handwriting on printed ultrasound report. */
  renderUltrasoundRemarksBlankHtml() {
    return `
      <div class="remarks-handwrite">
        <strong>Remarks</strong>
        <div class="remarks-lines" aria-hidden="true">
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
        </div>
      </div>
    `;
  },

  renderUltrasoundPanelHtml() {
    return `
      ${this.renderUltrasoundTypeHtml()}
      ${this.renderUltrasoundRemarksBlankHtml()}
    `;
  },

  emptySkinScraping() {
    return {
      sample_site: '',
      lesion_types: [],
      lesion_other: '',
      scraping_types: [],
      scraping_other: '',
      microscopy: [],
      microscopy_other: '',
      mites: [],
      mites_other: '',
      fungal: [],
      fungal_other: '',
      bacteria: [],
      yeast: [],
      yeast_other: '',
      other_findings: '',
      result: '',
      positive_for: '',
      interpretation: '',
      recommendations: '',
    };
  },

  getSkinScraping(draft) {
    const d = draft || this.getDraft();
    return { ...this.emptySkinScraping(), ...((d.forms && d.forms.SKIN_SCRAPING) || {}) };
  },

  mark(checked) {
    return checked ? '☑' : '☐';
  },

  renderSkinScrapingHtml(data) {
    const d = { ...this.emptySkinScraping(), ...(data || {}) };
    const has = (arr, key) => Array.isArray(arr) && arr.includes(key);
    const m = (arr, key) => this.mark(has(arr, key));
    const line = (text) => this.escapeHtml(text || '');
    const blank = (v) => this.escapeHtml(v || '_______________');

    return `
      <section class="skin-form">
        <h2>SKIN SCRAPING</h2>
        <div class="skin-section">
          <h3>Sample / Test Details</h3>
          <p><strong>Sample Site:</strong> ${blank(d.sample_site)}</p>
          <p><strong>Lesion Type:</strong></p>
          <div class="tick-row">
            <span>${m(d.lesion_types, 'alopecia')} Alopecia</span>
            <span>${m(d.lesion_types, 'pruritus')} Pruritus</span>
            <span>${m(d.lesion_types, 'crusts')} Crusts</span>
            <span>${m(d.lesion_types, 'scaling')} Scaling</span>
            <span>${m(d.lesion_types, 'papules')} Papules</span>
            <span>${m(d.lesion_types, 'pustules')} Pustules</span>
            <span>${m(d.lesion_types, 'erythema')} Erythema</span>
            <span>${m(d.lesion_types, 'other')} Other: ${blank(d.lesion_other)}</span>
          </div>
          <p><strong>Scraping Type:</strong></p>
          <div class="tick-row">
            <span>${m(d.scraping_types, 'deep')} Deep Skin Scraping</span>
            <span>${m(d.scraping_types, 'superficial')} Superficial Skin Scraping</span>
            <span>${m(d.scraping_types, 'tape')} Tape Impression</span>
            <span>${m(d.scraping_types, 'other')} Other: ${blank(d.scraping_other)}</span>
          </div>
          <p><strong>Microscopy:</strong></p>
          <div class="tick-row">
            <span>${m(d.microscopy, 'direct')} Direct Examination</span>
            <span>${m(d.microscopy, 'koh')} KOH</span>
            <span>${m(d.microscopy, 'oil')} Mineral Oil</span>
            <span>${m(d.microscopy, 'other')} Other: ${blank(d.microscopy_other)}</span>
          </div>
        </div>

        <div class="skin-section">
          <h3>Microscopic Findings</h3>
          <p><strong>Mites:</strong></p>
          <div class="tick-col">
            <div>${m(d.mites, 'not_seen')} Not Seen</div>
            <div>${m(d.mites, 'demodex')} Demodex spp.</div>
            <div>${m(d.mites, 'sarcoptes')} Sarcoptes spp.</div>
            <div>${m(d.mites, 'otodectes')} Otodectes spp.</div>
            <div>${m(d.mites, 'other')} Other: ${blank(d.mites_other)}</div>
          </div>
          <p><strong>Fungal Elements:</strong></p>
          <div class="tick-row">
            <span>${m(d.fungal, 'not_seen')} Not Seen</span>
            <span>${m(d.fungal, 'spores')} Spores</span>
            <span>${m(d.fungal, 'hyphae')} Hyphae</span>
            <span>${m(d.fungal, 'other')} Other: ${blank(d.fungal_other)}</span>
          </div>
          <p><strong>Bacteria:</strong></p>
          <div class="tick-row">
            <span>${m(d.bacteria, 'not_seen')} Not Seen</span>
            <span>${m(d.bacteria, 'cocci')} Cocci</span>
            <span>${m(d.bacteria, 'rods')} Rods</span>
            <span>${m(d.bacteria, 'mixed')} Mixed</span>
          </div>
          <p><strong>Yeast:</strong></p>
          <div class="tick-row">
            <span>${m(d.yeast, 'not_seen')} Not Seen</span>
            <span>${m(d.yeast, 'malassezia')} Malassezia spp.</span>
            <span>${m(d.yeast, 'other')} Other: ${blank(d.yeast_other)}</span>
          </div>
          <p><strong>Other Findings:</strong></p>
          <div class="write-lines">${line(d.other_findings) || '&nbsp;<br>&nbsp;<br>&nbsp;'}</div>
        </div>

        <div class="skin-section">
          <h3>Result / Impression</h3>
          <div class="tick-col">
            <div>${this.mark(d.result === 'negative')} Negative / No significant organisms detected</div>
            <div>${this.mark(d.result === 'positive')} Positive for: ${blank(d.positive_for)}</div>
          </div>
          <p><strong>Final Interpretation:</strong></p>
          <div class="write-lines">${line(d.interpretation) || '&nbsp;<br>&nbsp;<br>&nbsp;'}</div>
        </div>

        <div class="skin-section">
          <h3>Recommendations</h3>
          <div class="write-lines">${line(d.recommendations) || '&nbsp;<br>&nbsp;<br>&nbsp;'}</div>
        </div>
      </section>
    `;
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
      if (!Array.isArray(draft.images)) draft.images = [];
      draft.clinical_notes = draft.clinical_notes || '';
      if (!draft.forms || typeof draft.forms !== 'object') draft.forms = {};
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
