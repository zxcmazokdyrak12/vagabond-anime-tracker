import { useEffect, useState } from 'react'
import { errorStatus, testPush } from '../api'
import { currentSubscription, disablePush, enablePush, needsHomeScreen, pushSupported } from '../lib/push'

type State = 'checking' | 'off' | 'on' | 'busy' | 'denied' | 'unsupported' | 'homescreen' | 'unavailable'

/** «Сообщать о новых сериях» — пуш, когда выходит серия того, что ты смотришь */
export default function NotifyToggle() {
  const [state, setState] = useState<State>(() =>
    !pushSupported() ? (needsHomeScreen() ? 'homescreen' : 'unsupported') : 'checking'
  )
  const [note, setNote] = useState('')

  useEffect(() => {
    if (state !== 'checking') return
    if (Notification.permission === 'denied') {
      setTimeout(() => setState('denied'))
      return
    }
    currentSubscription()
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'))
  }, [state])

  const turnOn = async () => {
    setState('busy')
    setNote('')
    try {
      const result = await enablePush()
      setState(result === 'granted' ? 'on' : result === 'denied' ? 'denied' : 'off')
    } catch (err) {
      console.error('Push subscribe failed:', err)
      setState(errorStatus(err) === 404 ? 'unavailable' : 'off')
      if (errorStatus(err) !== 404) setNote('Could not turn notifications on. Try again.')
    }
  }

  const turnOff = async () => {
    setState('busy')
    await disablePush()
    setState('off')
  }

  const sendTest = async () => {
    try {
      const { data } = await testPush()
      setNote(data.delivered ? 'Test sent. It should appear in a few seconds.' : 'No device received it. Turn notifications off and on.')
    } catch {
      setNote('The test could not be sent.')
    }
  }

  const text: Record<State, string> = {
    checking: '',
    busy: '',
    off: 'Get a notification when a new episode of something you’re watching comes out, even with the tracker closed.',
    on: 'You’ll get a notification when a new episode of something you’re watching comes out.',
    denied: 'Notifications are blocked for this site. Allow them in your browser’s site settings, then come back.',
    unsupported: 'This browser can’t show notifications from websites.',
    homescreen: 'On iPhone and iPad, add the tracker to your Home Screen first (Share, then Add to Home Screen), open it from there and turn notifications on.',
    unavailable: 'Notifications aren’t set up on the server yet.',
  }

  return (
    <div className="notify" role="group" aria-label="Episode notifications">
      <span className="brush notify__glyph" aria-hidden="true">報</span>
      <div className="notify__body">
        <p className="notify__title">{state === 'on' ? 'Episode notifications are on' : 'New episode notifications'}</p>
        <p className="notify__text">{text[state]}</p>
        {note && (
          <p className="notify__text" role="status">
            {note}
          </p>
        )}
      </div>
      <div className="notify__actions">
        {(state === 'off' || (state === 'busy' && !note)) && (
          <button type="button" className="btn btn--small" onClick={turnOn} disabled={state === 'busy'}>
            {state === 'busy' ? 'Turning on…' : 'Turn on'}
          </button>
        )}
        {state === 'on' && (
          <>
            <button type="button" className="text-btn" onClick={sendTest}>
              Send a test
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={turnOff}>
              Turn off
            </button>
          </>
        )}
      </div>
    </div>
  )
}
