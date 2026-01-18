import {DomUtil} from '../util/dom_util'
import {KeyboardManager} from '../util/keyboard_manager'
import {Util} from '../util/util'
import {SubmenuItemInfo, WndEvent, Z_MENU_SUBITEM} from './types'
import {Wnd} from './wnd'

export type ResizeOption = {
  minWidth?: number;
  minHeight?: number;
  cornerOnly?: boolean;
}

export class WndUtil {
  public static getOffsetRect(
    parent: HTMLElement, target: HTMLElement,
  ): {left: number; top: number; right: number; bottom: number} {
    const prect = parent.getBoundingClientRect()
    const trect = target.getBoundingClientRect()
    return {
      left: trect.left - prect.left,
      top: trect.top - prect.top,
      right: trect.right - prect.left,
      bottom: trect.bottom - prect.top,
    }
  }

  public static createHorizontalSplitter(
    parent: HTMLElement, upperHeight: number,
  ): [HTMLElement, HTMLElement] {
    const upper = document.createElement('div')
    upper.className = 'upper'
    DomUtil.setStyles(upper, {
      position: 'absolute',
      overflow: 'hidden',
      left: 0,
      top: 0,
      right: 0,
      height: `${upperHeight}px`,
    })

    const lower = document.createElement('div')
    lower.className = 'lower'
    DomUtil.setStyles(lower, {
      position: 'absolute',
      overflow: 'hidden',
      left: 0,
      bottom: 0,
      right: 0,
      top: `${upperHeight}px`,
    })

    parent.appendChild(upper)
    parent.appendChild(lower)

    return [upper, lower]
  }

  public static makeDraggable(
    element: HTMLElement, grip: HTMLElement, getClientRect: () => DOMRect,
    onEvent: (event: WndEvent, param?: any) => void,
  ): void {
    const onDown = (event: MouseEvent|TouchEvent) => {
      switch(event.type) {
      case 'mousedown':
        if ((event as MouseEvent).button !== 0)
          return false
        break
      case 'touchstart':
        if ((event as TouchEvent).changedTouches.length <= 0 ||
            (event as TouchEvent).changedTouches[0].identifier !== 0)
          return false
        break
      default:
        return false
      }

      onEvent(WndEvent.DRAG_BEGIN)

      const rootRect = getClientRect()

      if (event.cancelable)
        event.preventDefault()
      const [mx, my] = DomUtil.getMousePosIn(event, element)
      const dragOfsX = -mx
      const dragOfsY = -my

      const width = parseInt(element.style.width || '-1', 10)
      const height = parseInt(element.style.height || '-1', 10)

      const pos = {x: mx, y: my}
      DomUtil.setMouseDragListener({
        move: (event2: MouseEvent) => {
          const [x, y] = DomUtil.getMousePosIn(event2, element.parentNode as HTMLElement)
          pos.x = Util.clamp(x + dragOfsX, 0, Math.floor(rootRect.width - width))
          pos.y = Util.clamp(y + dragOfsY, 0, Math.floor(rootRect.height - height))

          DomUtil.setStyles(element, {
            left: `${Math.round(pos.x)}px`,
            top: `${Math.round(pos.y)}px`,
          })
          onEvent(WndEvent.DRAG_MOVE, pos)
        },
        up: (_event2: MouseEvent) => {
          onEvent(WndEvent.DRAG_END)
        },
      })
      return true
    }
    grip.addEventListener('mousedown', onDown)
    grip.addEventListener('touchstart', onDown, {passive: true})
  }

