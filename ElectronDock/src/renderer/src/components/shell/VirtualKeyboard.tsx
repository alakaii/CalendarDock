import { useState, useEffect, useRef, useCallback } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'

// Input types that should NOT trigger the keyboard
const SKIP_TYPES = new Set(['hidden', 'range', 'color', 'checkbox', 'radio', 'file', 'submit', 'button', 'reset'])

/** Force a value into a React-controlled input or textarea without losing React state sync. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
    : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  proto?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export default function VirtualKeyboard() {
  const [visible,    setVisible]    = useState(false)
  const [layoutName, setLayoutName] = useState<'default' | 'shift'>('default')
  const keyboardRef = useRef<any>(null)
  const activeElRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const handleFocusIn = useCallback((e: FocusEvent) => {
    const el = e.target as HTMLElement
    if (el instanceof HTMLInputElement) {
      if (SKIP_TYPES.has(el.type)) return
    } else if (!(el instanceof HTMLTextAreaElement)) {
      return
    }
    activeElRef.current = el as HTMLInputElement | HTMLTextAreaElement
    keyboardRef.current?.setInput(el.value)
    setVisible(true)
  }, [])

  const handleFocusOut = useCallback((e: FocusEvent) => {
    const next = e.relatedTarget as HTMLElement | null
    // If focus is moving to another typeable field, let focusin handle it
    if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) return
    setVisible(false)
    activeElRef.current = null
  }, [])

  useEffect(() => {
    document.addEventListener('focusin',  handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('focusin',  handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [handleFocusIn, handleFocusOut])

  const handleChange = (input: string) => {
    const el = activeElRef.current
    if (el) setNativeValue(el, input)
  }

  const handleKeyPress = (button: string) => {
    if (button === '{shift}' || button === '{lock}') {
      setLayoutName((p) => p === 'default' ? 'shift' : 'default')
      return
    }
    if (button === '{enter}') {
      const el = activeElRef.current
      if (el) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
        el.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', bubbles: true }))
      }
    }
    // Single-shift: revert to default after typing one character
    if (layoutName === 'shift' && button.length === 1) {
      setLayoutName('default')
    }
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-1/4 right-1/4 vkb-root"
      style={{ zIndex: 9999 }}
      // Prevent the keyboard from stealing focus / blurring the active input
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
    >
      <Keyboard
        keyboardRef={(r) => (keyboardRef.current = r)}
        layoutName={layoutName}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        layout={{
          default: [
            '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
            '{tab} q w e r t y u i o p [ ] \\',
            '{lock} a s d f g h j k l ; \' {enter}',
            '{shift} z x c v b n m , . / {shift}',
            '{space}'
          ],
          shift: [
            '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
            '{tab} Q W E R T Y U I O P { } |',
            '{lock} A S D F G H J K L : " {enter}',
            '{shift} Z X C V B N M < > ? {shift}',
            '{space}'
          ]
        }}
        display={{
          '{bksp}':  '⌫',
          '{enter}': '↵',
          '{shift}': '⇧',
          '{lock}':  '⇪',
          '{tab}':   '⇥',
          '{space}': ' ',
        }}
        theme="hg-theme-default vkb-theme"
      />
    </div>
  )
}
