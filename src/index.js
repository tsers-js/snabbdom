import dom from "./dom"
import {isVNode, VNode} from "./vnode"
import {zipObj, isPlainObj, isStr, isArray, isPrimitive, keys} from "./util"
import {EventListener, EventSource} from "./events"

const htmlAttrs =
  "accept accept-charset accesskey action align alt async autocomplete autofocus " +
  "autoplay autosave bgcolor buffered challenge charset checked cite code " +
  "codebase color cols colspan content contenteditable contextmenu controls coords " +
  "data datetime default defer dir dirname disabled download draggable dropzone " +
  "enctype for form formaction headers height hidden high href hreflang http-equiv " +
  "icon id ismap itemprop keytype kind label lang language list loop low manifest " +
  "max maxlength media method min multiple muted name novalidate open optimum pattern " +
  "ping placeholder poster preload radiogroup readonly rel required reversed rows " +
  "rowspan sandbox scope scoped seamless selected shape size sizes span spellcheck " +
  "src srcdoc srclang srcset start step summary tabindex target title type " +
  "usemap width wrap"

const boolAttrs =
  "allowfullscreen async autofocus autoplay checked compact controls declare default " +
  "defaultchecked defaultmuted defaultselected defer disabled draggable enabled " +
  "formnovalidate hidden indeterminate inert ismap itemscope loop multiple muted " +
  "nohref noresize noshade novalidate nowrap open pauseonexit readonly required reversed " +
  "scoped seamless selected sortable spellcheck translate truespeed typemustmatch visible"

const noBubbleEvents =
  "load unload scroll focus blur DOMNodeRemovedFromDocument DOMNodeInsertedIntoDocument " +
  "loadstart progress error abort load loadend"

const htmlProps =
  "value"

const attrByName =
  zipObj(htmlAttrs.split(" ").map(a => [a.trim(), true]))

const boolAttrByName =
  zipObj(boolAttrs.split(" ").map(a => [a.trim(), true]))

const propsByName =
  zipObj(htmlProps.split(" ").map(a => [a.trim(), true]))

const noBubblesByName =
  zipObj(noBubbleEvents.split(" ").map(a => [a.trim(), true]))

const isHtmlProp = key => propsByName[key]

const isAttr = attr => {
  return attrByName[attr] || (attr.indexOf("data-") === 0 && attr.length > 5)
}

const bubbles = event => {
  return !noBubblesByName[event]
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
    if (child === undefined || child === null || child === false) continue
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
  const attrs = {}, htmlProps = {}
  const style = props.style || {}
  const klass = toClassObj(props.class || props.className)
  keys(props).forEach(k => {
    isAttr(k) && (attrs[k] = props[k])
    isHtmlProp(k) && (htmlProps[k] = props[k])
  })

  const data = {
    key, attrs, style, klass, props: htmlProps
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

const updateProps = (old, cur) => {
  const {elm} = cur
  let key, oldProps = old.data.props || {}, props = cur.data.props || {}
  for (key in props) {
    var c = props[key], o = oldProps[key]
    o !== c && (elm[key] = c)
  }
  for (key in oldProps) {
    if (!(key in props)) delete elm[key]
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
  return function snabbdom({O}) {
    const patch = dom.init([
      {
        create(old, cur) {
          updateAttrs(old, cur)
          updateProps(old, cur)
          updateKlass(old, cur)
          updateStyle(old, cur)
          attachEvents(cur)
        },
        update(old, cur) {
          updateAttrs(old, cur)
          updateProps(old, cur)
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
      return {
        sel: vnode.sel,
        data: vnode.data,
        children: vnode.children && vnode.children.map(cloneTree),
        text: vnode.text,
        key: vnode.key,
        ID: vnode.ID,
        _id: vnode._id
      }
    }

    function using(df, f) {
      return O.create(o => {
        const d = df()
        o.next(f(d))
        return () => d.dispose()
      }).flatMapLatest(x => x)
    }

    function prepare(vdom$) {
      const newSource = () => new EventSource()
      const withSource = src =>
        O.merge([new O(vdom$), O.never()])
          .map(vnode => (vnode.data.eventSource = vnode.data.eventSource || src) && vnode)
      return using(newSource, withSource).toProperty().get()
    }

    function events(vdom$, selector, eventName, useCapture) {
      useCapture = useCapture === undefined ? !bubbles(eventName) : !!useCapture
      const newListener = () => new EventListener(O, selector, eventName, useCapture)
      const listen = listener => new O(vdom$)
        .skipDuplicates((a, b) => a.data.eventSource === b.data.eventSource)
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
      return using(newListener, listen).flatMapLatest(x => x).get()
    }

    const Transforms = {
      h,
      events,
      prepare
    }
    // for convenience
    Transforms.DOM = Transforms

    function executor(vdom$) {
      const elm = isStr(rootElem) ? document.querySelector(rootElem) : rootElem
      let prev = elm
      const dispose = new O(vdom$).subscribe({
        next: vnode => {
          vnode = cloneTree(vnode)
          patch(prev, vnode)
          prev = vnode
        }
      })
      return O.disposeToSubscription(() => {
        dispose()
        prev = null
      })
    }

    return [Transforms, executor]
  }
}
