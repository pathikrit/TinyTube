import { useState } from 'react'
import { curatedChannels } from '../lib/channels.js'
import { searchChannels, resolveChannel, evictChannelCache } from '../lib/youtubeApi.js'

const API_CONSOLE_URL = 'https://console.cloud.google.com/apis/library/youtube.googleapis.com'
const looksLikeLink = s => /^@|^UC[0-9A-Za-z_-]{22}$|youtube\.com/.test(s.trim())

export default function ParentMode({ db, store, onDone }) {
  const { settings } = store
  const curated = curatedChannels(db)

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

      <AgeRangeSection value={settings.ageRange} onChange={store.setAgeRange} />
      <ApiKeySection apiKey={settings.apiKey} onChange={store.setApiKey} />
      <AddChannelSection apiKey={settings.apiKey} store={store} />
      <ChannelListSection curated={curated} store={store} />
    </div>
  )
}

function AgeRangeSection({ value: [lo, hi], onChange }) {
  return (
    <section className="mb-4">
      <h2 className="fs-5 text-secondary">
        <i className="fa-sharp-duotone fa-regular fa-children me-2" />
        Ages {lo}–{hi}
        {lo === 1 && hi === 15 && ' (everything)'}
      </h2>
      <div className="dual-slider">
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
      </div>
      <div className="form-text">Only channels for this age range show up in the gallery.</div>
    </section>
  )
}

function ApiKeySection({ apiKey, onChange }) {
  return (
    <section className="mb-4">
      <h2 className="fs-5 text-secondary">
        <i className="fa-sharp-duotone fa-regular fa-key me-2" />
        YouTube API key
      </h2>
      <input
        type="password"
        className="form-control form-control-lg"
        placeholder="AIza…"
        defaultValue={apiKey}
        onBlur={e => onChange(e.target.value)}
        autoComplete="off"
      />
      <div className="form-text">
        Needed only to search for and add your own channels — the built-in ones work without it.{' '}
        <a href={API_CONSOLE_URL} target="_blank" rel="noreferrer">
          Get a free key
        </a>{' '}
        (enable "YouTube Data API v3", then Credentials → Create API key; restrict it to this site's
        address). The key stays on this device.
      </div>
    </section>
  )
}

function AddChannelSection({ apiKey, store }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const search = async e => {
    e.preventDefault()
    if (!query.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      setResults(
        looksLikeLink(query) ? [await resolveChannel(apiKey, query)] : await searchChannels(apiKey, query),
      )
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-4">
      <h2 className="fs-5 text-secondary">
        <i className="fa-sharp-duotone fa-regular fa-magnifying-glass me-2" />
        Add a channel
      </h2>
      {apiKey ? (
        <form className="d-flex gap-2" onSubmit={search}>
          <input
            type="text"
            className="form-control form-control-lg"
            placeholder="Channel name, @handle, or URL"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-outline-light btn-lg" disabled={busy}>
            {busy ? (
              <span className="spinner-border spinner-border-sm" role="status" />
            ) : (
              <i className="fa-sharp-duotone fa-regular fa-magnifying-glass" />
            )}
          </button>
        </form>
      ) : (
        <div className="form-text">Add your API key above to search for channels.</div>
      )}
      {error && <div className="alert alert-warning mt-2 py-2">{error}</div>}
      {results.map(ch => (
        <SearchResult
          key={ch.channel_id}
          channel={ch}
          onAdd={added => {
            store.addCustomChannel(added)
            setResults(rs => rs.filter(r => r.channel_id !== added.channel_id))
          }}
        />
      ))}
    </section>
  )
}

function SearchResult({ channel, onAdd }) {
  const [minAge, setMinAge] = useState(1)
  const [maxAge, setMaxAge] = useState(15)
  return (
    <div className="d-flex align-items-center gap-3 bg-body-tertiary rounded p-2 mt-2">
      <img src={channel.thumbnail} alt="" width="48" height="48" className="rounded-circle" />
      <span className="me-auto fw-semibold text-truncate">{channel.channel_title}</span>
      <label className="text-secondary small">
        ages{' '}
        <input
          type="number"
          min="1"
          max="15"
          value={minAge}
          onChange={e => setMinAge(+e.target.value)}
          className="form-control d-inline-block age-input"
        />
        {' – '}
        <input
          type="number"
          min="1"
          max="15"
          value={maxAge}
          onChange={e => setMaxAge(+e.target.value)}
          className="form-control d-inline-block age-input"
        />
      </label>
      <button
        type="button"
        className="btn btn-danger"
        onClick={() =>
          onAdd({ ...channel, min_age: Math.min(minAge, maxAge), max_age: Math.max(minAge, maxAge) })
        }
      >
        <i className="fa-sharp-duotone fa-regular fa-plus me-1" />
        Add
      </button>
    </div>
  )
}

function ChannelListSection({ curated, store }) {
  const { settings } = store
  return (
    <section>
      <h2 className="fs-5 text-secondary">
        <i className="fa-sharp-duotone fa-regular fa-tv-retro me-2" />
        Channels
      </h2>
      {settings.customChannels.map(ch => (
        <ChannelRow key={ch.channel_id} channel={ch} thumbnail={ch.thumbnail} range={[ch.min_age, ch.max_age]}>
          <button
            type="button"
            className="btn btn-outline-danger"
            aria-label={`Remove ${ch.channel_title}`}
            onClick={() => {
              store.removeCustomChannel(ch.channel_id)
              evictChannelCache(ch.channel_id)
            }}
          >
            <i className="fa-sharp-duotone fa-regular fa-trash" />
          </button>
        </ChannelRow>
      ))}
      {curated.map(ch => {
        const hidden = settings.hiddenChannels.includes(ch.channel_id)
        return (
          <ChannelRow
            key={ch.channel_id}
            channel={ch}
            thumbnail={ch.videos[0]?.thumbnail}
            range={[ch.min_age, ch.max_age]}
            dimmed={hidden}
          >
            <button
              type="button"
              className={`btn ${hidden ? 'btn-outline-secondary' : 'btn-outline-light'}`}
              aria-label={`${hidden ? 'Show' : 'Hide'} ${ch.channel_title}`}
              onClick={() => store.toggleHidden(ch.channel_id)}
            >
              <i className={`fa-sharp-duotone fa-regular ${hidden ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
          </ChannelRow>
        )
      })}
    </section>
  )
}

function ChannelRow({ channel, thumbnail, range, dimmed = false, children }) {
  return (
    <div className={`d-flex align-items-center gap-3 rounded p-2 mt-2 bg-body-tertiary ${dimmed ? 'opacity-50' : ''}`}>
      {thumbnail ? (
        <img src={thumbnail} alt="" width="48" height="48" className="rounded object-fit-cover" />
      ) : (
        <i className="fa-sharp-duotone fa-regular fa-tv-retro fa-2x" style={{ width: 48 }} />
      )}
      <span className="me-auto fw-semibold text-truncate">{channel.channel_title}</span>
      <span className="badge text-bg-dark">ages {range[0]}–{range[1]}</span>
      {children}
    </div>
  )
}
