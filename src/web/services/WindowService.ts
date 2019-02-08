import { App } from "../../App";
import { Atom } from "../../Atom";
import { AtomLoader } from "../../core/AtomLoader";
import { AtomUri } from "../../core/AtomUri";
import { IScreen, IScreenType } from "../../core/IScreen";
import { ArrayHelper, IClassOf, IDisposable, INameValuePairs } from "../../core/types";
import { Inject } from "../../di/Inject";
import { RegisterSingleton } from "../../di/RegisterSingleton";
import { Scope, ServiceCollection } from "../../di/ServiceCollection";
import { JsonService } from "../../services/JsonService";
import { NavigationService } from "../../services/NavigationService";
import ReferenceService, { ObjectReference } from "../../services/ReferenceService";
import { AtomWindowViewModel } from "../../view-model/AtomWindowViewModel";
import { AtomUI } from "../../web/core/AtomUI";
import AtomAlertWindow from "../controls/AtomAlertWindow";
import { AtomControl, IAtomControlElement } from "../controls/AtomControl";
import { AtomWindow } from "../controls/AtomWindow";
import { AtomStyleSheet } from "../styles/AtomStyleSheet";
import { AtomTheme } from "../styles/AtomTheme";
import { cssNumberToString } from "../styles/StyleBuilder";

export type HostForElementFunc = ((e: HTMLElement) => HTMLElement);

@RegisterSingleton
export class WindowService extends NavigationService {

    /**
     * This is just to preload Alert window.
     */
    public static alertWindow = AtomAlertWindow;

    public readonly screen: IScreen;

    public currentTarget: HTMLElement = null;

    private popups: AtomControl[] = [];

    private hostForElementFunc: HostForElementFunc[] = [];

    private lastPopupID: number = 0;

    /**
     * Get current window title
     *
     * @type {string}
     * @memberof BrowserService
     */
    get title(): string {
        return window.document.title;
    }

    /**
     * Set current window title
     * @memberof BrowserService
     */
    set title(v: string) {
        window.document.title = v;
    }

    /**
     * Gets current location of browser, this does not return
     * actual location but it returns values of browser location.
     * This is done to provide mocking behavior for unit testing.
     *
     * @readonly
     * @type {AtomLocation}
     * @memberof BrowserService
     */
    public get location(): AtomUri {
        return new AtomUri(location.href);
    }

    public set location(v: AtomUri) {
        location.href = v.toString();
    }

    constructor(@Inject private app: App, @Inject private jsonService: JsonService) {
        super();

        this.screen = app.screen;

        let st: IScreenType = "desktop";

        if (/mobile|android|ios/i.test(window.navigator.userAgent)) {
            st = "mobile";
            if (/tablet/i.test(window.navigator.userAgent)) {
                st = "tablet";
            }
        }

        this.screen.screenType = st;

        if (window) {
            window.addEventListener("click", (e) => {
                this.currentTarget = e.target as HTMLElement;
                this.closePopup();
            });

            const update = (e) => {
                this.refreshScreen();
            };

            window.addEventListener("resize", update);
            window.addEventListener("scroll", update);
            document.body.addEventListener("scroll", update);
            document.body.addEventListener("resize", update);

            setTimeout(() => {
                update(null);
            }, 1000);

        }
    }

    public registerHostForWindow(f: HostForElementFunc): IDisposable {
        this.hostForElementFunc.push(f);
        return {
            dispose: () => {
                this.hostForElementFunc.remove(f);
            }
        };
    }

    /**
     * Navigate current browser to given url.
     * @param {string} url
     * @memberof BrowserService
     */
    public navigate(url: string): void {
        location.href = url;
    }

    public back(): void {
        window.history.back();
    }

    public register(id: string, type: IClassOf<AtomControl>): void {
        ServiceCollection.instance.register(type, null, Scope.Transient, id);
    }

    public confirm(message: string, title: string): Promise<any> {
        return this.openPage("web-atoms-core/dist/{platform}/controls/AtomAlertWindow", {
            okTitle: "Yes",
            cancelTitle: "No",
            title,
            message
        });
    }

    public alert(message: string | any, title?: string): Promise<any> {
        if (typeof message !== "string") {
            message = message.toString();
        }
        return this.openPage("web-atoms-core/dist/{platform}/controls/AtomAlertWindow", {
            message,
            title,
            okTitle: "Ok",
            cancelTitle: ""
        }).catch(() => {
            // do nothing...
        });
    }

    public openPage<T>(pageName: string, p?: INameValuePairs): Promise<T> {
        return this.openPopupAsync(pageName, p, true);
    }

    public closePopup(): void {
        if (!this.popups.length) {
            return;
        }
        const peek = this.popups[this.popups.length - 1];
        const element = peek.element;
        let target = this.currentTarget;

        const theme = this.app.get(AtomTheme).popup;

        while (target) {
            if (target === element) {
                // do not close this popup....
                return;
            }
            target = target.parentElement;
        }

        const message = `atom-window-cancel:${peek.element.id}`;
        const device = this.app.get(App);
        device.broadcast(message, "cancelled");
    }

    public refresh(): void {
        location.reload(true);
    }

