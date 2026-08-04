import { useEffect, useMemo, useState } from 'react'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import { curatedChannels, overlaps } from '../lib/channels.js'
import { searchChannels, resolveChannel, evictChannelCache, formatSubscribers } from '../lib/youtubeApi.js'

const API_CONSOLE_URL = 'https://console.cloud.google.com/apis/library/youtube.googleapis.com'
const looksLikeLink = s => /^@|^UC[0-9A-Za-z_-]{22}$|youtube\.com/.test(s.trim())
const channelUrl = ch => ch.source_url ?? `https://www.youtube.com/channel/${ch.channel_id}`

export default function Settings({ db, store, onDone }) {
  return (
    <div className="settings container-xl py-4">
      <div className="d-flex align-items-center mb-4">
        <h1 className="fs-3 fw-bold m-0 me-auto">
          <i className="fa-sharp-duotone fa-regular fa-family me-2 text-danger" />
          Settings
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
      <VersionFooter />
    </div>
  )
}

function VersionFooter() {
  const sha = typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : ''
  if (!sha) return null
  return (
    <div className="text-center mt-4">
      <a
        href={`https://github.com/pathikrit/TinyTube/commit/${sha}`}
        target="_blank"
        rel="noreferrer"
        className="text-secondary small text-decoration-none"
      >
        <i className="fa-sharp-duotone fa-regular fa-code-commit me-1" />
        v{sha.slice(0, 7)}
      </a>
    </div>
  )
}

function DualAgeSlider({ value: [lo, hi], onChange }) {
  const pos = v => `calc(${(v - 1) / 14} * (100% - 32px) + 16px)`
  return (
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
  )
}

function AgeRow({ value, onChange }) {
  return (
    <div className="d-flex align-items-center gap-3 mb-3">
      <span className="text-secondary text-nowrap">
        <i className="fa-sharp-duotone fa-regular fa-children me-2" />
        Age:
      </span>
      <DualAgeSlider value={value} onChange={onChange} />
    </div>
  )
}

function ApiKeyRow({ apiKey, onChange }) {
  return (
    <div className="d-flex align-items-center gap-3 mb-3">
      <span className="text-secondary text-nowrap">
        <i className="fa-sharp-duotone fa-regular fa-key me-2" />
        <a href={API_CONSOLE_URL} target="_blank" rel="noreferrer">YouTube API Key</a>
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
          Add Channel
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

function ChannelAgeSlider({ ch, store }) {
  const save = ch.custom
    ? patch => store.updateCustomChannel(ch.channel_id, patch)
    : patch => store.setOverride(ch.channel_id, patch)
  return (
    <DualAgeSlider
      value={[ch.min_age, ch.max_age]}
      onChange={([min_age, max_age]) => save({ min_age, max_age })}
    />
  )
}

function ChannelTable({ db, store }) {
  const { customChannels, overrides } = store.settings
  const hiddenCount = Object.values(overrides).filter(o => o.hidden).length

  const data = useMemo(
    () =>
      [
        ...customChannels.map(ch => ({ ...ch, custom: true })),
        ...curatedChannels(db, overrides).filter(ch => !ch.hidden),
      ].sort((a, b) => b.min_age - a.min_age || b.max_age - a.max_age),
    [db, customChannels, overrides],
  )

  const { ageRange } = store.settings
  const inRange = data.filter(ch => overlaps(ageRange, ch.min_age, ch.max_age)).length

  const columns = useMemo(
    () => [
      {
        header: `Channel (${inRange}/${data.length})`,
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
      {
        header: 'Ages',
        id: 'ages',
        cell: ({ row }) => <ChannelAgeSlider ch={row.original} store={store} />,
      },
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
    [store, data, inRange],
  )

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <>
      {/* the ages column reserves real width so the 1-15 dual slider stays as
          readable as the global one up top; narrow screens scroll horizontally
          via table-responsive instead of crushing the track */}
      <div className="table-responsive">
        <table className="table table-dark align-middle">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    className="text-secondary fw-normal"
                    style={h.column.id === 'ages' ? { width: '55%', minWidth: 420 } : undefined}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={
                  overlaps(store.settings.ageRange, row.original.min_age, row.original.max_age)
                    ? undefined
                    : 'out-of-range' // hidden from the kid by the current age filter
                }
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
