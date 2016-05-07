import selmatch from "matches-selector"
import {extend} from "./util"


const matches = (ev, sel) => {
  return !sel || (ev.target && selmatch(ev.target, sel))
}

export const boundaryMakerProp = "_tsersComponentRoot"

const isScopeBoundary = (el) => el.hasOwnProperty(boundaryMakerProp)

const belongsToScope = (ev) => {
  const scopeRoot = ev.currentTarget
  let currentEl = ev.target
  while(currentEl) {
    if (currentEl === scopeRoot) {
      return true
    } else if (isScopeBoundary(currentEl)) {
      return false
    }
    currentEl = currentEl.parentNode
  }

  return false
}


export function EventListener(O, selector, type, useCapture) {
  this.b = O.bus()
  this.sel = selector
  this.type = type
  this.useCapture = useCapture || false
}
extend(EventListener.prototype, {
  fn() {
    return this.b ? (event => {
      if (this.b && matches(event, this.sel) &&
        belongsToScope(event)) {
        this.b.next(event)
      }
    }) : (() => undefined)
  },
  obs() {
    return this.b.obs()
  },
  dispose() {
    this.b && this.b.completed()
    this.b = void 0
  }
})


export function EventSource() {
  this.listeners = []
  this.pending = []
  this.elm = void 0
}

extend(EventSource.prototype, {
  _listen({type, fn, useCapture}) {
    this.elm.addEventListener(type, fn, useCapture)
    this.listeners.push({type, fn, useCapture})
  },
  listen(listener) {
    const fn = listener.fn(), type = listener.type, useCapture = listener.useCapture
    this.elm ? this._listen({type, fn, useCapture}) : this.pending.push({type, fn, useCapture})
    return listener.obs()
  },
  attach(elm) {
    this.elm = elm
    this.pending.forEach(l => this._listen(l))
    this.pending = []
  },
  reattach(elm) {
    this.detach(this.elm)
    this.attach(elm)
  },
  detach(elm) {
    const ll = this.listeners
    if (elm && elm === this.elm) {
      ll.forEach(({type, fn, useCapture}) => {
        this.elm.removeEventListener(type, fn, useCapture)
      })
      this.elm = void 0
      this.listeners.forEach(l => this.pending.push(l))
      this.listeners = []
    }
  },
  dispose() {
    this.detach(this.elm)
    this.pending = []
    this.listeners = []
    this.elm = void 0
  }
})