  public static makeResizable(
    element: HTMLElement, getClientRect: () => DOMRect,
    onEvent: (event: WndEvent, param?: any) => void,
    domKey: KeyboardManager,
    opt?: ResizeOption,
  ): void {
    const MIN_WIDTH = opt?.minWidth || 80
    const MIN_HEIGHT = (opt?.minHeight || 60) + Wnd.TITLEBAR_HEIGHT
    const W = 8

    type StyleParams = {left?: string, right?: string, top?: string, bottom?: string, cursor?: string}
    type Horz = 'left'|'right'|'center'
    type Vert = 'top'|'bottom'|'center'
    const table: Array<{styleParams: StyleParams, horz: Horz, vert: Vert}> = [
      // Corners
      {
        styleParams: {right: '-1px', bottom: '-1px', cursor: 'nwse-resize'},
        horz: 'right',
        vert: 'bottom',
      },
      {
        styleParams: {left: '-1px', bottom: '-1px', cursor: 'nesw-resize'},
        horz: 'left',
        vert: 'bottom',
      },
      {
        styleParams: {right: '-1px', top: '-1px', cursor: 'nesw-resize'},
        horz: 'right',
        vert: 'top',
      },
      {
        styleParams: {left: '-1px', top: '-1px', cursor: 'nwse-resize'},
        horz: 'left',
        vert: 'top',
      },
      // Edges
      {
        styleParams: {left: `${W}px`, right: `${W}px`, top: `-${W - 4}px`, cursor: 'ns-resize'},
        horz: 'center',
        vert: 'top',
      },
      {
        styleParams: {left: `${W}px`, right: `${W}px`, bottom: '-1px', cursor: 'ns-resize'},
        horz: 'center',
        vert: 'bottom',
      },
      {
        styleParams: {top: `${W}px`, bottom: `${W}px`, left: '-1px', cursor: 'ew-resize'},
        horz: 'left',
        vert: 'center',
      },
      {
        styleParams: {top: `${W}px`, bottom: `${W}px`, right: '-1px', cursor: 'ew-resize'},
        horz: 'right',
        vert: 'center',
      },
    ]

    table.forEach(param => {
      if (opt?.cornerOnly && (param.horz === 'center' || param.vert === 'center'))
        return

      const resizeBox = document.createElement('div')
      resizeBox.className = 'resize-box'
      ;(Object.keys(param.styleParams) as (keyof StyleParams)[]).forEach(key => {
        resizeBox.style[key] = param.styleParams[key]!
      })
      DomUtil.setStyles(resizeBox, {
        width: param.horz !== 'center' ? `${W}px` : undefined,
        height: param.vert !== 'center' ? `${W}px` : undefined,
        zIndex: '2000',
      })
      const onDown = (event: MouseEvent|TouchEvent) => {
        switch(event.type) {
        case 'mousedown':
          if ((event as MouseEvent).button !== 0)
            return false
          event.preventDefault()
          break
        case 'touchstart':
          if ((event as TouchEvent).changedTouches.length <= 0 ||
              (event as TouchEvent).changedTouches[0].identifier !== 0)
            return false
          // Cannot call event.preventDefault() because touch event is used in passive mode.
          break
        default:
          return false
        }

        event.stopPropagation()
        const rootRect = getClientRect()
        const [mx, my] = DomUtil.getMousePosIn(event, resizeBox)
        const dragOfsX = param.horz === 'left' ? -mx : W - mx
        const dragOfsY = param.vert === 'top' ? -my : W - my
        const rect = element.getBoundingClientRect()
        const prect = (element.parentNode as HTMLElement).getBoundingClientRect()
        const BORDER = 2

        const origBox = {
          left: rect.left - prect.left,
          top: rect.top - prect.top,
          right: rect.right - prect.left,
          bottom: rect.bottom - prect.top,
          center: 0,  // dummy
        }

        onEvent(WndEvent.RESIZE_BEGIN)

        // Listen for shift key up/down, and re-calc last resize (if any)
        const lastEvent: {
          box?: typeof origBox,
          oldWidth?: number,
          oldHeight?: number,
        } = {}

        const retrigger = (_: any) => {
          dragArgs.move('retrigger')
        }

        document.addEventListener('keyup', retrigger)
        document.addEventListener('keydown', retrigger)

        const size = {width: origBox.right - origBox.left - BORDER, height: origBox.bottom - origBox.top - BORDER}
        const dragArgs = {
          move: (event2: MouseEvent|'retrigger') => {
            let box = { ...origBox }
            let oldWidth = box.right - box.left
            let oldHeight = box.bottom - box.top

            const preserveAspect = domKey.getKeyPressing('ShiftLeft')
              || domKey.getKeyPressing('ShiftRight')

            if (event2 !== 'retrigger') {
              let [x, y] = DomUtil.getMousePosIn(event2, element.parentNode as HTMLElement)
              x = Util.clamp(x, -dragOfsX, rootRect.width - dragOfsX)
              y = Util.clamp(y, -dragOfsY, rootRect.height - dragOfsY)
              box[param.horz] = x + dragOfsX
              box[param.vert] = y + dragOfsY

              lastEvent.oldWidth = oldWidth
              lastEvent.oldHeight= oldHeight
              lastEvent.box = { ...box }
            } else {
              // retriggered resize due to key up/down
              oldWidth = lastEvent.oldWidth || oldWidth
              oldHeight = lastEvent.oldHeight || oldHeight
              if (lastEvent.box !== undefined)
                box = { ...lastEvent.box }
            }

            let width = box.right - box.left
            let height = box.bottom - box.top
            const ratio = 4/3
            if (preserveAspect) {
              if (param.horz == 'center') {
                // Grabbed from top or bottom edge:
                // expand horizontal from center!
                width = height * ratio
                box.left -= (width - oldWidth)/2

                // Don't allow it to expand outside visible desktop
                let diff = 0
                if (box.left < 0)
                  diff = -box.left
                if (box.left + width + BORDER > rootRect.width)
                  diff = box.left + width + BORDER - rootRect.width
                if (diff != 0) {
                  box.left += diff
                  width -= diff * 2
                  height = width / ratio
                  if (param.vert == 'top')
                    box.top += 2 * diff / ratio
                }
              }
              else if (param.vert == 'center') {
                // Grabbed from left or right edge:
                // expand vertical from center!
                height = width / ratio
                box.top -= (height - oldHeight)/2

                // Don't allow it to expand outside visible desktop
                let diff = 0
                if (box.top < 0)
                  diff = -box.top
                if (box.top + height + BORDER > rootRect.height)
                  diff = box.top + height + BORDER - rootRect.height
                if (diff != 0) {
                  box.top += diff
                  height -= diff * 2
                  width = height * ratio
                  if (param.horz == 'left')
                    box.left += 2 * diff * ratio
                }
              }
              else {
                // Grabbed from a corner:
                // just expand from corner
                if (width / height >= ratio)
                  width = height * ratio
                else
                  height = width / ratio

                if (param.horz == 'left')
                  box.left = box.right - width
                if (param.vert == 'top')
                  box.top = box.bottom - height
              }

              box.right = box.left + width
              box.bottom = box.top + height
            }

            width += BORDER
            height += BORDER

            if (width < MIN_WIDTH) {
              box[param.horz] -= (MIN_WIDTH - width) * (param.horz === 'left' ? 1 : -1)
              width = MIN_WIDTH
            }
            if (height < MIN_HEIGHT) {
              box[param.vert] -= (MIN_HEIGHT - height) * (param.vert === 'top' ? 1 : -1)
              height = MIN_HEIGHT
            }
            DomUtil.setStyles(element, {
              width: `${Math.round(width - BORDER)}px`,
              height: `${Math.round(height - BORDER)}px`,
              left: `${Math.round(box.left)}px`,
              top: `${Math.round(box.top)}px`,
            })
            size.width = width
            size.height = height - Wnd.TITLEBAR_HEIGHT
            onEvent(WndEvent.RESIZE_MOVE, size)
          },
          up: (_event2: MouseEvent) => {
            onEvent(WndEvent.RESIZE_END, size)
            document.removeEventListener('keyup', retrigger)
            document.removeEventListener('keydown', retrigger)
          },
        }
        DomUtil.setMouseDragListener(dragArgs)

        return true
      }
      resizeBox.addEventListener('mousedown', onDown)
      resizeBox.addEventListener('touchstart', onDown, {passive: true})

      element.appendChild(resizeBox)
    })
  }

