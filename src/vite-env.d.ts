/// <reference types="vite/client" />

interface Window {
    ipcRenderer: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
        on(channel: string, func: (...args: unknown[]) => void): () => void;
        removeAllListeners(channel: string): void;
        send(channel: string, ...args: unknown[]): void;
    };
}
