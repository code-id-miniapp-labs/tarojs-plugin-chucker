export declare function patchPageAndComponent(navigateUrl?: string): void;
export interface InterceptorOptions {
    /** Patch console.log / warn / error / info to capture logs. @default false */
    console?: boolean;
}
export declare function initInterceptors(options?: InterceptorOptions): void;
