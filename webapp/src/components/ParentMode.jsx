import { useEffect, useMemo, useState } from 'react'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import { curatedChannels } from '../lib/channels.js'
import { searchChannels, resolveChannel, evictChannelCache, formatSubscribers } from '../lib/youtubeApi.js'

const API_CONSOLE_URL = 'https://console.cloud.google.com/apis/library/youtube.googleapis.com'
const looksLikeLink = s => /^@|^UC[0-9A-Za-z_-]{22}$|youtube\.com/.test(s.trim())
const channelUrl = ch => ch.source_url ?? `https://www.youtube.com/channel/${ch.channel_id}`

export default function ParentMode({ db, store, onDone }) {
  return (
    <div className="parent-mode container py-4" style={{ maxWidth: 720 }}>
      <div className="d-flex align-items-center mb-4">
        <h1 className="fs-3 fw-bold m-0 me-auto">
          <i className="fa-sharp-duotone fa-regular fa-family me-2 text-danger" />
          Parent mode
        </h1>
        <button type="button" className="btn btn-danger btn-lg" onClick={onDone}>
          <i className="fa-sharp-duotone fa-regular fa-check me-2" />
          Done
        </button>
      </div>

      <AgeRow value={store.settings.ageRange} onChange={store.setAgeRange} />
      <ApiKeyRow apiKey={store.settings.apiKey} onChange={store.setApiKey} />
      <SearchRow apiKey={store.settings.apiKey} store={store} />
      <ChannelTable db={db} store={store} />
    </div>
  )
}

function AgeRow({ value: [lo, hi], onChange }) {
  const pos = v => `calc(${(v - 1) / 14} * (100% - 32px) + 16px)`
  return (
    <div className="d-flex align-items-center gap-3 mb-3">
      <span className="text-secondary text-nowrap">
        <i className="fa-sharp-duotone fa-regular fa-children me-2" />
        Age:
      </span>
      <div className="dual-slider flex-grow-1">
        <input
          type="range"
          min="1"
          max="15"
          value={lo}
          aria-label="Youngest age"
          onChange={e => onChange([Math.min(+e.target.value, hi), hi])}
        />
        <input
          type="range"
          min="1"
          max="15"
          value={hi}
          aria-label="Oldest age"
          onChange={e => onChange([lo, Math.max(+e.target.value, lo)])}
        />
        <span className="thumb-label" style={{ left: pos(lo) }}>{lo}</span>
        <span className="thumb-label" style={{ left: pos(hi) }}>{hi}</span>
      </div>
    </div>
  )
}

function ApiKeyRow({ apiKey, onChange }) {
  return (
    <div className="d-flex align-items-center gap-3 mb-3">
      <span className="text-secondary text-nowrap">
        <i className="fa-sharp-duotone fa-regular fa-key me-2" />
        <a href={API_CONSOLE_URL} target="_blank" rel="noreferrer">YouTube API Key</a>:
      </span>
      <input
        type="password"
        className="form-control"
        placeholder="AIza… (needed to add channels)"
        defaultValue={apiKey}
        onBlur={e => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  )
}

function SearchRow({ apiKey, store }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // inline autocomplete: debounced 500ms, min 3 chars (search.list = 100
  // quota units per fired query, so don't search every keystroke)
  useEffect(() => {
    const q = query.trim()
    if (!apiKey || q.length < 3) {
      setResults([])
      setError(null)
      return
    }
    let stale = false
    const timer = setTimeout(async () => {
      setBusy(true)
      try {
        const found = looksLikeLink(q) ? [await resolveChannel(apiKey, q)] : await searchChannels(apiKey, q)
        if (!stale) {
          setResults(found)
          setError(null)
        }
      } catch (err) {
        if (!stale) {
          setResults([])
          setError(err.message)
        }
      } finally {
        if (!stale) setBusy(false)
      }
    }, 500)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query, apiKey])

  return (
    <div className="mb-3">
      <div className="d-flex align-items-center gap-3">
        <span className="text-secondary text-nowrap">
          <i className="fa-sharp-duotone fa-regular fa-magnifying-glass me-2" />
          Add:
        </span>
        <div className="position-relative flex-grow-1">
          <input
            type="text"
            className="form-control"
            placeholder={apiKey ? 'Channel name, @handle, or URL' : 'Enter an API key above first'}
            disabled={!apiKey}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {busy && (
            <span
              className="spinner-border spinner-border-sm position-absolute top-50 end-0 translate-middle-y me-2"
              role="status"
            />
          )}
        </div>
      </div>
      {error && <div className="alert alert-warning mt-2 py-2">{error}</div>}
      {results.map(ch => (
        <div key={ch.channel_id} className="d-flex align-items-center gap-3 bg-body-tertiary rounded p-2 mt-2">
          <img src={ch.thumbnail} alt="" width="36" height="36" className="rounded-circle" />
          <span className="fw-semibold text-truncate">{ch.channel_title}</span>
          <span className="me-auto text-secondary small text-nowrap">{formatSubscribers(ch.subscribers)}</span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              store.addCustomChannel({ ...ch, min_age: 1, max_age: 15 })
              setQuery('')
            }}
          >
            <i className="fa-sharp-duotone fa-regular fa-plus me-1" />
            Add
          </button>
        </div>
      ))}
    </div>
  )
}

