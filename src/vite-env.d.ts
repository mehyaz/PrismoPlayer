/// <reference types="vite/client" />

interface Window {
    ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
        on(channel: string, func: (...args: any[]) => void): () => void;
        removeAllListeners(channel: string): void;
        send(channel: string, ...args: any[]): void;
    };
}
