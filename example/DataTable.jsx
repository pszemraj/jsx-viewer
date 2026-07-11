/**
 * DataTable.jsx — Complex JSX Demo
 *
 * Patterns demonstrated:
 *  - Compound components  (DataTable.Column / .Toolbar / .Pagination)
 *  - Render props         (Toolbar children-as-function)
 *  - Fragment with keys   (explicit <Fragment key={…}> in tbody)
 *  - Context              (TableContext shared across sub-components)
 *  - React.Children scan  (extracting Column configs at runtime)
 *  - Lazy + Suspense      (async EmptyState via Promise.resolve trick)
 *  - memo + useCallback   (referential-stability discipline)
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  memo,
  Suspense,
  lazy,
  Fragment,
} from 'react';

// ─── Tokens ──────────────────────────────────────────────────────────────────

const C = {
  bg:        '#0d0d0f',
  surface:   '#141418',
  border:    '#1e1e26',
  muted:     '#3a3a48',
  dim:       '#6b6b80',
  text:      '#e2e2ee',
  textSoft:  '#9898b0',
  accent:    '#7c6af7',
  accentDim: '#2a2250',
  success:   '#34d399',
  danger:    '#f87171',
  gold:      '#fbbf24',
  font:      "'Geist Mono', 'Fira Code', monospace",
};

// ─── Context ─────────────────────────────────────────────────────────────────

const TableContext = createContext(null);

function useTableContext() {
  const ctx = useContext(TableContext);
  if (!ctx) throw new Error('<DataTable.*> must be rendered inside <DataTable>');
  return ctx;
}

// ─── Lazy EmptyState (Suspense demo) ─────────────────────────────────────────
// Using Promise.resolve so we don't need a real async boundary,
// but the Suspense fallback still fires on first render.

const EmptyState = lazy(() =>
  Promise.resolve({
    default: memo(function EmptyState({ message }) {
      return (
        <tr>
          <td
            colSpan={999}
            style={{
              textAlign: 'center',
              padding: '3rem',
              color: C.dim,
              fontSize: 13,
              fontFamily: C.font,
              letterSpacing: '0.05em',
            }}
          >
            ∅ &nbsp;{message ?? 'No data'}
          </td>
        </tr>
      );
    }),
  })
);

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Column — purely declarative config; renders nothing itself.
 * Parent reads its props via React.Children.
 */
function Column() {
  return null;
}
Column.displayName = 'DataTable.Column';

/**
 * Toolbar — render-prop children get { selectedCount, total, clearSelection }.
 * Falls back to plain children if not a function.
 */
function Toolbar({ children }) {
  const { selectedRows, setSelectedRows, data } = useTableContext();

  const clearSelection = useCallback(
    () => setSelectedRows(new Set()),
    [setSelectedRows]
  );

  const payload = {
    selectedCount: selectedRows.size,
    total: data.length,
    clearSelection,
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '10px 14px',
        background: C.surface,
        borderRadius: '8px 8px 0 0',
        borderBottom: `1px solid ${C.border}`,
        fontFamily: C.font,
        fontSize: 12,
        color: C.textSoft,
        minHeight: 44,
      }}
    >
      {typeof children === 'function' ? children(payload) : children}
    </div>
  );
}
Toolbar.displayName = 'DataTable.Toolbar';

/**
 * Pagination — reads page/setPage/pageSize/data from context.
 */
function Pagination() {
  const { page, setPage, pageSize, data } = useTableContext();
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  const btn = (label, action, disabled) => (
    <button
      onClick={action}
      disabled={disabled}
      style={{
        padding: '4px 12px',
        background: disabled ? C.muted : C.accentDim,
        color: disabled ? C.dim : C.accent,
        border: `1px solid ${disabled ? C.muted : C.accent}`,
        borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: C.font,
        fontSize: 11,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '10px 14px',
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        borderRadius: '0 0 8px 8px',
        fontFamily: C.font,
        fontSize: 12,
        color: C.dim,
      }}
    >
      {btn('← prev', () => setPage(p => p - 1), page === 0)}
      <span style={{ color: C.textSoft }}>
        page <span style={{ color: C.text }}>{page + 1}</span> / {totalPages}
      </span>
      {btn('next →', () => setPage(p => p + 1), page >= totalPages - 1)}
    </div>
  );
}
Pagination.displayName = 'DataTable.Pagination';

