import { useEffect, useState } from 'react'
import { makeChallenge } from '../lib/mathGate.js'

const SECONDS = 5

/** Parent gate: one 2-digit addition, 4 choices, 5-second countdown. */
export default function MathGate({ onPass, onFail }) {
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