function AgeCell({ row, field, store }) {
  const ch = row.original
  const save = ch.custom
    ? patch => store.updateCustomChannel(ch.channel_id, patch)
    : patch => store.setOverride(ch.channel_id, patch)
  return (
    <input
      type="number"
      min="1"
      max="15"
      className="form-control form-control-sm age-input"
      value={ch[field]}
      onChange={e => save({ [field]: +e.target.value })}
    />
  )
}

function ChannelTable({ db, store }) {
  const { customChannels, overrides } = store.settings
  const hiddenCount = Object.values(overrides).filter(o => o.hidden).length

  const data = useMemo(
    () => [
      ...customChannels.map(ch => ({ ...ch, custom: true })),
      ...curatedChannels(db, overrides).filter(ch => !ch.hidden),
    ],
    [db, customChannels, overrides],
  )

  const columns = useMemo(
    () => [
      {
        header: 'Channel',
        accessorKey: 'channel_title',
        cell: ({ row }) => {
          const ch = row.original
          const avatar = ch.thumbnail ?? ch.videos?.[0]?.thumbnail
          return (
            <a
              href={channelUrl(ch)}
              target="_blank"
              rel="noreferrer"
              className="fw-semibold d-inline-flex align-items-center gap-2"
            >
              {avatar && <img src={avatar} alt="" width="36" height="36" className="rounded-circle object-fit-cover" />}
              {ch.channel_title}
            </a>
          )
        },
      },
      { header: 'Min age', id: 'min_age', cell: props => <AgeCell {...props} field="min_age" store={store} /> },
      { header: 'Max age', id: 'max_age', cell: props => <AgeCell {...props} field="max_age" store={store} /> },
      {
        id: 'delete',
        header: '',
        cell: ({ row }) => (
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            aria-label={`Delete ${row.original.channel_title}`}
            onClick={() => {
              const ch = row.original
              if (ch.custom) {
                store.removeCustomChannel(ch.channel_id)
                evictChannelCache(ch.channel_id)
              } else {
                store.setOverride(ch.channel_id, { hidden: true })
              }
            }}
          >
            <i className="fa-sharp-duotone fa-regular fa-trash" />
          </button>
        ),
      },
    ],
    [store],
  )

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <>
      <table className="table table-dark table-hover align-middle">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(h => (
                <th key={h.id} className="text-secondary fw-normal">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hiddenCount > 0 && (
        <button
          type="button"
          className="btn btn-link btn-sm text-secondary"
          onClick={() => store.restoreHidden()}
        >
          restore {hiddenCount} deleted built-in channel{hiddenCount > 1 ? 's' : ''}
        </button>
      )}
    </>
  )
}
