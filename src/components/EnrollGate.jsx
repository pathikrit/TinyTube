import { useState } from 'react'
import { enroll } from '../lib/webauthn.js'

/**
 * First-run blocking screen on biometric-capable devices: nothing (not even
 * the gallery) shows until a grown-up enrolls the device biometric that will
 * guard parent mode. Browsers require a user gesture for WebAuthn, hence the
 * single big button rather than auto-firing on load.
 */
export default function EnrollGate({ onEnrolled }) {
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
