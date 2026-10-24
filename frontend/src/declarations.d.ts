declare module '*.css';

interface Window {
  bar: {
    resize: (width: number, height: number) => void;
    blur: () => void;
    phase: (phase: string) => void;
    onPhase: (cb: (phase: string) => void) => void;
  };
}
