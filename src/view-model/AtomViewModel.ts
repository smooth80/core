import { App, AtomAction } from "../App";
import { Atom } from "../Atom";
import { AtomBinder } from "../core/AtomBinder";
import { AtomDisposableList } from "../core/AtomDisposableList";
import { AtomOnce } from "../core/AtomOnce";
import { AtomUri } from "../core/AtomUri";
import { AtomWatcher } from "../core/AtomWatcher";
import { BindableProperty } from "../core/BindableProperty";
import { IValueConverter } from "../core/IValueConverter";
import { PropertyBinding } from "../core/PropertyBinding";
import { ArrayHelper, IClassOf, IDisposable } from "../core/types";
import { Inject } from "../di/Inject";

/**
 *
 *
 * @export
 * @class AtomViewModel
 * @extends {AtomModel}
 */
export class AtomViewModel {

    // tslint:disable-next-line:ban-types
    public postInit: Function[];

    private disposables: IDisposable[];

    private validations: Array<{ name: string, initialized: boolean, watcher: AtomWatcher<AtomViewModel>}> = [];

    private pendingInits: Array<() => void> = [];

    public get isReady(): boolean {
        return this.pendingInits === null;
    }

    public get errors(): Array<{ name: string, error: string}> {
        const e: Array<{ name: string, error: string}> = [];
        if (!this.mShouldValidate) {
            return e;
        }
        for (const v of this.validations) {
            if (!v.initialized) {
                return e;
            }
            const error = this [v.name];
            if (error) {
                e.push( { name: v.name, error});
            }
        }
        return e;
    }

    private mChildren: AtomViewModel[];
    private mParent: AtomViewModel;
    private mShouldValidate: boolean = false;
    public get parent(): AtomViewModel {
        return this.mParent;
    }
    public set parent(v: AtomViewModel) {
        if (this.mParent && this.mParent.mChildren) {
            this.mParent.mChildren.remove(this);
        }
        this.mParent = v;
        if (v) {
            const c = v.mChildren || (v.mChildren = []);
            c.add(this);
            this.registerDisposable({
                dispose: () => {
                    c.remove(this);
                }
            });
        }
    }

    public get isValid(): boolean {
        let valid = true;
        this.mShouldValidate = true;
        for (const v of this.validations) {
            if (!v.initialized) {
                v.watcher.evaluate(true);
                v.initialized = true;
            }
            if (this[v.name]) {
                valid = false;
            }
        }
        if (this.mChildren) {
            for (const child of this.mChildren) {
                if (!child.isValid) {
                    valid = false;
                }
            }
        }
        AtomBinder.refreshValue(this, "errors");
        return valid;
    }

    constructor(@Inject public readonly app: App) {
        this.app.runAsync(() => this.privateInit());
    }

    /**
     * Resets validations and all errors are removed.
     * @param resetChildren reset child view models as well. Default is true.
     */
    public resetValidations(resetChildren: boolean = true): void {
        this.mShouldValidate = false;
        for (const v of this.validations) {
            this.refresh(v.name);
        }
        if (resetChildren && this.mChildren) {
            for (const iterator of this.mChildren) {
                iterator.resetValidations(resetChildren);
            }
        }
    }

    /**
     * Runs function after initialization is complete.
     * @param f function to execute
     */
    public runAfterInit(f: () => void): void {
        if (this.pendingInits) {
            this.pendingInits.push(f);
            return;
        }
        f();
    }

    /**
     * Resolves given class via app
     * @param c class to resolve
     * @param onlyRegistered resolve only registered types
     */
    public resolve<T>(c: IClassOf<T>, onlyRegistered?: boolean): T {
        const create = !onlyRegistered;
        return this.app.resolve(c, create);
    }

    /**
     * Binds source property to target property with optional two ways
     * @param target target whose property will be set
     * @param propertyName name of target property
     * @param source source to read property from
     * @param path property path of source
     * @param twoWays optional, two ways IValueConverter
     */
    public bind(
        target: any,
        propertyName: string,
        source: any,
        path: string[][],
        twoWays?: IValueConverter | ((v: any) => any) ): IDisposable {
        const pb = new PropertyBinding(
            target,
            null,
            propertyName,
            path,
            (twoWays && typeof twoWays !== "function") ? true : false , twoWays, source);
        return this.registerDisposable(pb);
    }

    /**
     * Refreshes bindings associated with given property name
     * @param name name of property
     */
    public refresh(name: string): void {
        AtomBinder.refreshValue(this, name);
    }

