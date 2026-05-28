import * as React from "react"

const MOBILE_BREAKPOINT = 768
const PHONE_MAX_SHORT_SIDE = 600

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

/**
 * Detects a true phone (not a tablet, not a small desktop window).
 *
 * A phone has BOTH:
 *  - A coarse pointer (touchscreen-primary)
 *  - A *device* shortest side under ~600 px (all current iPhones; excludes all iPads)
 *
 * Using `screen.width`/`screen.height` (device dimensions) instead of viewport
 * size means orientation changes don't toggle the result, and a narrow desktop
 * browser window does not get classified as a phone.
 */
function computeIsPhone(): boolean {
  if (typeof window === "undefined" || !window.screen) return false
  const coarse = window.matchMedia("(pointer: coarse)").matches
  const shortSide = Math.min(window.screen.width, window.screen.height)
  return coarse && shortSide < PHONE_MAX_SHORT_SIDE
}

export function useIsPhone() {
  // Sync initializer avoids a first-render flash of editable UI on phones.
  const [isPhone, setIsPhone] = React.useState<boolean>(() => computeIsPhone())

  React.useEffect(() => {
    const compute = () => setIsPhone(computeIsPhone())
    compute()

    const pointerMql = window.matchMedia("(pointer: coarse)")
    pointerMql.addEventListener("change", compute)
    window.addEventListener("orientationchange", compute)
    window.addEventListener("resize", compute)
    return () => {
      pointerMql.removeEventListener("change", compute)
      window.removeEventListener("orientationchange", compute)
      window.removeEventListener("resize", compute)
    }
  }, [])

  return isPhone
}
