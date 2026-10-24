declare module '*.css';

interface Window {
  bar?: {
    resize: (width: number, height: number, animate?: boolean) => void;
    blur: () => void;
    phase: (phase: string) => void;
    onPhase: (cb: (phase: string) => void) => void;
  };
}
