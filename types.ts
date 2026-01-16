export type QRType = 'URL' | 'TEXT' | 'WIFI' | 'EMAIL' | 'SMS' | 'TEL';

export interface QRData {
  type: QRType;
  value: string; // The final string to encode
  inputs: {
    [key: string]: string;
  };
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  data: QRData;
  name: string; // User friendly name e.g. "My Wifi"
}

export interface QRConfig {
  fgColor: string;
  bgColor: string;
  size: number;
  level: 'L' | 'M' | 'Q' | 'H';
  includeImage: boolean;
  imageSrc: string | null;
}

export const QR_HISTORY_LINK = "https://en.wikipedia.org/wiki/QR_code";