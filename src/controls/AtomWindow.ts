import { AtomDevice } from "../core/AtomDevice";
import { bindableProperty } from "../core/bindable-properties";
import { IClassOf } from "../core/types";
import { ServiceProvider } from "../di/ServiceProvider";
import { AtomStyle } from "../styles/AtomStyle";
import { AtomTheme, AtomWindowStyle } from "../Theme";
import { AtomControl, IAtomControlElement } from "./AtomControl";
import { AtomTemplate } from "./AtomTemplate";
export class AtomWindowFrameTemplate extends AtomTemplate {

    public commandPresenter: HTMLElement;

    protected create(): void {

        const style = this.resolve(AtomTheme).window;

        this.element = document.createElement("div");
        this.element.classList.add(style.frame.className);
        this.bind(this.element, "styleWidth", [["templateParent", "width"]]);
        this.bind(this.element, "styleHeight", [["templateParent", "height"]]);
        // add title host

        const titleHost = document.createElement("div");
        titleHost.classList.add(style.titleHost.className);

        // add title

        const title = document.createElement("span");
        title.classList.add(style.title.className);
        this.bind(title, "text", [["templateParent", "title"]], false);

        // add close button
        const closeButton = document.createElement("button");
        closeButton.classList.add(style.closeButton.className);

        this.bindEvent(closeButton, "click", (e) => {
            const w = this.templateParent as AtomWindow;
            w.close();
        });

        // append title host > title

        titleHost.appendChild(title);
        titleHost.appendChild(closeButton);
        this.element.appendChild(titleHost);

        // add content presneter
        const cp = document.createElement("div");
        cp.classList.add(style.content.className);
        this.contentPresenter = cp;
        this.element.appendChild(cp);

        // create command presenter
        const cdp = document.createElement("div");
        cdp.classList.add(style.commandBar.className);
        this.commandPresenter = cdp;
        this.element.appendChild(cdp);

    }

}

export class AtomWindow extends AtomControl {

    @bindableProperty
    public title: string = "";

    @bindableProperty
    public width: string = "300px";

    @bindableProperty
    public height: string = "200px";

    @bindableProperty
    public windowTemplate: IClassOf<AtomControl>;

    @bindableProperty
    public commandTemplate: IClassOf<AtomControl>;

    @bindableProperty
    public frameTemplate: IClassOf<AtomWindowFrameTemplate> = AtomWindowFrameTemplate;

    @bindableProperty
    public style: AtomWindowStyle;

    constructor(e?: HTMLElement) {
        super(e);
        this.element.classList.add("atom-window");
        this.style = this.resolve(AtomTheme).window;
    }

    public onPropertyChanged(name: string): void {
        switch (name) {
            case "windowTemplate":
            case "commandTemplate":
            case "frameTemplate":
                this.invalidate();
                break;
        }
    }

    public close(): void {
        const message = `atom-window-cancel:${this.element.id}`;
        const device = ServiceProvider.global.get(AtomDevice);
        device.broadcast(message, "canceled");
    }

    public onUpdateUI(): void {
        if (!(this.windowTemplate && this.frameTemplate)) {
            return;
        }

        // let us create frame first...
        const frame = new (this.frameTemplate)();
        const fe = frame.element as IAtomControlElement;

        this.element.classList.add(this.style.frameHost.className);

        fe._logicalParent = this.element as IAtomControlElement;
        fe._templateParent = this;

        if (!frame.contentPresenter) {
            throw new Error("ContentPresenter must be set inside frameTemplate before creating window");
        }

        const content = new (this.windowTemplate)();
        (content.element as IAtomControlElement)._templateParent = this;
        frame.contentPresenter.appendChild(content.element);

        if (this.commandTemplate) {
            if (!frame.commandPresenter) {
                throw new Error("CommandPresenter must be set inside frameTemplate" +
                    "before creating window if command template is present");
            }
            const command = new (this.commandTemplate)();
            (command.element as IAtomControlElement)._templateParent = this;
            frame.commandPresenter.appendChild(command.element);
        }
        this.append(frame);
    }

}
