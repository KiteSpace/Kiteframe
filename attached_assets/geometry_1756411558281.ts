export function clamp(v:number, min:number, max:number){ return Math.max(min, Math.min(max, v)); }

export function clientToWorld(clientX:number, clientY:number, viewport:{x:number;y:number;zoom:number}, rect:DOMRect){
  const x = (clientX - rect.left - viewport.x) / viewport.zoom;
  const y = (clientY - rect.top - viewport.y) / viewport.zoom;
  return { x, y };
}

export function zoomAroundPoint(zoom:number, delta:number, minZoom:number, maxZoom:number){
  const factor = Math.exp(-delta * 0.2);
  return clamp(zoom * factor, minZoom, maxZoom);
}
