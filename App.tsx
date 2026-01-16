import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Download, 
  History, 
  Trash2, 
  Settings, 
  Moon, 
  Sun, 
  Image as ImageIcon, 
  ScanLine, 
  Wifi, 
  Globe, 
  Type, 
  Mail, 
  MessageSquare, 
  Phone,
  AlertTriangle,
  CircleHelp,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';
import gsap from 'gsap';

import { QRData, QRType, QRConfig, HistoryItem, QR_HISTORY_LINK } from './types';
import { generateQRString, areColorsTooSimilar } from './utils/qrHelpers';
import QRScanner from './components/QRScanner';

// Default Configurations
const DEFAULT_COLOR_FG = '#000000';
const DEFAULT_COLOR_BG = '#FFFFFF';

// --- Tour Configuration ---
const TOUR_STEPS = [
  { target: 'tour-header-logo', title: '환영합니다!', content: 'QR Master Pro에 오신 것을 환영합니다. 앱의 주요 기능을 빠르게 소개해드릴게요.' },
  { target: 'tour-templates', title: '템플릿 선택', content: 'URL, Wi-Fi, 연락처 등 만들고 싶은 QR 코드의 종류를 선택하세요.' },
  { target: 'tour-inputs', title: '정보 입력', content: '선택한 유형에 맞춰 정보를 입력하세요. 입력 길이는 실시간으로 확인됩니다.' },
  { target: 'tour-save-btn', title: '히스토리 저장', content: '자주 사용하는 QR 정보는 히스토리에 저장해두고 언제든 다시 불러올 수 있습니다.' },
  { target: 'tour-design', title: '디자인 커스텀', content: '브랜드 컬러를 입히거나 로고를 추가해 나만의 특별한 QR 코드를 만들어보세요.' },
  { target: 'tour-preview', title: '다운로드', content: '생성된 QR 코드를 확인하고 이미지로 저장하세요.' },
  { target: 'tour-history-btn', title: '기록 관리', content: '저장된 QR 코드 목록은 여기서 확인하고 관리할 수 있습니다.' },
];

// --- Components ---

// Error Boundary Component to catch "Data too long" errors
class ErrorBoundary extends React.Component<{ children: React.ReactNode, resetKey: any }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: any) {
    if (prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full text-red-500 p-6 text-center border-2 border-dashed border-red-200 dark:border-red-800 rounded-xl bg-red-50 dark:bg-red-900/10 animate-in fade-in zoom-in duration-300">
          <AlertTriangle className="w-10 h-10 mb-3 opacity-80" />
          <p className="font-bold text-sm mb-2">QR 코드를 생성할 수 없습니다</p>
          <p className="text-xs opacity-80 max-w-[200px] leading-relaxed break-keep">
            데이터가 너무 길어 현재 설정으로 QR코드를 만들 수 없습니다. 내용을 줄이거나 이미지를 제거해보세요.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Tour Overlay Component
const TourOverlay = ({ stepIndex, steps, onNext, onPrev, onClose }: { 
    stepIndex: number; 
    steps: typeof TOUR_STEPS; 
    onNext: () => void; 
    onPrev: () => void; 
    onClose: () => void; 
}) => {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [windowSize, setWindowSize] = useState({ 
        width: typeof window !== 'undefined' ? window.innerWidth : 0, 
        height: typeof window !== 'undefined' ? window.innerHeight : 0 
    });
    
    const step = steps[stepIndex];

    useEffect(() => {
        const updateRect = () => {
            const el = document.getElementById(step.target);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                const rect = el.getBoundingClientRect();
                setTargetRect(rect);
                setWindowSize({ width: window.innerWidth, height: window.innerHeight });
            }
        };

        const timer = setTimeout(updateRect, 100);
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect);
        };
    }, [step]);

    if (!targetRect) return null;

    const viewportWidth = windowSize.width;
    const viewportHeight = windowSize.height;
    
    // Calculate Tooltip Dimensions & Position
    const tooltipMaxWidth = 320; 
    const tooltipWidth = Math.min(tooltipMaxWidth, viewportWidth * 0.9);
    const padding = 15; // Minimum spacing from screen edge

    // Vertical Position Logic
    const spaceBelow = viewportHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;
    // Prefer bottom if there's enough space (250px) or if it has more space than top
    const showBelow = spaceBelow > 250 || spaceBelow > spaceAbove;

    // Horizontal Position Logic
    const targetCenterX = targetRect.left + targetRect.width / 2;
    // Attempt to center tooltip on target
    let left = targetCenterX - tooltipWidth / 2;

    // Clamp to viewport
    if (left < padding) {
        left = padding;
    } else if (left + tooltipWidth > viewportWidth - padding) {
        left = viewportWidth - tooltipWidth - padding;
    }

    // Arrow Logic
    // Arrow connects tooltip to targetCenter
    let arrowLeft = targetCenterX - left;
    // Clamp arrow within tooltip rounded corners (approx 20px safe zone)
    const arrowSafeZone = 24;
    if (arrowLeft < arrowSafeZone) arrowLeft = arrowSafeZone;
    if (arrowLeft > tooltipWidth - arrowSafeZone) arrowLeft = tooltipWidth - arrowSafeZone;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Spotlight Effect */}
            <div 
                className="absolute transition-all duration-300 ease-out rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none"
                style={{
                    top: targetRect.top - 5,
                    left: targetRect.left - 5,
                    width: targetRect.width + 10,
                    height: targetRect.height + 10,
                }}
            ></div>

            {/* Tooltip */}
            <div 
                className="absolute bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95"
                style={{
                    top: showBelow ? targetRect.bottom + 15 : undefined,
                    bottom: showBelow ? undefined : viewportHeight - targetRect.top + 15,
                    left: left,
                    width: tooltipWidth,
                }}
            >
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Step {stepIndex + 1} / {steps.length}</span>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{step.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                    {step.content}
                </p>
                <div className="flex justify-between items-center">
                    <button 
                        onClick={onPrev} 
                        disabled={stepIndex === 0}
                        className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${stepIndex === 0 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                        <ChevronLeft className="w-4 h-4" /> 이전
                    </button>
                    <button 
                        onClick={onNext}
                        className="text-sm font-bold px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1 shadow-lg shadow-primary/30"
                    >
                        {stepIndex === steps.length - 1 ? '완료' : '다음'} <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Arrow */}
                <div 
                    className={`absolute w-4 h-4 bg-white dark:bg-gray-800 rotate-45 transform -translate-x-1/2 ${showBelow ? '-top-2' : '-bottom-2'}`}
                    style={{ left: arrowLeft }}
                ></div>
            </div>
        </div>
    );
};


