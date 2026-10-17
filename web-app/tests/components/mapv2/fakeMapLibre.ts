import { vi } from "vitest";

type Handler = (event?: unknown) => void;

/* A stand-in for maplibre-gl's Map: records options and handlers so tests can fire map events by hand. */
export class FakeMap {
  static instances: FakeMap[] = [];
  readonly options: Record<string, unknown>;
  readonly handlers = new Map<string, Handler[]>();
  readonly onceHandlers = new Map<string, Handler[]>();
  readonly layers = new Set<string>();
  readonly canvas = document.createElement("canvas");
  styleLoaded = true;
  zoom = 13;
  bearing = 0;
  pitch = 60;
  addLayer = vi.fn((layer: { id: string }) => this.layers.add(layer.id));
  getLayer = vi.fn((id: string) => (this.layers.has(id) ? { id } : undefined));
  getSource = vi.fn(() => ({ setData: vi.fn() }));
  addSource = vi.fn();
  easeTo = vi.fn();
  flyTo = vi.fn();
  jumpTo = vi.fn();
  zoomIn = vi.fn();
  zoomOut = vi.fn();
  setStyle = vi.fn();
  remove = vi.fn();
  off = vi.fn((type: string, handler: Handler) => {
    this.handlers.set(type, (this.handlers.get(type) ?? []).filter((h) => h !== handler));
  });
  project = vi.fn(({ 0: lng, 1: lat }: [number, number]) => ({ x: lng, y: lat }));

  constructor(options: Record<string, unknown>) {
    this.options = options;
    FakeMap.instances.push(this);
  }

  on(type: string, handler: Handler): this {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
    return this;
  }

  once(type: string, handler: Handler): this {
    this.onceHandlers.set(type, [...(this.onceHandlers.get(type) ?? []), handler]);
    return this;
  }

  fire(type: string, event?: unknown): void {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
    const once = this.onceHandlers.get(type) ?? [];
    this.onceHandlers.delete(type);
    for (const handler of once) handler(event);
  }

  isStyleLoaded(): boolean {
    return this.styleLoaded;
  }
  getZoom(): number {
    return this.zoom;
  }
  getBearing(): number {
    return this.bearing;
  }
  getPitch(): number {
    return this.pitch;
  }
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
