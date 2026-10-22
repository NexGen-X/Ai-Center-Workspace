import { useState, useEffect } from 'react';

export interface ResponsiveState {
  width: number;
  height: number;
  isSmallMobile: boolean; // < 480px
  isMobile: boolean;      // < 768px
  isTablet: boolean;      // 768px - 1023px
  isDesktop: boolean;     // >= 1024px
  isWide: boolean;        // >= 1440px
  isTouch: boolean;
  orientation: 'portrait' | 'landscape';
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1280,
        height: 800,
        isSmallMobile: false,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isWide: false,
        isTouch: false,
        orientation: 'landscape'
      };
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    return {
      width: w,
      height: h,
      isSmallMobile: w < 480,
      isMobile: w < 768,
      isTablet: w >= 768 && w < 1024,
      isDesktop: w >= 1024,
      isWide: w >= 1440,
      isTouch,
      orientation: w > h ? 'landscape' : 'portrait'
    };
  });

  useEffect(() => {
    let timeoutId: any;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        setState({
          width: w,
          height: h,
          isSmallMobile: w < 480,
          isMobile: w < 768,
          isTablet: w >= 768 && w < 1024,
          isDesktop: w >= 1024,
          isWide: w >= 1440,
          isTouch,
          orientation: w > h ? 'landscape' : 'portrait'
        });
      }, 50);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return state;
}