    public getHostForElement(): HTMLElement {
        const ce = this.currentTarget;
        if (!ce) {
            return null;
        }
        for (const iterator of this.hostForElementFunc) {
            const e = iterator(ce);
            if (e) {
                return e;
            }
        }
        return null;
    }

    public refreshScreen() {
        const height = this.screen.height = window.innerHeight || document.body.clientHeight;
        const width = this.screen.width = window.innerWidth || document.body.clientWidth;
        this.screen.scrollLeft = window.scrollX || document.body.scrollLeft || 0;
        this.screen.scrollTop = window.scrollY || document.body.scrollTop || 0;
        this.screen.orientation = width > height ? "landscape" : "portrait";
    }

    protected registerForPopup(): void {

        if (window) {
            window.addEventListener("click", (e) => {
                this.currentTarget = e.target as HTMLElement;
                this.closePopup();
            });
        }
    }

    private async openPopupAsync<T>(windowId: string, p: INameValuePairs, isPopup: boolean): Promise<T> {

        const  url = new AtomUri(windowId);

        if (p) {
            for (const key in p) {
                if (p.hasOwnProperty(key)) {
                    const element = p[key];
                    if (element === undefined) {
                        continue;
                    }
                    if (element === null) {
                        url.query["json:" + key] = "null";
                        continue;
                    }
                    if (key.startsWith("ref:")) {
                        const r = element instanceof ObjectReference ?
                            element :
                            (this.app.resolve(ReferenceService) as ReferenceService).put(element);
                        url.query[key] = r.key;
                        continue;
                    }
                    if (typeof element !== "string" &&
                        (typeof element === "object" || Array.isArray(element))) {
                        url.query["json:" + key] = JSON.stringify(element);
                    } else {
                        url.query[key] = element;
                    }
                }
            }
        }

        if (url.protocol && /^tab\:$/i.test(url.protocol)) {
            this.app.broadcast(url.host, url.toString());
            return;
        }

        // const popup = this.app.resolve(windowId, true) as AtomControl;
        // const popupType = await UMD.resolveViewClassAsync(url.path);
        const popup = await AtomLoader.loadView<AtomControl>(url, this.app);
        const e = popup.element;

        if (popup instanceof AtomWindow) {
            isPopup = false;
        }

        // if (isPopup) {
        await Atom.delay(10);
        // }

        return await new Promise<T>((resolve, reject) => {

            const theme = this.app.get(AtomStyleSheet).popup;

            e.id = `atom_popup_${this.lastPopupID++}`;
            e.style.zIndex = 10000 + this.lastPopupID + "";

            const disposables: IDisposable[] = [popup];

            e._logicalParent = this.currentTarget;

            if (isPopup) {

                const sr = AtomUI.screenOffset(this.currentTarget);

                const x = sr.x;
                const y = sr.y;
                const h = sr.height;
                e.style.position = "absolute";
                e.style.left = x + "px";
                e.style.top = (y + h) + "px";
                e.classList.add(theme.host.className);
                this.popups.push(popup);
                document.body.appendChild(e);
            } else {

                const eHost = this.getHostForElement();
                if (eHost) {
                    eHost.appendChild(e);
                } else {
                    const host = document.createElement("div");
                    document.body.appendChild(host);
                    host.style.position = "absolute";
                    host.appendChild(e);
                    disposables.push({
                        dispose() {
                            host.remove();
                        }
                    });
                    this.refreshScreen();
                    popup.bind(host, "styleLeft", [["this", "scrollLeft"]], false, cssNumberToString, this.screen);
                    popup.bind(host, "styleTop", [["this", "scrollTop"]], false, cssNumberToString, this.screen);
                    popup.bind(host, "styleWidth", [["this", "width"]], false, cssNumberToString, this.screen);
                    popup.bind(host, "styleHeight", [["this", "height"]], false, cssNumberToString, this.screen);
                }
            }

            this.currentTarget = e;

            const closeFunction = () => {
                for (const iterator of disposables) {
                    iterator.dispose();
                }
                e.remove();
                ArrayHelper.remove(this.popups, (a) => a === popup);
            };

            const wvm = popup.viewModel;
            popup.bindEvent(document.body, "keyup", (keyboardEvent: KeyboardEvent) => {
                if (keyboardEvent.key === "Escape") {
                    if (isPopup) {
                        closeFunction();
                    } else {
                        // check if cancel is supported
                        if (wvm.cancel) {
                            this.app.runAsync(() => wvm.cancel());
                        } else {
                            closeFunction();
                        }
                    }
                }
            });

            const device = this.app.get(App);

            disposables.push(device.subscribe(`atom-window-close:${e.id}`, (g, i) => {
                closeFunction();
                resolve(i);
            }));

            disposables.push(device.subscribe(`atom-window-cancel:${e.id}`, (g, i) => {
                closeFunction();
                reject(i || "cancelled");
            }));

            if (wvm) {
                wvm.windowName = e.id;

                // for (const key in url.query) {
                //     if (url.query.hasOwnProperty(key)) {
                //         const element = url.query[key];
                //         if (typeof element === "object") {
                //             wvm[key] = this.jsonService.parse(this.jsonService.stringify(element));
                //         } else {
                //             wvm[key] = element;
                //         }
                //     }
                // }
            }

        });
    }

}