  public static openSubmenu(
    submenu: Array<SubmenuItemInfo>,
    pos: {left?: string; bottom?: string},
    parent: HTMLElement,
    option: {className?: string; onClose?: () => void},
  ): () => void {
    const subItemHolder = document.createElement('div')
    if (option.className != null)
      subItemHolder.className = option.className
    subItemHolder.style.zIndex = String(Z_MENU_SUBITEM)
    subItemHolder.addEventListener('click', event => {
      event.stopPropagation()
    })

    submenu.forEach(submenuItem => {
      const submenuRow = document.createElement('div')
      submenuRow.className = 'submenu-row clearfix'
      const subItemElem = document.createElement('div')
      if (submenuItem.label !== '----') {
        let checked = submenuItem.checked
        if (typeof submenuItem.checked === 'function')
          checked = submenuItem.checked()
        if (checked) {
          const checkedElem = document.createElement('div')
          checkedElem.className = 'submenu-check'
          submenuRow.appendChild(checkedElem)
        }

        subItemElem.appendChild(document.createTextNode(submenuItem.label))
        if (submenuItem.shortcut != null) {
          const sc = document.createElement('span')
          sc.className = 'pull-right'
          sc.innerText = submenuItem.shortcut
          subItemElem.appendChild(sc)
        }

        let disabled = submenuItem.disabled
        if (typeof submenuItem.disabled === 'function')
          disabled = submenuItem.disabled()
        if (disabled) {
          subItemElem.className = 'menu-item disabled'
        } else {
          subItemElem.className = 'menu-item'
          submenuRow.addEventListener('click', _event => {
            if (submenuItem.click)
              submenuItem.click()

            close()
            if (option.onClose != null)
              option.onClose()
          })
        }
      } else {
        const hr = document.createElement('hr')
        hr.className = 'submenu-splitter'
        submenuRow.style.padding = '4px 0'
        submenuRow.appendChild(hr)
      }
      submenuRow.appendChild(subItemElem)
      subItemHolder.appendChild(submenuRow)
    })
    parent.appendChild(subItemHolder)

    DomUtil.setStyles(subItemHolder, pos)

    const close = () => {
      if (subItemHolder.parentNode != null)
        subItemHolder.parentNode.removeChild(subItemHolder)
      document.removeEventListener('click', onClickOther)
    }

    // To handle earlier than menu open, pass useCapture=true
    const onClickOther = (_event: MouseEvent) => {
      close()
      if (option.onClose != null)
        option.onClose()
    }
    document.addEventListener('click', onClickOther /*, true*/)

    return close
  }
}
