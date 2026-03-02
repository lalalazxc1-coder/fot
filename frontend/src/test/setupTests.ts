import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

if (!global.TextEncoder) {
  // @ts-ignore
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  // @ts-ignore
  global.TextDecoder = TextDecoder;
}

if (!global.ResizeObserver) {
  // @ts-ignore
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
