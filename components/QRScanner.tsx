import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      },
      false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        scanner.clear(); // Stop scanning after success
      },
      (errorMessage) => {
        // Ignore errors during scanning as they happen frequently when no QR is found
      }
    );

    return () => {
      scanner.clear().catch(error => {
        console.error("Failed to clear html5-qrcode scanner", error);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl overflow-hidden relative shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <X className="w-6 h-6 text-gray-800 dark:text-white" />
        </button>
        
        <div className="p-4">
          <h3 className="text-xl font-bold text-center mb-4 text-gray-800 dark:text-white">QR 코드 스캔</h3>
          <div id="reader" className="w-full h-auto"></div>
          {error && <p className="text-red-500 text-center mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default QRScanner;