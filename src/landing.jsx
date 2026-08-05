/** Onboarding + parent gates: biometric enrollment on first run, and the
 * math-gate fallback for devices without a platform authenticator. */

import { useEffect, useState } from 'react'
import { enroll, makeChallenge } from './lib.js'

/**
 * First-run blocking screen on biometric-capable devices: nothing (not even
 * the gallery) shows until a grown-up enrolls the device biometric that will
 * guard parent mode. Browsers require a user gesture for WebAuthn, hence the
 * single big button rather than auto-firing on load.
 */
export function EnrollGate({ onEnrolled }) {
  const [error, setError] = useState(null)

  const start = async () => {
    setError(null)
    try {
      onEnrolled(await enroll())
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="math-gate enroll-gate d-flex flex-column align-items-center justify-content-center gap-4 p-4 text-center">
      <span className="fs-3 fw-bold">
        <i className="fa-duotone fa-regular fa-tv-retro me-2 text-danger" />
        TinyTube
      </span>
      <button type="button" className="btn btn-danger btn-lg px-5 py-3 fs-4" onClick={start}>
        <i className="fa-sharp-duotone fa-regular fa-fingerprint me-2" />
        Enter
      </button>
      {error && <div className="alert alert-warning py-2">{error} — try again</div>}
    </div>
  )
}

const SECONDS = 5

/** Parent gate: one 2-digit addition, 4 choices, 5-second countdown. */
export function MathGate({ onPass, onFail }) {
  const [challenge] = useState(() => makeChallenge())
  const [left, setLeft] = useState(SECONDS)

  useEffect(() => {
    const interval = setInterval(() => setLeft(s => s - 1), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (left <= 0) onFail()
  }, [left, onFail])

  return (
    <div className="math-gate d-flex flex-column align-items-center justify-content-center gap-4 p-4">
      <div className="fs-5 text-secondary">
        <i className="fa-sharp-duotone fa-regular fa-family me-2" />
        Grown-ups only
      </div>
      <div className="display-4 fw-bold">
        {challenge.a} + {challenge.b} = ?
      </div>
      <div className="progress w-50" style={{ height: 8 }}>
        <div
          className="progress-bar bg-danger"
          style={{ width: `${(Math.max(left, 0) / SECONDS) * 100}%`, transition: 'width 1s linear' }}
        />
      </div>
      <div className="row g-3 w-100" style={{ maxWidth: 420 }}>
        {challenge.choices.map(choice => (
          <div key={choice} className="col-6">
            <button
              type="button"
              className="btn btn-outline-light btn-lg w-100 py-3 fs-3"
              onClick={() => (choice === challenge.answer ? onPass() : onFail())}
            >
              {choice}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
