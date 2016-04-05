
// for identity checks
const VNODEID = {}

export const isVNode = x => x && x.ID === VNODEID

export function VNode(sel, data, children, text, elm) {
  const key = data === undefined ? undefined : data.key
  // this instance id is needed so that vdom diffing works even if
  // streams provide cached vdom nodes (which must be cloned because
  // the diffing operation is mutable...)
  const instId = {}
  return {
    sel, data, children, text, elm, key, ID: VNODEID, _id: instId
  }
}
