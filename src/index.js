import {Observable as O} from "rx"
import dom from "./dom"
import {isVNode, VNode} from "./vnode"
import {zipObj, isPlainObj, isStr, isArray, isPrimitive, keys, extend} from "./util"
import {EventListener, EventSource} from "./events"

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

const attrByName =
  zipObj(htmlAttrs.split(" ").map(a => [a.trim(), true]))

const boolAttrByName =
  zipObj(boolAttrs.split(" ").map(a => [a.trim(), true]))

const isAttr = attr => {
  return attrByName[attr] || (attr.indexOf("data-") === 0 && attr.length > 5)
}

const toClassObj = (klass) => {
  let i, list, c, res = {}
  for (i = 0, list = (klass || "").split(" "); i < list.length; i++) {
    if (c = list[i].trim()) res[c] = true   // eslint-disable-line
  }
  return res
}

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
  const key = props.key
  const attrs = {}
  const style = props.style || {}
  const klass = toClassObj(props.class || props.className)
  keys(props).forEach(k => isAttr(k) && (attrs[k] = props[k]))

  const data = {
    key, attrs, style, klass
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

const attachEvents = vnode => {
  if (vnode.data && vnode.data.eventSource) {
    vnode.data.eventSource.attach(vnode.elm)
  }
}

const reattachEvents = (old, cur) => {
  const curSrc = (cur.data || {}).eventSource
  const oldSrc = (old.data || {}).eventSource
  if (curSrc !== oldSrc) {
    oldSrc && oldSrc.detach(cur.elm)
    curSrc && curSrc.reattach(cur.elm)
  }
}
const detachEvents = vnode => {
  if (vnode.data && vnode.data.eventSource) {
    vnode.data.eventSource.detach(vnode.elm)
  }
}


export default function makeSnabbdom(rootElem) {
  return function snabbdom() {
    const patch = dom.init([
      {
        create(old, cur) {
          updateAttrs(old, cur)
          updateKlass(old, cur)
          updateStyle(old, cur)
          attachEvents(cur)
        },
        update(old, cur) {
          updateAttrs(old, cur)
          updateKlass(old, cur)
          updateStyle(old, cur)
        },
        postpatch(old, cur) {
          reattachEvents(old, cur)
        },
        destroy(vnode) {
          detachEvents(vnode)
        }
      }
    ])

    function cloneTree(vnode) {
      const cloned = extend({}, vnode)
      cloned.children = vnode.children && vnode.children.map(cloneTree)
      return cloned
    }

    function prepare(vdom$) {
      const newSource = () => new EventSource()
      const withSource = src => vdom$
        .merge(O.never())
        .map(vnode => (vnode.data.eventSource = vnode.data.eventSource || src) && vnode)
      return O.using(newSource, withSource).shareReplay(1)
    }

    function events(vdom$, selector, eventName) {
      const newListener = () => new EventListener(selector, eventName, false)
      const listen = listener => vdom$
        .distinctUntilChanged(vnode => vnode.data.eventSource)
        .map(vnode => {
          if (!vnode.data.eventSource) {
            console.warn(                                 // eslint-disable-line
              "DOM.events :: VDOM is not prepared for event listening.",
              "Perhaps you forgot to call DOM.prepare(vdom$)?"
            )
            return O.never()
          }
          return vnode.data.eventSource.listen(listener)
        })
      return O.using(newListener, listen).switch().share()
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
        vnode = cloneTree(vnode)
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