    /**
     * Useful only for Unit testing, this function will await till initialization is
     * complete and all pending functions are executed
     */
    public async waitForReady(): Promise<any> {
        while (this.pendingInits) {
            await Atom.delay(100);
        }
    }

    /**
     * Put your asynchronous initialization here
     *
     * @returns {Promise<any>}
     * @memberof AtomViewModel
     */
    // tslint:disable-next-line:no-empty
    public async init(): Promise<any> {
    }

    /**
     * dispose method will be called when attached view will be disposed or
     * when a new view model will be assigned to view, old view model will be disposed.
     *
     * @memberof AtomViewModel
     */
    public dispose(): void {
        if (this.disposables) {
            for (const d of this.disposables) {
                d.dispose();
            }
            this.disposables.length = 0;
        }
    }

    // /**
    //  * Internal method, do not use, instead use errors.hasErrors()
    //  *
    //  * @memberof AtomViewModel
    //  */
    // public runValidation(): void {
    //     for (const v of this.validations) {
    //         v.watcher.evaluate(true);
    //     }
    // }

    /**
     * Register a disposable to be disposed when view model will be disposed.
     *
     * @protected
     * @param {IDisposable} d
     * @memberof AtomViewModel
     */
    public registerDisposable(d: IDisposable): IDisposable {
        this.disposables = this.disposables || [];
        this.disposables.push(d);
        return {
            dispose: () => {
                ArrayHelper.remove(this.disposables, (f) => f === d);
                d.dispose();
            }
        };
    }
    /**
     * Broadcast given data to channel (msg)
     *
     * @param {string} msg
     * @param {*} data
     * @memberof AtomViewModel
     */
    public broadcast(msg: string, data: any): void {
        this.app.broadcast(msg, data);
    }

    public bindUrlParameter(name: string, urlParameter: string): IDisposable {
        if (!name) {
            return;
        }
        if (!urlParameter) {
            return;
        }
        const a = this as any;
        const paramDisposables = (a.mUrlParameters || (a.mUrlParameters = {}));
        const old = paramDisposables[name];
        if (old) {
            old.dispose();
            paramDisposables[name] = null;
        }
        const disposables = new AtomDisposableList();
        const updater = new AtomOnce();
        disposables.add(this.setupWatch(
            [
                ["app", "url", "hash", urlParameter],
                ["app", "url", "query", urlParameter]
            ], (hash, query) => {
            updater.run(() => {
                const value = hash || query;
                if (value) {
                    // tslint:disable-next-line:triple-equals
                    if (value != this[name]) {
                        this[name] = value;
                    }
                }
            });
        }));
        disposables.add(this.setupWatch([[name]], (value) => {
            updater.run(() => {
                const url = this.app.url || (this.app.url = new AtomUri(""));
                url.hash[urlParameter] = value;
                this.app.syncUrl();
            });
        }));
        paramDisposables[name] = disposables;
        return disposables;
    }

    // tslint:disable-next-line:no-empty
    protected onReady(): void {}

    protected subscribe(channel: string, c: (ch: string, data: any) => void): IDisposable {
        const sub: IDisposable = this.app.subscribe(channel, c);
        return this.registerDisposable(sub);
    }

    /**
     * Execute given expression whenever any bindable expression changes
     * in the expression.
     *
     * For correct generic type resolution, target must always be `this`.
     *
     *      this.setupWatch(() => {
     *          if(!this.data.fullName){
     *              this.data.fullName = `${this.data.firstName} ${this.data.lastName}`;
     *          }
     *      });
     *
     * @protected
     * @template T
     * @param {() => any} ft
     * @returns {IDisposable}
     * @memberof AtomViewModel
     */
    protected setupWatch(
        ft: string[][] | (() => any),
        proxy?: (...v: any[]) => void,
        forValidation?: boolean,
        name?: string): IDisposable {

        const d: AtomWatcher<any> = new AtomWatcher<any>(
            this, ft, !forValidation && this.isReady, forValidation, proxy );

        if (!forValidation) {
            if (proxy) {
                const op = proxy as () => any;
                proxy = () => this.app.runAsync( () => op() );
            }
            this.runAfterInit(() => d.runEvaluate());
        } else {
            this.validations = this.validations || [];
            this.validations.push({ name, watcher: d, initialized: false});
        }
        return this.registerDisposable(d);
    }

    // tslint:disable-next-line:no-empty
    protected onPropertyChanged(name: string): void {}

