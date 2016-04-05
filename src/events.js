import {Subject} from "rx"
import selmatch from "matches-selector"
import {extend} from "./util"


const matches = (ev, sel) => {
  return !sel || (ev.target && selmatch(ev.target, sel))
}


export function EventListener(selector, type, useCapture) {
  this.s = new Subject()
  this.sel = selector
  this.type = type
  this.useCapture = useCapture || false
}
extend(EventListener.prototype, {
  fn() {
    return this.s ? (event => this.s && matches(event, this.sel) && this.s.onNext(event)) : (() => undefined)
  },
  obs() {
    return this.s.asObservable()
  },
  dispose() {
    this.s && this.s.dispose()
    this.s = void 0
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
