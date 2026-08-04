import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App.jsx'
import { verify } from './lib/webauthn.js'

vi.mock('./lib/webauthn.js', () => ({
  verify: vi.fn(async () => true),
  isBiometricAvailable: vi.fn(async () => false),
  enroll: vi.fn(async () => 'fresh-credential'),
}))
import { isBiometricAvailable } from './lib/webauthn.js'

const db = {
  schema_version: 2,
  generated_at: 'x',
  channels: [
    {
      channel_id: 'UCa',
      channel_title: 'Chan',
      min_age: 1,
      max_age: 15,
      videos: [{ id: 'v1', title: 'Vid', duration: 10, thumbnail: 't.jpg' }],
    },
  ],
}

// Node 22+'s broken experimental localStorage shadows jsdom's — use a real fake
function fakeStorage() {
  let store = {}
  return {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: k => { delete store[k] },
    clear: () => { store = {} },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => db })))
  verify.mockClear()
})

describe('first-run enrollment', () => {
  it('blocks everything with the enroll screen on a biometric device until enrolled', async () => {
    isBiometricAvailable.mockResolvedValueOnce(true)
    render(<App />)
    expect(await screen.findByText(/Grown-up setup/)).toBeTruthy()
    expect(screen.queryByLabelText('Parents')).toBeNull() // no gallery behind it
    fireEvent.click(screen.getByText('Enable'))
    expect(await screen.findByLabelText('Parents')).toBeTruthy() // gallery after enrolling
    expect(JSON.parse(localStorage.getItem('tinytube:settings:v1')).passkeyId).toBe('fresh-credential')
  })

  it('skips the enroll screen when already enrolled', async () => {
    isBiometricAvailable.mockResolvedValueOnce(true)
    localStorage.setItem('tinytube:settings:v1', JSON.stringify({ passkeyId: 'abc' }))
    render(<App />)
    expect(await screen.findByLabelText('Parents')).toBeTruthy()
    expect(screen.queryByText(/Grown-up setup/)).toBeNull()
  })
})

describe('parent gate', () => {
  it('opens the math gate when no passkey is enrolled', async () => {
    render(<App />)
    fireEvent.click(await screen.findByLabelText('Parents'))
    expect(await screen.findByText(/Grown-ups only/)).toBeTruthy()
    expect(verify).not.toHaveBeenCalled()
  })

  it('goes straight to the biometric and into settings when enrolled', async () => {
    localStorage.setItem('tinytube:settings:v1', JSON.stringify({ passkeyId: 'abc' }))
    render(<App />)
    fireEvent.click(await screen.findByLabelText('Parents'))
    expect(await screen.findByText(/Settings/)).toBeTruthy()
    expect(verify).toHaveBeenCalledWith('abc')
    expect(screen.queryByText(/Grown-ups only/)).toBeNull()
  })

  it('stays on the gallery when the biometric is cancelled', async () => {
    localStorage.setItem('tinytube:settings:v1', JSON.stringify({ passkeyId: 'abc' }))
    verify.mockResolvedValueOnce(false)
    render(<App />)
    fireEvent.click(await screen.findByLabelText('Parents'))
    expect(verify).toHaveBeenCalled()
    expect(screen.queryByText(/Settings/)).toBeNull()
    expect(screen.queryByText(/Grown-ups only/)).toBeNull()
  })
})
