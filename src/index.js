import {Observable as O} from "rx"
//import selmatch from "matches-selector"
import snabb from "snabbdom"


const zipObj = pairs => {
  const o = {}
  pairs.forEach(([k, v]) => o[k] = v)
  return o
}

const VNODE_ID = {}

function VNode(sel, data, children, text, elm) {
  const key = data === undefined ? undefined : data.key;
  return {
    sel: sel, data: data, children: children,
    text: text, elm: elm, key: key, ID: VNODE_ID
  }
}

const isArray = x => x && Array.isArray(x)
const isStr = x => x && typeof x === "string"
const isPlainObj = x => x && x.prototype && x.prototype.constructor === Object
const isPrimitive = x => typeof x === "string" || typeof x === "number"
const isVNode = x => x && x.ID === VNODE_ID

const keys = x => x ? Object.keys(x) : []

/*
const values = obj => keys(obj).map(k => obj[k])

const extend = Object.assign

const matches = (ev, sel) => !sel || (ev.target && selmatch(ev.target, sel))

const shallowEq = (a, b) => {
  const aKeys = keys(a), bKeys = keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i++) {
    if (a[aKeys[i]] !== b[aKeys[i]]) return false
  }
  return true
}

const rm = (arr, obj) => {
  const idx = arr.indexOf(obj)
  if (idx !== -1) arr.splice(idx, 1)
  return arr.length
}
*/

const toClassObj = (klass) => {
  let i, list, c, res = {}
  for (i = 0, list = (klass || "").split(" "); i < list.length; i++) {
    if (c = list[i].trim()) res[c] = true   // eslint-disable-line
  }
  return res
}

const htmlAttrs =
  "accept accept-charset accesskey action align alt async autocomplete autofocus " +
  "autoplay autosave bgcolor buffered challenge charset checked cite code " +
  "codebase color cols colspan content contenteditable contextmenu controls coords " +
  "data data- datetime default defer dir dirname disabled download draggable dropzone " +
  "enctype for form formaction headers height hidden high href hreflang http-equiv " +
  "icon id ismap itemprop keytype kind label lang language list loop low manifest " +
  "max maxlength media method min multiple muted name novalidate open optimum pattern " +
  "ping placeholder poster preload radiogroup readonly rel required reversed rows " +
  "rowspan sandbox scope scoped seamless selected shape size sizes span spellcheck " +
  "src srcdoc srclang srcset start step summary tabindex target title type " +
  "usemap value width wrap"

const boolAttrs =
  "allowfullscreen async autofocus autoplay checked compact controls declare default " +
  "defaultchecked defaultmuted defaultselected defer disabled draggable enabled " +
  "formnovalidate hidden indeterminate inert ismap itemscope loop multiple muted " +
  "nohref noresize noshade novalidate nowrap open pauseonexit readonly required reversed " +
  "scoped seamless selected sortable spellcheck translate truespeed typemustmatch visible"

const attrByName = zipObj(htmlAttrs.split(" ").map(a => [a.trim(), true]))
const boolAttrByName = zipObj(boolAttrs.split(" ").map(a => [a.trim(), true]))

const isAttr = attr =>
attrByName[attr] || (attr.indexOf("data-") && attr.length > 5)

function h(tag, props, children) {
  if (arguments.length === 1) {
    props = {}
    children = []
  } else if (arguments.length === 2) {
    if (isPlainObj(props)) {
      children = []
    } else {
      children = props
      props = {}
    }
  }

  if (!isStr(tag)) {
    throw new Error("Tag selector must be a string")
  }

  // parse children
  if (!isArray(children)) {
    children = [children]
  }
  let temp = []
  for (var i = 0; i < children.length; i++) {
    const child = children[i]
    if (isVNode(child)) {
      temp.push(child)
    } else if (isPrimitive(child)) {
      temp.push(VNode(undefined, undefined, undefined, `${child}`))
    } else {
      throw new Error(`Invalid virtual node: ${child}`)
    }
  }
  children = temp

  // parse props
  const attrs = {}
  const style = props.style || {}
  const klass = toClassObj(props.class || props.className)
  keys(props).forEach(k => isAttr(k) && (attrs[k] = props[k]))

  const data = {
    attrs, style, klass
  }

  return VNode(tag, data, children)
}

const updateAttrs = (old, cur) => {
  const {elm} = cur
  let key, oldAttrs = old.data.attrs || {}, attrs = cur.data.attrs || {}
  for (key in attrs) {
    var c = attrs[key], o = oldAttrs[key]
    if (o !== c) {
      !c && boolAttrByName[key] ? elm.removeAttribute(key) : elm.setAttribute(key, c)
    }
  }
  for (key in oldAttrs) {
    if (!(key in attrs)) elm.removeAttribute(key)
  }
}
const updateKlass = (old, cur) => {
  const {elm} = cur
  let kl, oldKlass = old.data.klass || {}, klass = cur.data.klass || {}
  for (kl in oldKlass) {
    if (!(kl in klass)) elm.classList.remove(kl)
  }
  for (kl in klass) {
    if (!(kl in oldKlass)) elm.classList.add(kl)
  }
}
const updateStyle = (old, cur) => {
  const {elm} = cur
  let s, oldStyle = old.data.style || {}, style = cur.data.style || {}
  for (s in style) {
    var c = style[s], o = style[s]
    if (c !== o) elm.style[s] = c
  }
  for (s in oldStyle) {
    if (!(s in style)) elm.style[s] = ""
  }
}

export default function makeSnabbdom(rootElem) {
  return function snabbdom() {
    const patch = snabb.init([
      {
        create(old, cur) {
          updateAttrs(old, cur)
          updateKlass(old, cur)
          updateStyle(old, cur)
        },
        update(old, cur) {
          updateAttrs(old, cur)
          updateKlass(old, cur)
          updateStyle(old, cur)
        },
        destroy() {

        }
      }
    ])

    function prepare(vdom$) {
      return vdom$
    }

    function events(/*vdom$, selector, eventName*/) {
      return O.never()
    }

    const Transforms = {
      h,
      events,
      prepare
    }

    function executor(vdom$) {
      const elm = isStr(rootElem) ? document.querySelector(rootElem) : rootElem
      let prev = elm
      const dispose = vdom$.subscribe(vnode => {
        patch(prev, vnode)
        prev = vnode
      })
      return {
        dispose: () => {
          dispose();
          prev = null
        }
      }
    }

    return [Transforms, executor]
  }
}