function App() {
  // --- State ---
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [qrType, setQrType] = useState<QRType>('URL');
  const [inputs, setInputs] = useState<Record<string, string>>({ value: '' });
  const [config, setConfig] = useState<QRConfig>({
    fgColor: DEFAULT_COLOR_FG,
    bgColor: DEFAULT_COLOR_BG,
    size: 1024, // High resolution for downloads
    level: 'H', // Use High error correction when image is included
    includeImage: false,
    imageSrc: null,
  });
  
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);
  
  // Tour State
  const [tourStep, setTourStep] = useState<number | null>(null);

  const qrRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Load History
  useEffect(() => {
    const saved = localStorage.getItem('qr_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Initialize Tour
  useEffect(() => {
      const hasSeenTour = localStorage.getItem('has_seen_tour');
      if (!hasSeenTour) {
          // Add small delay to ensure UI is ready
          const timer = setTimeout(() => {
              setTourStep(0);
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, []);

  // GSAP Animations
  useEffect(() => {
    if (qrRef.current) {
      gsap.fromTo(qrRef.current, 
        { scale: 0.8, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }
      );
    }
  }, [inputs, config.fgColor, config.bgColor, config.imageSrc]);

  useEffect(() => {
    if (showHistory && historyRef.current) {
      gsap.fromTo(historyRef.current,
        { x: 300, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [showHistory]);

  // --- Handlers ---

  const handleInputChange = (key: string, value: string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleTypeChange = (type: QRType) => {
    setQrType(type);
    setInputs({ value: '' }); // Reset inputs
    
    // Animate inputs change
    if (settingsRef.current) {
        gsap.fromTo(settingsRef.current,
            { y: 10, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.3 }
        );
    }
  };

  const handleColorChange = (type: 'fg' | 'bg', color: string) => {
    const newFg = type === 'fg' ? color : config.fgColor;
    const newBg = type === 'bg' ? color : config.bgColor;

    if (areColorsTooSimilar(newFg, newBg)) {
      setColorError("배경색과 전경색이 너무 비슷합니다. 인식이 어려울 수 있습니다.");
    } else {
      setColorError(null);
    }

    setConfig(prev => ({ ...prev, fgColor: newFg, bgColor: newBg }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        // Load image to determine aspect ratio
        const img = new Image();
        img.onload = () => {
             const ratio = img.width / img.height;
             setImageAspectRatio(ratio);
             // When adding an image, it's safer to use High error correction level
             setConfig(prev => ({ 
                 ...prev, 
                 imageSrc: result, 
                 includeImage: true,
                 level: 'H' 
             }));
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const saveToHistory = () => {
    const qrString = generateQRString(qrType, inputs);
    if (!qrString || (qrType === 'URL' && !inputs.value)) return;

    let name: string = qrType;
    if (qrType === 'URL') name = inputs.value;
    else if (qrType === 'WIFI') name = `WiFi: ${inputs.ssid}`;
    else if (qrType === 'TEL') name = `Tel: ${inputs.phone}`;

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      data: { type: qrType, value: qrString, inputs },
      name: name.length > 20 ? name.substring(0, 20) + '...' : name,
    };

    const newHistory = [newItem, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('qr_history', JSON.stringify(newHistory));
    
    // Feedback animation
    const btn = document.getElementById('save-btn');
    if (btn) {
        gsap.to(btn, { scale: 1.05, duration: 0.1, yoyo: true, repeat: 1 });
    }
  };

  const deleteHistoryItem = (id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem('qr_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    if (window.confirm('히스토리를 모두 삭제하시겠습니까?')) {
      setHistory([]);
      localStorage.removeItem('qr_history');
    }
  };

  const downloadQR = () => {
    const canvas = document.getElementById('qr-gen-canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `qrcode-${Date.now()}.png`;
      link.href = url;
      link.click();
    } else {
        alert("QR 코드가 생성되지 않아 다운로드할 수 없습니다.\n입력 내용을 확인해주세요.");
    }
  };

  // --- Tour Handlers ---
  const handleTourNext = () => {
      if (tourStep !== null && tourStep < TOUR_STEPS.length - 1) {
          setTourStep(tourStep + 1);
      } else {
          handleTourClose();
      }
  };

  const handleTourPrev = () => {
      if (tourStep !== null && tourStep > 0) {
          setTourStep(tourStep - 1);
      }
  };

  const handleTourClose = () => {
      setTourStep(null);
      localStorage.setItem('has_seen_tour', 'true');
  };

  const startTour = () => {
      setTourStep(0);
  };

  // --- Calculations for Image Size ---
  const logoMaxSize = config.size * 0.22; // Max 22% of QR size
  let logoWidth = logoMaxSize;
  let logoHeight = logoMaxSize;

  if (imageAspectRatio > 1) {
    // Landscape
    logoHeight = logoMaxSize / imageAspectRatio;
  } else {
    // Portrait or Square
    logoWidth = logoMaxSize * imageAspectRatio;
  }

  // --- Render Helpers ---

  const inputClasses = "w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-gray-400 dark:placeholder-gray-500 outline-none";
  const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";
  const counterClasses = "text-xs text-gray-400 dark:text-gray-500 font-mono";

  const renderInputs = () => {
    switch (qrType) {
      case 'URL':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className={labelClasses}>웹사이트 URL</label>
                <span className={counterClasses}>{(inputs.value || '').length}/2000</span>
            </div>
            <input
              type="url"
              maxLength={2000}
              placeholder="https://example.com"
              className={inputClasses}
              value={inputs.value || ''}
              onChange={(e) => handleInputChange('value', e.target.value)}
            />
          </div>
        );
      case 'WIFI':
        return (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center">
                  <label className={labelClasses}>네트워크 이름 (SSID)</label>
                  <span className={counterClasses}>{(inputs.ssid || '').length}/32</span>
              </div>
              <input 
                type="text" 
                maxLength={32}
                placeholder="예: MyHome_Wi-Fi" 
                className={inputClasses} 
                value={inputs.ssid || ''} 
                onChange={(e) => handleInputChange('ssid', e.target.value)} 
              />
            </div>
            <div>
              <div className="flex justify-between items-center">
                  <label className={labelClasses}>비밀번호</label>
                  <span className={counterClasses}>{(inputs.password || '').length}/63</span>
              </div>
              <input 
                type="text" 
                maxLength={63}
                placeholder="Wi-Fi 비밀번호" 
                className={inputClasses} 
                value={inputs.password || ''} 
                onChange={(e) => handleInputChange('password', e.target.value)} 
              />
            </div>
            <div>
              <label className={labelClasses}>보안 유형</label>
              <select className={inputClasses} value={inputs.encryption || 'WPA'} onChange={(e) => handleInputChange('encryption', e.target.value)}>
                <option value="WPA">WPA/WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">없음</option>
              </select>
            </div>
          </div>
        );
      case 'TEXT':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                 <label className={labelClasses}>텍스트 내용</label>
                 <span className={counterClasses}>{(inputs.value || '').length}/2000</span>
            </div>
            <textarea
              maxLength={2000}
              placeholder="QR코드에 담을 텍스트를 입력하세요"
              rows={4}
              className={inputClasses}
              value={inputs.value || ''}
              onChange={(e) => handleInputChange('value', e.target.value)}
            />
          </div>
        );
      case 'EMAIL':
        return (
          <div className="space-y-4">
             <div>
                <div className="flex justify-between items-center">
                    <label className={labelClasses}>받는 사람 이메일</label>
                    <span className={counterClasses}>{(inputs.email || '').length}/320</span>
                </div>
                <input 
                    type="email" 
                    maxLength={320}
                    placeholder="example@email.com" 
                    className={inputClasses} 
                    value={inputs.email || ''} 
                    onChange={(e) => handleInputChange('email', e.target.value)} 
                />
             </div>
             <div>
                <div className="flex justify-between items-center">
                    <label className={labelClasses}>제목</label>
                    <span className={counterClasses}>{(inputs.subject || '').length}/100</span>
                </div>
                <input 
                    type="text" 
                    maxLength={100}
                    placeholder="메일 제목" 
                    className={inputClasses} 
                    value={inputs.subject || ''} 
                    onChange={(e) => handleInputChange('subject', e.target.value)} 
                />
             </div>
             <div>
                <div className="flex justify-between items-center">
                    <label className={labelClasses}>내용</label>
                    <span className={counterClasses}>{(inputs.body || '').length}/1500</span>
                </div>
                <textarea 
                    maxLength={1500}
                    placeholder="이메일 내용" 
                    rows={4} 
                    className={inputClasses} 
                    value={inputs.body || ''} 
                    onChange={(e) => handleInputChange('body', e.target.value)} 
                />
             </div>
          </div>
        );
      case 'SMS':
        return (
          <div className="space-y-4">
             <div>
                <div className="flex justify-between items-center">
                    <label className={labelClasses}>전화번호</label>
                    <span className={counterClasses}>{(inputs.phone || '').length}/20</span>
                </div>
                <input 
                    type="tel" 
                    maxLength={20}
                    placeholder="010-0000-0000" 
                    className={inputClasses} 
                    value={inputs.phone || ''} 
                    onChange={(e) => handleInputChange('phone', e.target.value)} 
                />
             </div>
             <div>
                <div className="flex justify-between items-center">
                    <label className={labelClasses}>메시지 내용</label>
                    <span className={counterClasses}>{(inputs.message || '').length}/1000</span>
                </div>
                <textarea 
                    maxLength={1000}
                    placeholder="보낼 메시지" 
                    rows={4} 
                    className={inputClasses} 
                    value={inputs.message || ''} 
                    onChange={(e) => handleInputChange('message', e.target.value)} 
                />
             </div>
          </div>
        );
      case 'TEL':
        return (
           <div className="space-y-4">
             <div className="flex justify-between items-center">
                <label className={labelClasses}>전화번호</label>
                <span className={counterClasses}>{(inputs.phone || '').length}/20</span>
             </div>
             <input 
                type="tel" 
                maxLength={20}
                placeholder="예: 010-1234-5678" 
                className={inputClasses} 
                value={inputs.phone || ''} 
                onChange={(e) => handleInputChange('phone', e.target.value)} 
             />
           </div>
        );
    }
  };

  const finalValue = generateQRString(qrType, inputs);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* Tour Overlay */}
      {tourStep !== null && (
          <TourOverlay 
            stepIndex={tourStep} 
            steps={TOUR_STEPS} 
            onNext={handleTourNext} 
            onPrev={handleTourPrev} 
            onClose={handleTourClose}
          />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2" id="tour-header-logo">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center text-white font-bold shadow-md">Q</div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              QR Master Pro
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowScanner(true)}
              className="md:hidden p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
              aria-label="QR 스캐너"
            >
              <ScanLine className="w-5 h-5" />
            </button>
            <button
              onClick={startTour}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors hidden sm:block"
              aria-label="도움말"
              title="도움말 투어 다시보기"
            >
              <CircleHelp className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              id="tour-history-btn"
              onClick={() => setShowHistory(true)} 
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors relative"
              aria-label="History"
            >
              <History className="w-5 h-5" />
              {history.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-gray-800"></span>}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Settings */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Template Selector */}
          <div id="tour-templates" className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <h2 className="text-lg font-semibold mb-4 px-1 text-gray-800 dark:text-gray-200">템플릿 선택</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { id: 'URL', icon: Globe, label: 'URL' },
                { id: 'WIFI', icon: Wifi, label: 'Wi-Fi' },
                { id: 'TEXT', icon: Type, label: '텍스트' },
                { id: 'EMAIL', icon: Mail, label: '이메일' },
                { id: 'SMS', icon: MessageSquare, label: 'SMS' },
                { id: 'TEL', icon: Phone, label: '전화' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTypeChange(item.id as QRType)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                    qrType === item.id 
                      ? 'bg-primary/10 text-primary ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-800' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30'
                  }`}
                >
                  <item.icon className={`w-6 h-6 mb-2 ${qrType === item.id ? 'stroke-[2.5px]' : ''}`} />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <div id="tour-inputs" className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors" ref={settingsRef}>
            <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">내용 입력</h2>
            </div>
            {renderInputs()}
            <div className="mt-6 flex justify-end">
               <button 
                id="tour-save-btn" // ID also used for tour logic
                onClick={saveToHistory}
                disabled={!finalValue}
                className="px-6 py-2.5 bg-gray-900 dark:bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md hover:shadow-lg"
               >
                 히스토리에 저장
               </button>
            </div>
          </div>

          {/* Customization */}
          <div id="tour-design" className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="flex items-center gap-2 mb-6">
               <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
               <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">디자인 설정</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Colors */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">색상 커스텀</label>
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-2">QR 코드 (전경)</label>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600">
                        <input 
                            type="color" 
                            value={config.fgColor} 
                            onChange={(e) => handleColorChange('fg', e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" 
                        />
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-300 uppercase">{config.fgColor}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-2">배경</label>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600">
                        <input 
                            type="color" 
                            value={config.bgColor} 
                            onChange={(e) => handleColorChange('bg', e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" 
                        />
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-300 uppercase">{config.bgColor}</span>
                    </div>
                  </div>
                </div>
                {colorError && <p className="text-xs text-red-500 mt-1 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded">{colorError}</p>}
              </div>

              {/* Logo Image */}
              <div className="space-y-4">
                 <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">로고 이미지</label>
                    <div className="flex items-center gap-2">
                        <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-400 dark:hover:border-gray-500 transition-all group bg-gray-50 dark:bg-gray-700/20">
                            <ImageIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-primary dark:group-hover:text-primary transition-colors" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">이미지 업로드</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                        {config.imageSrc && (
                            <button 
                                onClick={() => setConfig(prev => ({...prev, imageSrc: null, includeImage: false}))}
                                className="p-3 text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                title="이미지 삭제"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 ml-1">
                        * QR 코드 중앙에 삽입되며 비율이 유지됩니다.
                    </p>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-5">
           <div className="sticky top-24 space-y-6">
               <div id="tour-preview" className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center min-h-[420px] transition-colors relative overflow-hidden">
                   {/* Decorative background blur */}
                   <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 dark:bg-primary/20 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2 transition-colors"></div>
                   <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 dark:bg-secondary/20 rounded-full blur-3xl -z-10 transform -translate-x-1/2 translate-y-1/2 transition-colors"></div>
                   
                   <h3 className="text-sm font-bold tracking-widest text-gray-400 dark:text-gray-500 mb-8 uppercase">Live Preview</h3>
                   
                   <div 
                     ref={qrRef}
                     className="p-4 rounded-xl shadow-lg shadow-gray-200/50 dark:shadow-black/30 border border-gray-100 dark:border-gray-700 w-full max-w-[300px] flex items-center justify-center aspect-square transition-all"
                     style={{ background: config.bgColor }} // Ensure container matches bg
                   >
                       {finalValue ? (
                           <ErrorBoundary resetKey={finalValue + config.level + (config.includeImage ? 'img' : '')}>
                               <QRCodeCanvas
                                   id="qr-gen-canvas"
                                   value={finalValue}
                                   size={1024} // High resolution for download
                                   fgColor={config.fgColor}
                                   bgColor={config.bgColor}
                                   level={config.level}
                                   style={{ width: '100%', height: '100%' }} // CSS scaling for display
                                   imageSettings={config.includeImage && config.imageSrc ? {
                                       src: config.imageSrc,
                                       x: undefined,
                                       y: undefined,
                                       height: logoHeight,
                                       width: logoWidth,
                                       excavate: true,
                                   } : undefined}
                               />
                           </ErrorBoundary>
                       ) : (
                           <div className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-600 h-full w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                               <ScanLine className="w-10 h-10 mb-2 opacity-50" />
                               <p className="text-sm font-medium">입력하면 생성됩니다</p>
                           </div>
                       )}
                   </div>

                   <div className="mt-8 w-full max-w-xs">
                       <button
                           onClick={downloadQR}
                           disabled={!finalValue}
                           className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 transform hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none active:scale-95"
                       >
                           <Download className="w-5 h-5" />
                           이미지 다운로드
                       </button>
                   </div>
               </div>

               {/* QR History Link Block */}
               <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-700 dark:to-gray-800 text-white rounded-2xl p-6 shadow-lg flex items-center justify-between group overflow-hidden relative">
                   <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="relative z-10">
                       <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                           QR코드의 역사
                           <Globe className="w-4 h-4 opacity-50" />
                       </h4>
                       <p className="text-xs text-gray-300 dark:text-gray-400 max-w-[150px] leading-relaxed">QR코드는 어떻게 발명되었을까요? 위키백과에서 확인해보세요.</p>
                   </div>
                   <div className="bg-white p-2 rounded-lg relative z-10 transform group-hover:scale-105 transition-transform duration-300">
                       <QRCodeCanvas 
                           value={QR_HISTORY_LINK} 
                           size={60} 
                           fgColor="#000000" 
                           bgColor="#FFFFFF"
                       />
                   </div>
               </div>
           </div>
        </div>
      </main>

      {/* History Sidebar Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowHistory(false)}></div>
          <div ref={historyRef} className="relative w-full max-w-md bg-white dark:bg-gray-800 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700">
             <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur">
                 <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                     <History className="w-5 h-5 text-primary" />
                     생성 기록
                 </h3>
                 <button onClick={() => setShowHistory(false)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><XIcon className="w-5 h-5"/></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/30">
                 {history.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
                         <History className="w-12 h-12 mb-4 opacity-20" />
                         <p>아직 생성된 기록이 없습니다.</p>
                     </div>
                 ) : (
                     history.map(item => (
                         <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-primary/50 dark:hover:border-primary/50 transition-all group">
                             <div className="flex justify-between items-start mb-2">
                                 <span className="text-[10px] font-bold tracking-wider text-primary bg-primary/10 px-2 py-1 rounded uppercase">{item.data.type}</span>
                                 <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteHistoryItem(item.id);
                                    }}
                                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="삭제"
                                 >
                                     <Trash2 className="w-4 h-4" />
                                 </button>
                             </div>
                             <p className="text-sm font-medium mb-1 truncate text-gray-800 dark:text-gray-200">{item.name}</p>
                             <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">{new Date(item.timestamp).toLocaleString()}</p>
                             <button 
                                onClick={() => {
                                    setQrType(item.data.type);
                                    setInputs(item.data.inputs);
                                    setShowHistory(false);
                                }}
                                className="w-full py-2 text-xs font-medium bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 hover:border-primary/30 hover:text-primary dark:hover:text-primary transition-all shadow-sm"
                             >
                                 불러오기
                             </button>
                         </div>
                     ))
                 )}
             </div>

             {history.length > 0 && (
                 <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                     <button onClick={clearHistory} className="w-full py-3 text-red-500 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30 flex items-center justify-center gap-2">
                         <Trash2 className="w-4 h-4" />
                         기록 전체 삭제
                     </button>
                 </div>
             )}
          </div>
        </div>
      )}

      {/* Mobile Scanner Modal */}
      {showScanner && (
          <QRScanner 
            onClose={() => setShowScanner(false)} 
            onScan={(text) => {
                // If text looks like a URL, ask to open it
                if (text.startsWith('http') || text.startsWith('www')) {
                    if(window.confirm(`스캔된 URL로 이동하시겠습니까?\n${text}`)) {
                        window.open(text, '_blank');
                    }
                } else {
                    alert(`스캔 결과:\n${text}`);
                }
                setShowScanner(false);
            }} 
          />
      )}
    </div>
  );
}

// Simple X icon for sidebar
const XIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export default App;