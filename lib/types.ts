export interface HSBK {
  hue: number;
  saturation: number;
  brightness: number;
  kelvin: number;
}

export interface BulbIdentity {
  id: string;
  address: string;
  label: string;
  productId: number;
  isMultiZone: boolean;
}

export interface PaletteColor {
  hue: number;
  saturation: number;
  brightness: number;
  kelvin?: number;
}

export interface Theme {
  id: string;
  name: string;
  colors: PaletteColor[];
}

export interface EffectSnapshot {
  power: boolean;
  color: HSBK;
  zones?: HSBK[];
}

export type EffectKind = 'morph' | 'candle';
