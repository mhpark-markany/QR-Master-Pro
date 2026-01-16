import { QRData, QRType } from '../types';

export const generateQRString = (type: QRType, inputs: Record<string, string>): string => {
  switch (type) {
    case 'URL':
    case 'TEXT':
      return inputs.value || '';
    case 'WIFI':
      const { ssid, password, encryption, hidden } = inputs;
      return `WIFI:T:${encryption || 'WPA'};S:${ssid || ''};P:${password || ''};H:${hidden === 'true' ? 'true' : 'false'};;`;
    case 'EMAIL':
      return `mailto:${inputs.email}?subject=${encodeURIComponent(inputs.subject || '')}&body=${encodeURIComponent(inputs.body || '')}`;
    case 'SMS':
      return `smsto:${inputs.phone}:${inputs.message || ''}`;
    case 'TEL':
      return `tel:${inputs.phone}`;
    default:
      return '';
  }
};

// Check if two hex colors are too similar (simple Euclidean distance in RGB)
export const areColorsTooSimilar = (color1: string, color2: string): boolean => {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  if (!c1 || !c2) return false;

  const distance = Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );

  // Threshold for similarity (approx < 50 is hard to read)
  return distance < 60;
};