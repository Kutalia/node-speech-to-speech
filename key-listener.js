import { GlobalKeyboardListener } from "node-global-key-listener"

const v = new GlobalKeyboardListener()

export const addHotkeyDownListener = (hotkey, callback) => v.addListener((e) => {
  if (
    e.state == 'DOWN' &&
    e.name === hotkey.toUpperCase()
  ) {
    callback()
  }
})

export const addHotkeyUpListener = (hotkey, callback) => v.addListener((e) => {
  if (
    e.state == 'UP' &&
    e.name === hotkey.toUpperCase()
  ) {
    callback()
  }
})
