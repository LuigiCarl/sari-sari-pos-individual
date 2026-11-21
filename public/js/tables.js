(function () {
  function getCellValue(row, colIndex) {
    const cell = row.cells[colIndex];
    if (!cell) return '';
    const input = cell.querySelector('input:not([type="checkbox"]), select');
    if (input) {
      if (input.tagName === 'SELECT') {
        const opt = input.options[input.selectedIndex];
        return opt ? opt.text.trim() : '';
      }
      return input.value.trim();
    }
    const checkbox = cell.querySelector('input[type="checkbox"]');
    if (checkbox) return checkbox.checked ? '1' : '0';
    return cell.textContent.trim();
  }

  function parseNumeric(val) {
    const cleaned = val.replace(/[₱,\s]/g, '');
    const match = cleaned.match(/^[-+]?\d*\.?\d+/);
    return match ? Number(match[0]) : NaN;
  }

  function getRowSearchText(row) {
    let text = row.textContent || '';
    row.querySelectorAll('input:not([type="checkbox"]), select').forEach((el) => {
      if (el.tagName === 'SELECT') {
        const opt = el.options[el.selectedIndex];
        if (opt) text += ' ' + opt.text;
      } else {
        text += ' ' + el.value;
      }
    });
    return text.toLowerCase();
  }

  function buildPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('…');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  }

  function csvEscape(val) {
    const str = String(val == null ? '' : val).replace(/\s+/g, ' ').trim();
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function exportTableCsv(table, rows, baseName) {
    const headers = table.tHead ? Array.from(table.tHead.rows[0].cells) : [];
    const includedCols = [];
    const headerNames = [];

    headers.forEach((th, idx) => {
      if (th.classList.contains('col-actions') || th.dataset.noExport === 'true') return;
      includedCols.push(idx);
      headerNames.push(th.textContent.trim());
    });

    const lines = [headerNames.map(csvEscape).join(',')];
    rows.forEach((row) => {
      const vals = includedCols.map((colIdx) => {
        const cell = row.cells[colIdx];
        if (!cell) return '';
        const cb = cell.querySelector('input[type="checkbox"]');
        if (cb) return cb.checked ? 'Active' : 'Inactive';
        return getCellValue(row, colIdx);
      });
      lines.push(vals.map(csvEscape).join(','));
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    const cleanBase = (baseName || table.id || 'export').replace(/\.csv$/i, '');
    a.href = url;
    a.download = `${cleanBase}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Unified Table Controller (Filtering + Sorting + Pagination + CSV Export)
  document.querySelectorAll('table.table').forEach((table) => {
    const tbody = table.tBodies[0];
    if (!tbody) return;

    const tableId = table.id;
    const filterInput = tableId ? document.querySelector(`[data-table-filter="${tableId}"]`) : null;
    const countEl = tableId ? document.querySelector(`[data-table-count="${tableId}"]`) : null;
    const exportBtn = tableId ? document.querySelector(`[data-table-export="${tableId}"]`) : null;
    const initialPageSize = Number(table.dataset.paginate) || 0;
    const colCount = table.tHead ? table.tHead.rows[0].cells.length : 1;

    const state = {
      query: '',
      page: 1,
      pageSize: initialPageSize,
    };

    let emptyRow = null;
    if (filterInput) {
      emptyRow = document.createElement('tr');
      emptyRow.className = 'table-empty-filter';
      emptyRow.hidden = true;
      emptyRow.innerHTML = `<td colspan="${colCount}" class="table-empty-cell">No matching records found.</td>`;
      tbody.appendChild(emptyRow);
    }

    // Create Pagination Bar if data-paginate is enabled
    let paginationEl = null;
    if (initialPageSize > 0) {
      paginationEl = document.createElement('div');
      paginationEl.className = 'table-pagination';
      const scrollWrap = table.closest('.table-scroll');
      if (scrollWrap && scrollWrap.parentNode) {
        scrollWrap.parentNode.insertBefore(paginationEl, scrollWrap.nextSibling);
      } else if (table.parentNode) {
        table.parentNode.insertBefore(paginationEl, table.nextSibling);
      }
    }

    function getDataRows() {
      return Array.from(tbody.rows).filter((r) => !r.classList.contains('table-empty-filter'));
    }

    function renderPagination(totalMatching, totalAll, totalPages, startIdx, endIdx) {
      if (!paginationEl) return;
      if (totalAll === 0) {
        paginationEl.hidden = true;
        return;
      }
      paginationEl.hidden = false;

      const showingText =
        totalMatching === 0
          ? 'Showing 0 results'
          : `Showing ${startIdx + 1}–${endIdx} of ${totalMatching}${totalMatching !== totalAll ? ` (filtered from ${totalAll})` : ''}`;

      const sizes = [5, 10, 25, 50];
      if (!sizes.includes(state.pageSize)) sizes.push(state.pageSize);
      sizes.sort((a, b) => a - b);

      const pageItems = buildPageNumbers(state.page, totalPages);

      paginationEl.innerHTML = `
        <div class="pagination-info">
          <span>${showingText}</span>
          <label class="pagination-size">
            <span class="sr-only">Rows per page</span>
            <select data-page-size aria-label="Rows per page">
              ${sizes.map((s) => `<option value="${s}" ${s === state.pageSize ? 'selected' : ''}>${s} / page</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="pagination-controls" role="navigation" aria-label="Table pagination">
          <button type="button" class="page-btn" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''} aria-label="Previous page">‹ Prev</button>
          ${pageItems
            .map((p) =>
              p === '…'
                ? '<span class="page-ellipsis" aria-hidden="true">…</span>'
                : `<button type="button" class="page-btn ${p === state.page ? 'is-active' : ''}" data-page="${p}" ${p === state.page ? 'aria-current="page"' : ''}>${p}</button>`
            )
            .join('')}
          <button type="button" class="page-btn" data-page="${state.page + 1}" ${state.page >= totalPages ? 'disabled' : ''} aria-label="Next page">Next ›</button>
        </div>
      `;
    }

    function updateView() {
      const allRows = getDataRows();
      const q = state.query;
      const matching = q ? allRows.filter((r) => getRowSearchText(r).includes(q)) : allRows;

      let totalPages = 1;
      let startIdx = 0;
      let endIdx = matching.length;

      if (state.pageSize > 0) {
        totalPages = Math.max(1, Math.ceil(matching.length / state.pageSize));
        if (state.page > totalPages) state.page = totalPages;
        if (state.page < 1) state.page = 1;
        startIdx = (state.page - 1) * state.pageSize;
        endIdx = Math.min(startIdx + state.pageSize, matching.length);
      }

      const visibleSet = new Set(matching.slice(startIdx, endIdx));
      allRows.forEach((row) => {
        row.hidden = !visibleSet.has(row);
      });

      if (emptyRow) {
        emptyRow.hidden = matching.length > 0 || allRows.length === 0;
      }

      if (countEl) {
        countEl.textContent = q ? `${matching.length} of ${allRows.length}` : `${allRows.length} total`;
      }

      renderPagination(matching.length, allRows.length, totalPages, startIdx, endIdx);
    }

    if (filterInput) {
      filterInput.addEventListener('input', () => {
        state.query = filterInput.value.trim().toLowerCase();
        state.page = 1;
        updateView();
      });
    }

    if (paginationEl) {
      paginationEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-page]');
        if (!btn || btn.disabled) return;
        state.page = Number(btn.dataset.page);
        updateView();
      });
      paginationEl.addEventListener('change', (e) => {
        const sel = e.target.closest('select[data-page-size]');
        if (!sel) return;
        state.pageSize = Number(sel.value) || 10;
        state.page = 1;
        updateView();
      });
    }

    // Column Sorting
    table.querySelectorAll('th[data-sort]').forEach((th) => {
      th.setAttribute('tabindex', '0');
      th.setAttribute('role', 'button');
      th.setAttribute('aria-sort', 'none');

      function sortColumn() {
        const colIndex = th.cellIndex;
        const type = th.dataset.sort || 'text';
        const currentDir = th.getAttribute('aria-sort');
        const nextDir = currentDir === 'ascending' ? 'descending' : 'ascending';

        table.querySelectorAll('th[data-sort]').forEach((other) => {
          if (other !== th) other.setAttribute('aria-sort', 'none');
        });
        th.setAttribute('aria-sort', nextDir);

        const rows = getDataRows();
        rows.sort((a, b) => {
          const av = getCellValue(a, colIndex);
          const bv = getCellValue(b, colIndex);
          let cmp = 0;

          if (type === 'number') {
            const an = parseNumeric(av);
            const bn = parseNumeric(bv);
            if (!Number.isNaN(an) && !Number.isNaN(bn)) {
              cmp = an - bn;
            } else {
              cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
            }
          } else {
            cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
          }

          return nextDir === 'ascending' ? cmp : -cmp;
        });

        rows.forEach((r) => tbody.appendChild(r));
        if (emptyRow) tbody.appendChild(emptyRow);
        state.page = 1;
        updateView();
      }

      th.addEventListener('click', sortColumn);
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sortColumn();
        }
      });
    });

    // Unsaved-change highlight for inline editable tables (Products)
    if (table.classList.contains('table-editable')) {
      table.addEventListener('input', (e) => {
        const row = e.target.closest('tr');
        if (row) row.classList.add('row-dirty');
      });
      table.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        if (row) row.classList.add('row-dirty');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const allRows = getDataRows();
        const q = state.query;
        const matching = q ? allRows.filter((r) => getRowSearchText(r).includes(q)) : allRows;
        exportTableCsv(table, matching, exportBtn.dataset.exportFilename);
      });
    }

    if (filterInput || initialPageSize > 0) {
      updateView();
    }
  });
})();
