declare module '@novnc/novnc' {
    export default class RFB {
        constructor(target: HTMLElement, url: string, options?: any);
        scaleViewport: boolean;
        resizeSession: boolean;
        clipViewport: boolean;
        showDotCursor: boolean;
        qualityLevel: number;
        compressionLevel: number;
        viewOnly: boolean;
        focus(): void;
        disconnect(): void;
        sendCtrlAltDel(): void;
        sendKey(keysym: number, code: string, down?: boolean): void;
        addEventListener(event: string, handler: (e?: any) => void): void;
        removeEventListener(event: string, handler: (e?: any) => void): void;
    }
}
