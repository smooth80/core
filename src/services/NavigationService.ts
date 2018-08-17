import { INameValuePairs, Mock } from "../core/types";

export interface ILocation {
    href?: string;
    hash?: string;
    host?: string;
    hostName?: string;
    port?: string;
    protocol?: string;
}

export abstract class NavigationService {
    public abstract alert(message: string, title?: string): Promise<any>;
    public abstract confirm(message: string, title?: string): Promise<boolean>;
    public abstract openPage<T>(pageName: string, p?: INameValuePairs): Promise<T>;

    public abstract get title(): string;
    public abstract set title(v: string);

    public abstract get location(): ILocation;

    public abstract navigate(url: string): void;

    public abstract back(): void;
}

// Do not mock Navigation unless you want it in design time..
// Mock.mock(NavigationService, "MockNavigationService");
