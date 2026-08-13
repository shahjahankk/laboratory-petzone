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

  /**
   * Date + time stamp for printed reports.
   * Prefers created_at (has time); else report_date + current clock time.
   */
  formatReportDateParts(reportDate, createdAt) {
    let d = null;
    if (createdAt) {
      const parsed = new Date(createdAt);
      if (!Number.isNaN(parsed.getTime())) d = parsed;
    }
    if (!d && reportDate) {
      const day = String(reportDate).slice(0, 10);
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const parsed = new Date(`${day}T${hh}:${mm}:${ss}`);
      if (!Number.isNaN(parsed.getTime())) d = parsed;
    }
    if (!d) d = new Date();

    const date = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return { date, time, full: `${date} · ${time}` };
  },

  formatReportDateTime(reportDate, createdAt) {
    return this.formatReportDateParts(reportDate, createdAt).full;
  },

  /** Parse "min - max" style reference ranges. */
  parseReferenceRange(rangeStr) {
    const s = String(rangeStr || '')
      .replace(/[–—]/g, '-')
      .replace(/\s+to\s+/gi, '-')
      .trim();
    if (!s) return null;
    const m = s.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const min = Number(m[1]);
    const max = Number(m[2]);
    if (Number.isNaN(min) || Number.isNaN(max)) return null;
    return { min: Math.min(min, max), max: Math.max(min, max) };
  },

  parseResultNumber(value) {
    const s = String(value == null ? '' : value).trim();
    if (!s || s === '-' || s === '—' || s === 'N/A') return null;
    const m = s.match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isNaN(n) ? null : n;
  },

  isOutOfRange(value, rangeStr) {
    const n = this.parseResultNumber(value);
    const r = this.parseReferenceRange(rangeStr);
    if (n == null || !r) return false;
    return n < r.min || n > r.max;
  },

  /** Result cell HTML — red when below min or above max of reference. */
  resultValueCellHtml(value, rangeStr) {
    const raw = value == null ? '' : String(value).trim();
    const display = raw || ' - ';
    const out = raw ? this.isOutOfRange(raw, rangeStr) : false;
    return `<td class="result-val${out ? ' result-out' : ''}">${this.escapeHtml(display)}</td>`;
  },

  metaCellHtml(label, value) {
    return `<div class="meta-cell"><span class="k">${this.escapeHtml(label)}</span><span class="v">${this.escapeHtml(value || ' - ')}</span></div>`;
  },

  renderReportHeaderHtml(opts) {
    const o = opts || {};
    const dt = o.dt || this.formatReportDateParts(o.report_date, o.created_at);
    return `
      <div class="report-topbar"></div>
      <div class="report-header">
        <div class="rh-left">
          <img src="/api/static/img/petzonelogo.png" alt="PetZone">
        </div>
        <div class="rh-center">
          <h1>PetZone Laboratory</h1>
          <div class="sub">${this.escapeHtml(o.subtitle || 'Diagnostic Laboratory Report')}</div>
        </div>
        <div class="rh-right">
          <div class="dt-label">Date &amp; Time</div>
          <div class="dt-date">${this.escapeHtml(dt.date)}</div>
          <div class="dt-time">${this.escapeHtml(dt.time)}</div>
          ${o.report_no ? `<div class="report-meta-line">${this.escapeHtml(o.report_no)}</div>` : ''}
        </div>
      </div>
    `;
  },

  renderPatientCardHtml(p) {
    const d = p || {};
    const fmt = (v) => (v ? String(v).slice(0, 10) : ' - ');
    return `
      <div class="report-section-title">Patient Information</div>
      <div class="meta-card">
        ${this.metaCellHtml('Owner', d.patient_name)}
        ${this.metaCellHtml('Phone', d.owner_phone)}
        ${this.metaCellHtml('Pet Name', d.pet_name)}
        ${this.metaCellHtml('Species', d.species)}
        ${this.metaCellHtml('Breed', d.breed)}
        ${this.metaCellHtml('Age', d.age)}
        ${this.metaCellHtml('Sex', d.sex)}
        ${this.metaCellHtml('Referring Vet', d.referring_vet)}
        ${this.metaCellHtml('Sample Date', fmt(d.sample_date))}
        ${this.metaCellHtml('Report Date', fmt(d.report_date))}
      </div>
    `;
  },

  renderReportFooterHtml(opts) {
    const o = opts || {};
    return `
      <div class="report-footer">
        <div class="footer-note">
          For veterinary diagnostic use only. Correlate with clinical findings.<br>
          Reference ranges shown are for <strong>${this.escapeHtml(o.species || 'selected species')}</strong>.
          ${o.prepared_by ? `<br>Prepared by: ${this.escapeHtml(o.prepared_by)}` : ''}<br>
          <span class="footer-legal">For veterinary treatment purposes. Not intended as a legal or court document.</span>
        </div>
        <div class="sign-box">
          <div class="sign-line"></div>
          <div class="sign-caption">Authorized Signatory</div>
        </div>
      </div>
    `;
  },

  /** One printed page: header + patient + body (+ optional footer). */
  wrapReportPrintPage(chrome, bodyHtml, footerHtml, isFirst) {
    return `
      <div class="report-print-page${isFirst ? ' is-first' : ''}">
        ${chrome}
        ${bodyHtml || ''}
        ${footerHtml || ''}
      </div>
    `;
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
      clinical_history: '',
      findings: '',
      impression: '',
      recommendations: '',
    };
  },

  getUltrasound(draft) {
    const d = draft || this.getDraft();
    return { ...this.emptyUltrasound(), ...((d.forms && d.forms.ULTRASOUND) || {}) };
  },

  ultrasoundTypeLabels(data) {
    const d = { ...this.emptyUltrasound(), ...(data || {}) };
    const map = {
      complete_abdomen: 'Complete Abdomen',
      abdominal_focused: 'Abdominal Focused',
      urinary: 'Urinary Tract',
      reproductive: 'Reproductive',
      pregnancy: 'Pregnancy',
      thoracic: 'Thoracic',
    };
    const labels = [];
    const types = Array.isArray(d.us_types) ? d.us_types : [];
    for (const key of types) {
      if (key === 'other') {
        const other = String(d.us_type_other || '').trim();
        labels.push(other ? `Other: ${other}` : 'Other');
      } else if (map[key]) {
        labels.push(map[key]);
      }
    }
    return labels;
  },

  formatUltrasoundTypeText(data) {
    return this.ultrasoundTypeLabels(data).join(' / ');
  },

  /** Single ultrasound title + optional category on the same line. */
  formatUltrasoundHeading(usForm) {
    const typeText = this.formatUltrasoundTypeText(usForm);
    return typeText ? `Ultrasound - ${typeText}` : 'Ultrasound';
  },

  renderUltrasoundHeadingHtml(usForm) {
    return `<h2>${this.escapeHtml(this.formatUltrasoundHeading(usForm))}</h2>`;
  },

  /** Empty lined field for handwriting on printed ultrasound report. */
  renderHandwriteBoxHtml(title, lines = 5) {
    const rows = Array.from({ length: Math.max(2, Number(lines) || 4) })
      .map(() => '<div class="line"></div>')
      .join('');
    return `
      <div class="remarks-handwrite">
        <strong>${this.escapeHtml(title)}</strong>
        <div class="remarks-lines" aria-hidden="true">${rows}</div>
      </div>
    `;
  },

  renderFilledNotesBoxHtml(title, text, blankLines = 2) {
    const body = String(text || '').trim();
    if (!body) return this.renderHandwriteBoxHtml(title, blankLines);
    return `
      <div class="remarks-handwrite remarks-filled">
        <strong>${this.escapeHtml(title)}</strong>
        <div class="remarks-body">${this.escapeHtml(body)}</div>
      </div>
    `;
  },

  /**
   * Print fields (exact order/names). Filled text prints as typed;
   * empty fields still show with handwriting lines.
   */
  renderUltrasoundPanelHtml(usForm) {
    const us = { ...this.emptyUltrasound(), ...(usForm || {}) };
    return `
      ${this.renderFilledNotesBoxHtml('Clinical History / Indication', us.clinical_history, 2)}
      ${this.renderFilledNotesBoxHtml('Ultrasound Findings', us.findings, 8)}
      ${this.renderFilledNotesBoxHtml('Results / Impression', us.impression, 4)}
      ${this.renderFilledNotesBoxHtml('Recommendations', us.recommendations, 3)}
    `;
  },

  renderUltrasoundImagesInnerHtml(images) {
    const list = Array.isArray(images) ? images : [];
    if (!list.length) return '';
    return `
      <div class="us-images-block">
        <h3 class="us-images-title">Ultrasound Images</h3>
        <div class="report-images">
          ${list.map((img) => `
            <figure class="report-image">
              <img src="${this.escapeHtml(img.url)}" alt="${this.escapeHtml(img.original_name || 'Ultrasound')}">
            </figure>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderUltrasoundImagesHtml(images, usForm) {
    const inner = this.renderUltrasoundImagesInnerHtml(images);
    if (!inner) return '';
    return `<section class="report-panel report-panel-us-images">${inner}</section>`;
  },

  /** Full ultrasound block for print: heading + fields + images (one unit). */
  renderUltrasoundSectionHtml(usForm, images) {
    return `
      <section class="report-panel report-panel-us">
        ${this.renderUltrasoundHeadingHtml(usForm)}
        ${this.renderUltrasoundPanelHtml(usForm)}
        ${this.renderUltrasoundImagesInnerHtml(images)}
      </section>
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
    const blank = (v) => this.escapeHtml(v || '________');

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
          <div class="tick-row">
            <span>${m(d.mites, 'not_seen')} Not Seen</span>
            <span>${m(d.mites, 'demodex')} Demodex spp.</span>
            <span>${m(d.mites, 'sarcoptes')} Sarcoptes spp.</span>
            <span>${m(d.mites, 'otodectes')} Otodectes spp.</span>
            <span>${m(d.mites, 'other')} Other: ${blank(d.mites_other)}</span>
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
          <div class="write-lines write-lines-sm">${line(d.other_findings) || '&nbsp;<br>&nbsp;'}</div>
        </div>

        <div class="skin-section">
          <h3>Result / Impression</h3>
          <div class="tick-row">
            <span>${this.mark(d.result === 'negative')} Negative / No significant organisms detected</span>
            <span>${this.mark(d.result === 'positive')} Positive for: ${blank(d.positive_for)}</span>
          </div>
          <p><strong>Final Interpretation:</strong></p>
          <div class="write-lines write-lines-sm">${line(d.interpretation) || '&nbsp;<br>&nbsp;'}</div>
        </div>

        <div class="skin-section">
          <h3>Recommendations</h3>
          <div class="write-lines write-lines-sm">${line(d.recommendations) || '&nbsp;<br>&nbsp;'}</div>
        </div>
      </section>
    `;
  },

  FORM_PANEL_CODES: ['SKIN_SCRAPING', 'ULTRASOUND', 'BLOOD_PARASITE', 'FNA_CYTOLOGY', 'SURGICAL_CONSENT', 'TRAVEL_CERT'],
  DOC_PANEL_CODES: ['SURGICAL_CONSENT', 'TRAVEL_CERT'],

  isFormPanel(code) {
    return this.FORM_PANEL_CODES.includes(String(code || '').toUpperCase());
  },

  isDocPanel(code) {
    return this.DOC_PANEL_CODES.includes(String(code || '').toUpperCase());
  },

  fillLine(value) {
    const s = String(value == null ? '' : value).trim();
    if (s) return `<span class="ink">${this.escapeHtml(s)}</span>`;
    return '<span class="blank-line"></span>';
  },

  fillBlock(value, minLines) {
    const s = String(value == null ? '' : value).trim();
    if (s) {
      return `<div class="write-lines">${this.escapeHtml(s)}</div>`;
    }
    const n = Math.max(2, Number(minLines) || 3);
    const rows = Array.from({ length: n }).map(() => '<div class="line"></div>').join('');
    return `<div class="remarks-handwrite doc-blank-block"><div class="remarks-lines">${rows}</div></div>`;
  },

  emptyBloodParasite() {
    return {
      sample: [],
      smear: [],
      stain: [],
      stain_other: '',
      quality: [],
      screen: [],
      parasites: [],
      parasite_other: '',
      location: [],
      extra: [],
      extra_other: '',
      result: [],
      comments: '',
      examined_by: '',
    };
  },

  getBloodParasite(draft) {
    const d = draft || this.getDraft();
    const saved = (d.forms && d.forms.BLOOD_PARASITE) || {};
    return {
      ...this.emptyBloodParasite(),
      examined_by: d.referring_vet || '',
      ...saved,
    };
  },

  emptyFna() {
    return {
      sample_site: '',
      sample_type: [],
      sample_other: '',
      slides: '',
      stain: [],
      stain_other: '',
      cellularity: [],
      cell_types: [],
      cell_other: '',
      inflam_cells: [],
      features: [],
      microbes: [],
      microbe_other: '',
      impression: [],
      comments: '',
      examined_by: '',
    };
  },

  getFna(draft) {
    const d = draft || this.getDraft();
    const saved = (d.forms && d.forms.FNA_CYTOLOGY) || {};
    return {
      ...this.emptyFna(),
      examined_by: d.referring_vet || '',
      ...saved,
    };
  },

  emptyConsent() {
    return {
      owner_name: '',
      cnic: '',
      address: '',
      contact: '',
      animal_name: '',
      species: '',
      breed: '',
      sex: '',
      age: '',
      color: '',
      procedure: '',
      date_of_surgery: '',
      emergency: '',
      additional_notes: '',
      owner_sign_date: '',
      witness: '',
      vet_name: '',
      vet_qualification: '',
      vet_reg: '',
      vet_date: '',
    };
  },

  getConsent(draft) {
    const d = draft || this.getDraft();
    const saved = (d.forms && d.forms.SURGICAL_CONSENT) || {};
    return {
      ...this.emptyConsent(),
      owner_name: d.patient_name || '',
      contact: d.owner_phone || '',
      animal_name: d.pet_name || '',
      species: d.species || '',
      breed: d.breed || '',
      sex: d.sex || '',
      age: d.age || '',
      date_of_surgery: d.report_date || this.today(),
      vet_name: d.referring_vet || '',
      vet_date: d.report_date || this.today(),
      owner_sign_date: d.report_date || this.today(),
      ...saved,
    };
  },

  emptyTravel() {
    return {
      owner_name: '',
      cnic: '',
      address: '',
      contact: '',
      species: '',
      breed: '',
      sex: '',
      age: '',
      color: '',
      microchip: '',
      vaccination: '',
      deworming: '',
      rabies: '',
      destination: '',
      transport: '',
      exam_date: '',
      remarks: '',
      vet_name: '',
      vet_qualification: '',
      vet_reg: '',
      issue_date: '',
    };
  },

  getTravel(draft) {
    const d = draft || this.getDraft();
    const saved = (d.forms && d.forms.TRAVEL_CERT) || {};
    return {
      ...this.emptyTravel(),
      owner_name: d.patient_name || '',
      contact: d.owner_phone || '',
      species: d.species || '',
      breed: d.breed || '',
      sex: d.sex || '',
      age: d.age || '',
      exam_date: d.sample_date || d.report_date || this.today(),
      vet_name: d.referring_vet || '',
      issue_date: d.report_date || this.today(),
      ...saved,
    };
  },

  renderBloodParasiteHtml(data) {
    const d = { ...this.emptyBloodParasite(), ...(data || {}) };
    const has = (arr, key) => Array.isArray(arr) && arr.includes(key);
    const m = (arr, key) => this.mark(has(arr, key));
    return `
      <section class="skin-form">
        <h2>BLOOD PARASITE</h2>
        <div class="skin-section">
          <p><strong>Sample:</strong>
            ${m(d.sample, 'edta')} EDTA Blood
            &nbsp; ${m(d.sample, 'fresh')} Fresh Blood
          </p>
          <p><strong>Smear:</strong>
            ${m(d.smear, 'thin')} Thin Smear
            &nbsp; ${m(d.smear, 'thick')} Thick Smear
          </p>
          <p><strong>Stain:</strong>
            ${m(d.stain, 'diffquik')} Diff-Quik
            &nbsp; ${m(d.stain, 'giemsa')} Giemsa
            &nbsp; ${m(d.stain, 'wright')} Wright-Giemsa
            &nbsp; ${m(d.stain, 'other')} Other: ${this.fillLine(d.stain_other)}
          </p>
          <p><strong>Smear Quality:</strong>
            ${m(d.quality, 'good')} Good
            &nbsp; ${m(d.quality, 'adequate')} Adequate
            &nbsp; ${m(d.quality, 'poor')} Poor
          </p>
        </div>
        <div class="skin-section">
          <h3>Blood Parasite Screen</h3>
          <div class="tick-row">
            <span>${m(d.screen, 'none')} No Blood Parasites Observed</span>
            <span>${m(d.screen, 'detected')} Blood Parasite Detected / Suspected</span>
          </div>
          <p><strong>Parasite:</strong></p>
          <div class="tick-row">
            <span>${m(d.parasites, 'babesia')} Babesia spp.</span>
            <span>${m(d.parasites, 'ehrlichia')} Ehrlichia spp. / Morulae</span>
            <span>${m(d.parasites, 'anaplasma')} Anaplasma spp. / Morulae</span>
            <span>${m(d.parasites, 'mycoplasma')} Mycoplasma haemofelis / Hemoplasma</span>
            <span>${m(d.parasites, 'cytauxzoon')} Cytauxzoon spp.</span>
            <span>${m(d.parasites, 'hepatozoon')} Hepatozoon spp.</span>
            <span>${m(d.parasites, 'other')} Other: ${this.fillLine(d.parasite_other)}</span>
          </div>
          <p><strong>Location:</strong>
            ${m(d.location, 'rbc')} RBC
            &nbsp; ${m(d.location, 'wbc')} WBC
            &nbsp; ${m(d.location, 'platelet')} Platelet
            &nbsp; ${m(d.location, 'extra')} Extracellular
          </p>
        </div>
        <div class="skin-section">
          <h3>Additional Findings</h3>
          <div class="tick-row">
            <span>${m(d.extra, 'anemia')} Anemia</span>
            <span>${m(d.extra, 'polychromasia')} Polychromasia</span>
            <span>${m(d.extra, 'thrombo')} Thrombocytopenia Suspected</span>
            <span>${m(d.extra, 'clumping')} Platelet Clumping</span>
            <span>${m(d.extra, 'leukocyte')} Leukocyte Abnormalities</span>
            <span>${m(d.extra, 'other')} Other: ${this.fillLine(d.extra_other)}</span>
          </div>
        </div>
        <div class="skin-section">
          <h3>Final Result</h3>
          <div class="tick-row">
            <span>${m(d.result, 'negative')} Negative</span>
            <span>${m(d.result, 'positive')} Positive</span>
            <span>${m(d.result, 'suspected')} Suspected — Confirmatory Testing Recommended</span>
            <span>${m(d.result, 'inconclusive')} Inconclusive</span>
          </div>
          <p><strong>Comments:</strong></p>
          ${this.fillBlock(d.comments, 3)}
        </div>
        <div class="skin-section">
          <div class="doc-grid">
            <p><strong>Examined By:</strong> ${this.fillLine(d.examined_by)}</p>
            <p><strong>Signature:</strong> <span class="blank-line wide"></span></p>
          </div>
        </div>
      </section>
    `;
  },

  renderFnaHtml(data) {
    const d = { ...this.emptyFna(), ...(data || {}) };
    const has = (arr, key) => Array.isArray(arr) && arr.includes(key);
    const m = (arr, key) => this.mark(has(arr, key));
    return `
      <section class="skin-form">
        <h2>FNA CYTOLOGY</h2>
        <div class="skin-section">
          <h3>Sample Details</h3>
          <p><strong>Site / Lesion:</strong> ${this.fillLine(d.sample_site)}</p>
          <p><strong>Sample Type:</strong>
            ${m(d.sample_type, 'fna')} FNA
            &nbsp; ${m(d.sample_type, 'other')} Other: ${this.fillLine(d.sample_other)}
          </p>
          <p><strong>No. of Slides:</strong> ${this.fillLine(d.slides)}</p>
          <p><strong>Stain:</strong>
            ${m(d.stain, 'diffquik')} Diff-Quik
            &nbsp; ${m(d.stain, 'giemsa')} Giemsa
            &nbsp; ${m(d.stain, 'wright')} Wright-Giemsa
            &nbsp; ${m(d.stain, 'other')} Other: ${this.fillLine(d.stain_other)}
          </p>
        </div>
        <div class="skin-section">
          <h3>Cytological Findings</h3>
          <p><strong>Cellularity:</strong>
            ${m(d.cellularity, 'none')} None
            &nbsp; ${m(d.cellularity, 'low')} Low
            &nbsp; ${m(d.cellularity, 'moderate')} Moderate
            &nbsp; ${m(d.cellularity, 'high')} High
          </p>
          <p><strong>Cell Type:</strong></p>
          <div class="tick-row">
            <span>${m(d.cell_types, 'epithelial')} Epithelial</span>
            <span>${m(d.cell_types, 'mesenchymal')} Mesenchymal</span>
            <span>${m(d.cell_types, 'round')} Round Cell</span>
            <span>${m(d.cell_types, 'mixed')} Mixed</span>
            <span>${m(d.cell_types, 'other')} Other: ${this.fillLine(d.cell_other)}</span>
          </div>
          <p><strong>Inflammatory Cells:</strong></p>
          <div class="tick-row">
            <span>${m(d.inflam_cells, 'neutrophils')} Neutrophils</span>
            <span>${m(d.inflam_cells, 'lymphocytes')} Lymphocytes</span>
            <span>${m(d.inflam_cells, 'macrophages')} Macrophages</span>
            <span>${m(d.inflam_cells, 'eosinophils')} Eosinophils</span>
            <span>${m(d.inflam_cells, 'mixed')} Mixed</span>
          </div>
          <p><strong>Cellular Features:</strong></p>
          <div class="tick-row">
            <span>${m(d.features, 'no_atypia')} No Significant Atypia</span>
            <span>${m(d.features, 'mild_atypia')} Mild Atypia</span>
            <span>${m(d.features, 'mod_atypia')} Moderate Atypia</span>
            <span>${m(d.features, 'marked_atypia')} Marked Atypia</span>
            <span>${m(d.features, 'anisocytosis')} Anisocytosis</span>
            <span>${m(d.features, 'anisokaryosis')} Anisokaryosis</span>
            <span>${m(d.features, 'nc_ratio')} Increased N:C Ratio</span>
            <span>${m(d.features, 'mitoses')} Abnormal Mitoses</span>
            <span>${m(d.features, 'necrosis')} Necrosis</span>
          </div>
          <p><strong>Microorganisms:</strong>
            ${m(d.microbes, 'none')} None
            &nbsp; ${m(d.microbes, 'bacteria')} Bacteria
            &nbsp; ${m(d.microbes, 'fungi')} Fungi
            &nbsp; ${m(d.microbes, 'protozoa')} Protozoa
            &nbsp; ${m(d.microbes, 'other')} Other: ${this.fillLine(d.microbe_other)}
          </p>
        </div>
        <div class="skin-section">
          <h3>Cytological Impression</h3>
          <div class="tick-row">
            <span>${m(d.impression, 'nondiagnostic')} Non-Diagnostic</span>
            <span>${m(d.impression, 'inflammatory')} Inflammatory</span>
            <span>${m(d.impression, 'reactive')} Reactive/Hyperplastic</span>
            <span>${m(d.impression, 'benign')} Benign Neoplasia Suspected</span>
            <span>${m(d.impression, 'malignant')} Malignant Neoplasia Suspected</span>
            <span>${m(d.impression, 'inconclusive')} Inconclusive</span>
          </div>
          <p><strong>Diagnosis / Comments:</strong></p>
          ${this.fillBlock(d.comments, 3)}
        </div>
        <div class="skin-section">
          <div class="doc-grid">
            <p><strong>Examined By:</strong> ${this.fillLine(d.examined_by)}</p>
            <p><strong>Signature:</strong> <span class="blank-line wide"></span></p>
          </div>
        </div>
      </section>
    `;
  },

  renderConsentHtml(data) {
    const d = { ...this.emptyConsent(), ...(data || {}) };
    return `
      <section class="doc-form">
        <h2>SURGICAL CONSENT FORM</h2>
        <div class="skin-section">
          <p class="doc-intro">I, the undersigned owner (or authorized agent) of the animal described below, hereby give my consent to PetZone Veterinary Hospital and its staff to perform the surgical procedure(s) listed.</p>
          <div class="doc-grid">
            <p><strong>Owner’s Name:</strong> ${this.fillLine(d.owner_name)}</p>
            <p><strong>CNIC / Passport No.:</strong> ${this.fillLine(d.cnic)}</p>
            <p><strong>Address:</strong> ${this.fillLine(d.address)}</p>
            <p><strong>Contact No.:</strong> ${this.fillLine(d.contact)}</p>
            <p><strong>Animal Name:</strong> ${this.fillLine(d.animal_name)}</p>
            <p><strong>Species:</strong> ${this.fillLine(d.species)}</p>
            <p><strong>Breed:</strong> ${this.fillLine(d.breed)}</p>
            <p><strong>Sex:</strong> ${this.fillLine(d.sex)}</p>
            <p><strong>Age:</strong> ${this.fillLine(d.age)}</p>
            <p><strong>Color / Markings:</strong> ${this.fillLine(d.color)}</p>
            <p class="doc-span"><strong>Planned Procedure:</strong> ${this.fillLine(d.procedure)}</p>
            <p><strong>Date of Surgery:</strong> ${this.fillLine(d.date_of_surgery)}</p>
          </div>
        </div>
        <div class="skin-section">
          <h3>Risks &amp; Responsibilities</h3>
          <ul class="doc-bullets">
            <li>I understand that all surgical and anesthetic procedures carry some degree of risk, including but not limited to anesthetic complications, bleeding, infection, or unforeseen reactions.</li>
            <li>I have been advised of the general nature of the procedure, expected recovery, and possible complications.</li>
            <li>I understand that pre-anesthetic blood testing, IV fluid therapy, and pain management are recommended to minimize risks.</li>
            <li>I understand that if my pet is found to have any unforeseen condition during the procedure, the veterinarian will act in the best interest of the animal.</li>
            <li>I accept financial responsibility for all procedures performed and associated care.</li>
          </ul>
          <div class="tick-row">
            <span>${this.mark(d.emergency === 'yes')} I consent to emergency treatment if required during surgery.</span>
            <span>${this.mark(d.emergency === 'no')} I do not consent to emergency treatment beyond the stated procedure.</span>
          </div>
        </div>
        <div class="skin-section">
          <h3>Additional Notes</h3>
          ${this.fillBlock(d.additional_notes, 4)}
        </div>
        <div class="skin-section">
          <h3>Owner’s Declaration</h3>
          <p class="doc-intro">I declare that I am the legal owner or authorized agent of the above-mentioned animal. I have read and fully understand the nature of the procedure, the risks involved, and the financial responsibility.</p>
          <div class="doc-grid">
            <p><strong>Owner’s Signature:</strong> <span class="blank-line wide"></span></p>
            <p><strong>Date:</strong> ${this.fillLine(d.owner_sign_date)}</p>
            <p class="doc-span"><strong>Witness Name &amp; Signature:</strong> ${this.fillLine(d.witness)} <span class="blank-line"></span></p>
          </div>
        </div>
        <div class="skin-section">
          <h3>Veterinarian Details</h3>
          <div class="doc-grid">
            <p><strong>Veterinarian’s Name:</strong> ${this.fillLine(d.vet_name)}</p>
            <p><strong>Qualification:</strong> ${this.fillLine(d.vet_qualification)}</p>
            <p><strong>Reg. No.:</strong> ${this.fillLine(d.vet_reg)}</p>
            <p><strong>Date:</strong> ${this.fillLine(d.vet_date)}</p>
            <p class="doc-span"><strong>Signature &amp; Stamp:</strong> <span class="blank-line wide"></span></p>
          </div>
        </div>
      </section>
    `;
  },

  renderTravelHtml(data) {
    const d = { ...this.emptyTravel(), ...(data || {}) };
    return `
      <section class="doc-form">
        <h2>ANIMAL HEALTH CERTIFICATE FOR TRAVEL</h2>
        <div class="skin-section">
          <p class="doc-intro">This is to certify that the animal described below has been examined by me and was found to be in good health and fit for travel at the time of examination.</p>
          <div class="doc-grid">
            <p><strong>Owner’s Name:</strong> ${this.fillLine(d.owner_name)}</p>
            <p><strong>CNIC / Passport No.:</strong> ${this.fillLine(d.cnic)}</p>
            <p><strong>Address:</strong> ${this.fillLine(d.address)}</p>
            <p><strong>Contact No.:</strong> ${this.fillLine(d.contact)}</p>
            <p><strong>Animal Species:</strong> ${this.fillLine(d.species)}</p>
            <p><strong>Breed:</strong> ${this.fillLine(d.breed)}</p>
            <p><strong>Sex:</strong> ${this.fillLine(d.sex)}</p>
            <p><strong>Age:</strong> ${this.fillLine(d.age)}</p>
            <p><strong>Color / Markings:</strong> ${this.fillLine(d.color)}</p>
            <p><strong>Identification / Microchip No.:</strong> ${this.fillLine(d.microchip)}</p>
          </div>
        </div>
        <div class="skin-section">
          <h3>Health Status</h3>
          <p class="doc-intro">On clinical examination, the animal showed no signs of contagious or infectious diseases and is fit for travel.</p>
          <div class="doc-grid">
            <p><strong>Vaccination Status:</strong> ${this.fillLine(d.vaccination)}</p>
            <p><strong>Last Deworming:</strong> ${this.fillLine(d.deworming)}</p>
            <p><strong>Rabies Vaccination:</strong> ${this.fillLine(d.rabies)}</p>
            <p><strong>Destination:</strong> ${this.fillLine(d.destination)}</p>
            <p><strong>Mode of Transport:</strong> ${this.fillLine(d.transport)}</p>
            <p><strong>Date of Examination:</strong> ${this.fillLine(d.exam_date)}</p>
          </div>
        </div>
        <div class="skin-section">
          <h3>Veterinarian’s Remarks</h3>
          ${this.fillBlock(d.remarks, 3)}
        </div>
        <div class="skin-section">
          <h3>Veterinarian Details</h3>
          <div class="doc-grid">
            <p><strong>Veterinarian’s Name:</strong> ${this.fillLine(d.vet_name)}</p>
            <p><strong>Qualification:</strong> ${this.fillLine(d.vet_qualification)}</p>
            <p><strong>Reg. No.:</strong> ${this.fillLine(d.vet_reg)}</p>
            <p><strong>Date of Issue:</strong> ${this.fillLine(d.issue_date)}</p>
            <p class="doc-span"><strong>Signature &amp; Stamp:</strong> <span class="blank-line wide"></span></p>
          </div>
          <p class="doc-note">This certificate is valid only at the time of issue and as per the travel regulations of the concerned authority.</p>
        </div>
      </section>
    `;
  },

  renderSpecialPanelHtml(code, draftOrReport) {
    const c = String(code || '').toUpperCase();
    const forms = (draftOrReport && draftOrReport.forms) || {};
    if (c === 'SKIN_SCRAPING') return this.renderSkinScrapingHtml(forms.SKIN_SCRAPING);
    if (c === 'ULTRASOUND') return this.renderUltrasoundSectionHtml(forms.ULTRASOUND, draftOrReport.images || []);
    if (c === 'BLOOD_PARASITE') return this.renderBloodParasiteHtml(this.getBloodParasite(draftOrReport));
    if (c === 'FNA_CYTOLOGY') return this.renderFnaHtml(this.getFna(draftOrReport));
    if (c === 'SURGICAL_CONSENT') return this.renderConsentHtml(this.getConsent(draftOrReport));
    if (c === 'TRAVEL_CERT') return this.renderTravelHtml(this.getTravel(draftOrReport));
    return '';
  },

  docSubtitle(code) {
    const c = String(code || '').toUpperCase();
    if (c === 'SURGICAL_CONSENT') return 'Surgical Consent Form';
    if (c === 'TRAVEL_CERT') return 'Animal Health Certificate for Travel';
    return 'Diagnostic Laboratory Report';
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