    private async privateInit(): Promise<any> {
        try {
            await Atom.postAsync(this.app, async () => {
                this.runDecoratorInits();
                // this.registerWatchers();
            });
            await Atom.postAsync(this.app, async () => {
                await this.init();
                this.onReady();
            });

            if (this.postInit) {
                for (const i of this.postInit) {
                    i();
                }
                this.postInit = null;
            }
        } finally {
            const pi = this.pendingInits;
            this.pendingInits = null;
            for (const iterator of pi) {
                iterator();
            }
        }
    }

    private runDecoratorInits(): void {
        const v: any = this.constructor.prototype;
        if (!v) {
            return;
        }
        const ris: Array<(a: any, b: any) => void> = v._$_inits;
        if (ris) {
            for (const ri of ris) {
                ri.call(this, this);
            }
        }
    }

}

interface IAtomViewModel {
    setupWatch(ft: () => any, proxy?: () => any, forValidation?: boolean, name?: string): IDisposable ;
    subscribe(channel: string, c: (ch: string, data: any) => void): void;
}

type viewModelInit = (vm: AtomViewModel) => void;

export type viewModelInitFunc = (target: AtomViewModel, key: string | symbol) => void;

function registerInit(target: AtomViewModel, fx: viewModelInit ): void {
    const t: any = target as any;
    const inits: viewModelInit[] = t._$_inits = t._$_inits || [];
    inits.push(fx);
}

/**
 * Receive messages for given channel
 * @param {(string | RegExp)} channel
 * @returns {Function}
 */
export function Receive(...channel: string[]): viewModelInitFunc {
    return (target: AtomViewModel, key: string | symbol): void => {
        registerInit(target, (vm) => {
            // tslint:disable-next-line:ban-types
            const fx: Function = (vm as any)[key];
            const a: AtomAction = (ch: string, d: any): void => {
                fx.call(vm, ch, d );
            };
            const ivm = (vm as any) as IAtomViewModel;
            for (const c of channel) {
                ivm.subscribe(c, a);
            }
        });
    };
}

export function BindableReceive(...channel: string[]): viewModelInitFunc {
    return (target: AtomViewModel, key: string | symbol): void => {
        const bp: any = BindableProperty(target, key as string);

        registerInit(target, (vm) => {
            const fx: AtomAction = (cx: string, m: any) => {
                vm[key] = m;
            };
            const ivm = (vm as any) as IAtomViewModel;
            for (const c of channel) {
                ivm.subscribe(c, fx);
            }
        });

        return bp;
    };
}

export function BindableBroadcast(...channel: string[]): viewModelInitFunc {
    return (target: AtomViewModel, key: string | string): void => {
        const bp: any = BindableProperty(target, key as string);

        registerInit(target, (vm) => {
            const fx: (t: any) => any = (t: any): any => {
                const v: any = vm[key];
                for (const c of channel) {
                    vm.broadcast(c, v);
                }
            };
            const d: AtomWatcher<any> = new AtomWatcher<any>(vm, [key.split(".")], false );
            d.func = fx;

            for (const p of d.path) {
                d.evaluatePath(vm, p);
            }

            vm.registerDisposable(d);
        });

        return bp;
    };

}

export function Watch(target: AtomViewModel, key: string | symbol, descriptor: any): void {

    registerInit(target, (vm) => {

        const ivm = (vm as any) as IAtomViewModel;
        if (descriptor && descriptor.get) {
            ivm.setupWatch(descriptor.get, () => {
                vm.refresh(key.toString());
            });
            return;
        }

        ivm.setupWatch(vm[key]);
    });
}

export function Validate(target: AtomViewModel, key: string | symbol, descriptor: any): void {

    // tslint:disable-next-line:ban-types
    const getMethod = descriptor.get as (() => any);

    // // trick is to change property descriptor...
    // delete target[key];

    descriptor.get = () => null;

    // // replace it with dummy descriptor...
    // Object.defineProperty(target, key, descriptor);

    registerInit(target, (vm) => {
        const initialized = { i: false };
        const ivm = (vm as any) as IAtomViewModel;

        Object.defineProperty(ivm, key, {
            enumerable: true,
            configurable: true,
            get() {
                if ((vm as any).mShouldValidate && initialized.i) {
                    return getMethod.apply(this);
                }
                return null;
            }
        });

        ivm.setupWatch(getMethod, () => {
            // descriptor.get = getMethod;

            // Object.defineProperty(target, key, descriptor);
            initialized.i = true;
            vm.refresh(key.toString());
        }, true, key.toString());
        return;
    });

}

export function BindableUrlParameter(name: string): any {
    return (target: AtomViewModel, key: string | string, descriptor: PropertyDecorator): void => {
        registerInit(target, (vm) => {
            vm.bindUrlParameter(key, name);
        } );
        return BindableProperty(target, key);
    };
}
