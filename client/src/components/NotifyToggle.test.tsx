import { render, screen } from '@testing-library/react'
import NotifyToggle from './NotifyToggle'

describe('NotifyToggle', () => {
  it('explains when the browser cannot do push', () => {
    // В jsdom нет PushManager — как в браузерах без поддержки пушей
    render(<NotifyToggle />)
    expect(screen.getByText(/can’t show notifications from websites/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn on' })).not.toBeInTheDocument()
  })

  it('tells iPhone users to add the tracker to the Home Screen first', () => {
    const ua = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    render(<NotifyToggle />)
    expect(screen.getByText(/add the tracker to your Home Screen first/)).toBeInTheDocument()
    ua.mockRestore()
  })
})
