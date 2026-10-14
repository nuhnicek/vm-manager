declare module '@novnc/novnc' {
    export default class RFB {
        constructor(target: HTMLElement, url: string, options?: any);
        scaleViewport: boolean;
        resizeSession: boolean;
        clipViewport: boolean;
        focus(): void;
        disconnect(): void;
        addEventListener(event: string, handler: (e?: any) => void): void;
        removeEventListener(event: string, handler: (e?: any) => void): void;
    }
}