// ─── Main DataTable ───────────────────────────────────────────────────────────

const DataTable = memo(function DataTable({
  data,
  children,
  pageSize = 6,
  onRowClick,
}) {
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [page, setPage]                 = useState(0);
  const [sortKey, setSortKey]           = useState(null);
  const [sortDir, setSortDir]           = useState('asc');

  // ── Compound-component extraction ──────────────────────────────────────────
  // React.Children lets us treat JSX children as declarative config nodes.
  const columns = useMemo(
    () =>
      React.Children.toArray(children)
        .filter(child => child.type === Column)
        .map(child => child.props),
    [children]
  );

  const otherChildren = useMemo(
    () =>
      React.Children.toArray(children).filter(child => child.type !== Column),
    [children]
  );

  // ── Sorting + paging ───────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const paged = useMemo(
    () => sorted.slice(page * pageSize, (page + 1) * pageSize),
    [sorted, page, pageSize]
  );

  const toggleSort = useCallback((accessor) => {
    setSortKey(prev => {
      if (prev === accessor) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return accessor;
      }
      setSortDir('asc');
      return accessor;
    });
    setPage(0);
  }, []);

  const toggleRow = useCallback((id) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Context value — memo'd to avoid downstream re-renders ──────────────────
  const ctx = useMemo(
    () => ({ selectedRows, setSelectedRows, data, page, setPage, pageSize }),
    [selectedRows, data, page, pageSize]
  );

  const toolbar    = otherChildren.find(c => c.type === Toolbar);
  const pagination = otherChildren.find(c => c.type === Pagination);

  return (
    <TableContext.Provider value={ctx}>
      <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        {toolbar}

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: C.bg,
            fontFamily: C.font,
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ background: C.surface }}>
              <th style={{ ...th, width: 40 }} />
              {columns.map(col => (
                <th
                  key={col.accessor}
                  style={{ ...th, cursor: col.sortable !== false ? 'pointer' : 'default' }}
                  onClick={() => col.sortable !== false && toggleSort(col.accessor)}
                >
                  {col.header}
                  {sortKey === col.accessor && (
                    <span style={{ marginLeft: 4, color: C.accent }}>
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Suspense wraps the lazy EmptyState */}
            <Suspense
              fallback={
                <tr>
                  <td colSpan={999} style={{ padding: 24, color: C.dim, textAlign: 'center', fontFamily: C.font }}>
                    …
                  </td>
                </tr>
              }
            >
              {paged.length === 0 ? (
                <EmptyState message="No results" />
              ) : (
                /* Fragment with explicit key — required when wrapping multi-row
                   expansions; can't use the <> shorthand here */
                paged.map(row => (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => {
                        toggleRow(row.id);
                        onRowClick?.(row);
                      }}
                      style={{
                        cursor: 'pointer',
                        background: selectedRows.has(row.id) ? C.accentDim : 'transparent',
                        borderLeft: selectedRows.has(row.id)
                          ? `3px solid ${C.accent}`
                          : '3px solid transparent',
                        transition: 'background 0.12s',
                      }}
                    >
                      <td style={td}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ accentColor: C.accent }}
                        />
                      </td>
                      {columns.map(col => (
                        <td key={col.accessor} style={td}>
                          {typeof col.render === 'function'
                            ? col.render(row[col.accessor], row)  // render prop
                            : row[col.accessor]}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))
              )}
            </Suspense>
          </tbody>
        </table>

        {pagination}
      </div>
    </TableContext.Provider>
  );
});

// Attach sub-components as static properties
DataTable.Column     = Column;
DataTable.Toolbar    = Toolbar;
DataTable.Pagination = Pagination;

// ─── Styles ───────────────────────────────────────────────────────────────────

const th = {
  padding: '10px 14px',
  textAlign: 'left',
  color: C.dim,
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  borderBottom: `1px solid ${C.border}`,
  userSelect: 'none',
};

const td = {
  padding: '10px 14px',
  color: C.text,
  borderBottom: `1px solid ${C.border}`,
};

// ─── Sample data ──────────────────────────────────────────────────────────────

const NAMES  = ['Harlow', 'Sable', 'Riven', 'Dax', 'Cass', 'Lyra', 'Ember', 'Orin'];
const ROLES  = ['Engineer', 'Designer', 'PM', 'QA', 'DevRel'];
const TEAMS  = ['Platform', 'Growth', 'Core', 'Infra'];

const SAMPLE = Array.from({ length: 31 }, (_, i) => ({
  id:     i + 1,
  name:   `${NAMES[i % NAMES.length]} ${String.fromCharCode(65 + (i % 8))}`,
  role:   ROLES[i % ROLES.length],
  team:   TEAMS[i % TEAMS.length],
  status: i % 4 === 0 ? 'inactive' : 'active',
  score:  Math.floor(42 + ((i * 37 + 13) % 59)),   // deterministic, no re-render drift
}));

// ─── App / Demo ───────────────────────────────────────────────────────────────

export default function App() {
  const [lastRow, setLastRow] = useState(null);

  return (
    <div
      style={{
        padding: 32,
        background: C.bg,
        minHeight: '100vh',
        color: C.text,
        fontFamily: C.font,
      }}
    >
      <p style={{ fontSize: 11, color: C.dim, letterSpacing: '0.1em', marginBottom: 4 }}>
        COMPLEX JSX DEMO
      </p>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: C.text }}>
        DataTable
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 12, color: C.dim }}>
        compound · render-prop · context · Suspense · Fragment-with-key · memo
      </p>

      {lastRow && (
        <div
          style={{
            marginBottom: 16,
            padding: '8px 14px',
            background: C.accentDim,
            borderLeft: `3px solid ${C.accent}`,
            borderRadius: 4,
            fontSize: 12,
            color: C.accent,
          }}
        >
          Last clicked → <strong>{lastRow.name}</strong> ({lastRow.role}, {lastRow.team})
        </div>
      )}

      <DataTable data={SAMPLE} pageSize={7} onRowClick={setLastRow}>

        {/* Toolbar: render prop — children-as-function gets context-derived data */}
        <DataTable.Toolbar>
          {({ selectedCount, total, clearSelection }) => (
            <>
              <span>
                <span style={{ color: C.accent, fontWeight: 700 }}>{selectedCount}</span>
                <span style={{ color: C.dim }}> / {total} selected</span>
              </span>
              {selectedCount > 0 && (
                <>
                  <Btn onClick={clearSelection} variant="ghost">Clear</Btn>
                  <Btn variant="danger">Delete {selectedCount}</Btn>
                </>
              )}
            </>
          )}
        </DataTable.Toolbar>

        {/* Column: declarative config scanned by parent via React.Children */}
        <DataTable.Column accessor="name"   header="Name" />
        <DataTable.Column accessor="role"   header="Role" />
        <DataTable.Column accessor="team"   header="Team" />
        <DataTable.Column
          accessor="status"
          header="Status"
          render={val => (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 10,
                letterSpacing: '0.05em',
                background: val === 'active' ? '#052e16' : '#1c0a0a',
                color:      val === 'active' ? C.success   : C.danger,
                border:     `1px solid ${val === 'active' ? '#065f46' : '#450a0a'}`,
              }}
            >
              {val}
            </span>
          )}
        />
        <DataTable.Column
          accessor="score"
          header="Score"
          render={val => (
            <span
              style={{
                fontWeight: 700,
                color: val >= 80 ? C.gold : val >= 60 ? C.success : C.dim,
              }}
            >
              {val}
            </span>
          )}
        />

        <DataTable.Pagination />
      </DataTable>
    </div>
  );
}

// ─── Tiny local Btn to avoid external deps ────────────────────────────────────

function Btn({ children, onClick, variant = 'default' }) {
  const variants = {
    default: { bg: C.accentDim, color: C.accent,  border: C.accent },
    ghost:   { bg: 'transparent', color: C.dim,    border: C.muted  },
    danger:  { bg: '#1c0a0a',   color: C.danger,   border: '#450a0a' },
  };
  const v = variants[variant];
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: 5,
        cursor: 'pointer',
        fontFamily: C.font,
        fontSize: 11,
      }}
    >
      {children}
    </button>
  );
}
