import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import App from '../src/main.jsx'
import { verify } from '../src/lib.js'

// partial mock: webauthn now lives in lib.js next to the hooks, which must stay real
vi.mock('../src/lib.js', async importOriginal => ({
  ...(await importOriginal()),
  verify: vi.fn(async () => true),
  isBiometricAvailable: vi.fn(async () => false),
  enroll: vi.fn(async () => 'fresh-credential'),
}))
import { isBiometricAvailable } from '../src/lib.js'

// Stub the player iframe for app-level routing tests.
vi.mock('react-youtube', () => ({ default: () => <div data-testid="yt-stub" /> }))

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

function mockFullscreen({ reject = false } = {}) {
  let element = null
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true })
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element })

  const request = vi.fn(() => {
    if (reject) return Promise.reject(new Error('denied'))
    element = document.documentElement
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  })
  const exit = vi.fn(() => {
    element = null
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  })
  Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: request })
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit })
  return { request, exit }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => db })))
  verify.mockClear()
})

afterEach(() => {
  delete document.fullscreenEnabled
  delete document.fullscreenElement
  delete document.exitFullscreen
  delete document.documentElement.requestFullscreen
})

describe('first-run enrollment', () => {
  it('blocks everything with the enroll screen on a biometric device until enrolled', async () => {
    isBiometricAvailable.mockResolvedValueOnce(true)
    render(<App />)
    expect(await screen.findByText('Enter')).toBeTruthy()
    expect(screen.queryByLabelText('Parents')).toBeNull() // no gallery behind it
    fireEvent.click(screen.getByText('Enter'))
    expect(await screen.findByLabelText('Parents')).toBeTruthy() // gallery after enrolling
    expect(JSON.parse(localStorage.getItem('tinytube:settings:v1')).passkeyId).toBe('fresh-credential')
  })

  it('skips the enroll screen when already enrolled', async () => {
    isBiometricAvailable.mockResolvedValueOnce(true)
    localStorage.setItem('tinytube:settings:v1', JSON.stringify({ passkeyId: 'abc' }))
    render(<App />)
    expect(await screen.findByLabelText('Parents')).toBeTruthy()
    expect(screen.queryByText('Enter')).toBeNull()
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

describe('player routing', () => {
  it('opens a tapped video', async () => {
    render(<App />)
    fireEvent.click(await screen.findByText('Vid'))
    expect(await screen.findByTestId('yt-stub')).toBeTruthy()
  })

  it('enters fullscreen for a video and exits it when the player closes', async () => {
    const fullscreen = mockFullscreen()
    render(<App />)
    fireEvent.click(await screen.findByText('Vid'))
    expect(fullscreen.request).toHaveBeenCalledTimes(1)
    fireEvent.click(await screen.findByLabelText('Back'))
    await waitFor(() => expect(fullscreen.exit).toHaveBeenCalledTimes(1))
  })

  it('exits video-owned fullscreen on browser Back or an iOS edge-swipe', async () => {
    const fullscreen = mockFullscreen()
    render(<App />)
    fireEvent.click(await screen.findByText('Vid'))
    fireEvent(window, new PopStateEvent('popstate'))
    await waitFor(() => expect(fullscreen.exit).toHaveBeenCalledTimes(1))
    expect(await screen.findByLabelText('Parents')).toBeTruthy()
  })

  it('preserves fullscreen that was entered manually before a video', async () => {
    const fullscreen = mockFullscreen()
    render(<App />)
    fireEvent.click(await screen.findByLabelText('Enter fullscreen'))
    expect(await screen.findByLabelText('Exit fullscreen')).toBeTruthy()
    fireEvent.click(screen.getByText('Vid'))
    fireEvent.click(await screen.findByLabelText('Back'))
    expect(fullscreen.request).toHaveBeenCalledTimes(1)
    expect(fullscreen.exit).not.toHaveBeenCalled()
  })

  it('keeps playing if a fullscreen request is rejected', async () => {
    const fullscreen = mockFullscreen({ reject: true })
    render(<App />)
    fireEvent.click(await screen.findByText('Vid'))
    expect(fullscreen.request).toHaveBeenCalledTimes(1)
    expect(await screen.findByTestId('yt-stub')).toBeTruthy()
  })
})

describe('fullscreen toolbar', () => {
  it('toggles fullscreen and follows browser-driven state changes', async () => {
    const fullscreen = mockFullscreen()
    render(<App />)
    fireEvent.click(await screen.findByLabelText('Enter fullscreen'))
    expect(fullscreen.request).toHaveBeenCalledTimes(1)
    fireEvent.click(await screen.findByLabelText('Exit fullscreen'))
    expect(fullscreen.exit).toHaveBeenCalledTimes(1)
    expect(await screen.findByLabelText('Enter fullscreen')).toBeTruthy()
  })

  it('hides the control when the API is unavailable', async () => {
    render(<App />)
    await screen.findByLabelText('Parents')
    expect(screen.queryByLabelText('Enter fullscreen')).toBeNull()
  })
})
