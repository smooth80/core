import { BindableProperty } from "../../core/BindableProperty";
import { ModuleFiles } from "../../ModuleFiles";
import { AtomStyle } from "./AtomStyle";
import { AtomStyleClass, StyleClass } from "./AtomStyleClass";
import { AtomTheme } from "./AtomTheme";
import { IStyleDeclaration } from "./IStyleDeclaration";

export class AtomTabbedPageStyle extends AtomStyle {

    @BindableProperty
    public padding: number;

    public get theme(): AtomTheme {
        return this.styleSheet as AtomTheme;
    }

    @StyleClass("tab-item")
    public get tabItem(): IStyleDeclaration {
        return {
            display: "inline-block",
            borderTopLeftRadius: (this.padding || this.theme.padding) + "px",
            borderTopRightRadius: (this.padding || this.theme.padding) + "px",
            marginLeft: "2px",
            padding: 0,
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: "lightgray",
            backgroundColor: this.theme.bgColor,
            minWidth: "90px",
            minHeight: "30px",
            cursor: "default",
            position: "relative",
            subclasses: {
                ":hover": {
                    backgroundColor: this.theme.hoverColor
                },
                "> div": {
                    display: "inline-block",
                    padding: (this.padding || this.theme.padding) + "px",
                    paddingRight: ((this.padding || this.theme.padding) + 23) + "px",
                    right: "22px"
                }
            }
        };
    }

    @StyleClass("selected-tab-item")
    public get selectedTabItem(): IStyleDeclaration {
        return this.clone(this.tabItem, {
            borderColor: this.theme.activeColor,
            backgroundColor: this.theme.selectedBgColor,
            color: this.theme.selectedColor,
            subclasses: {
                ":hover": {
                    backgroundColor: this.theme.selectedBgColor,
                    color: this.theme.hoverColor
                },
                "> div": {
                    display: "inline-block",
                    padding: (this.padding || this.theme.padding) + "px",
                    paddingRight: ((this.padding || this.theme.padding) + 23) + "px",
                    right: "22px"
                }
            }
        });
    }

    @StyleClass("close-button")
    public get closeButton(): IStyleDeclaration {
        return {
            position: "absolute",
            right: "5px",
            top: "5px",
            width: "0",
            height: "0",
            padding: "8px",
            backgroundImage: `url(${ModuleFiles.src.web.images.closeButton_svg})`,
            subclasses: {
                ":hover": {
                    backgroundImage: `url(${ModuleFiles.src.web.images.closeButtonHover_svg})`
                }
            }
        };
    }

}
