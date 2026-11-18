import { keyToBytes } from './push'

describe('keyToBytes', () => {
  it('decodes base64url VAPID keys, padding included', () => {
    // «hi?» → aGk_ в base64url (с подчёркиванием вместо слэша)
    expect([...keyToBytes('aGk_')]).toEqual([104, 105, 63])
    expect([...keyToBytes('aGk')]).toEqual([104, 105])
  })
})
