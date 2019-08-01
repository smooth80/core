import { BindableProperty } from "../../core/BindableProperty";
import { AtomUI, ChildEnumerator } from "../../web/core/AtomUI";
import { AtomListBoxStyle } from "../styles/AtomListBoxStyle";
import { AtomControl } from "./AtomControl";
import { AtomItemsControl } from "./AtomItemsControl";

export class AtomListBox extends AtomItemsControl {

    public selectItemOnClick: boolean = true;

    protected preCreate(): void {
        super.preCreate();
        this.defaultControlStyle = AtomListBoxStyle;
        this.registerItemClick();
    }

    protected registerItemClick(): void {
        this.bindEvent(this.element, "click", (e) => {
            const p = this.atomParent(e.target as HTMLElement);
            if (p === this) {
                return;
            }
            if (p.element._logicalParent === this.element) {
                // this is child..
                const data = p.data;
                if (!data) {
                    return;
                }
                if (this.selectItemOnClick) {
                    this.toggleSelection(data);
                    const ce = new CustomEvent("selectionChanged", {
                        bubbles: false,
                        cancelable: false,
                        detail: data });
                    this.element.dispatchEvent(ce);
                }
            }
        });
    }

    protected createChild(df: DocumentFragment, data: any): AtomControl {
        const child = super.createChild(df, data);
        child.bind(child.element, "styleClass",
            [
                ["this", "version"],
                ["data"],
                ["this", "selectedItems"]
            ],
            false,
            (version, itemData, selectedItems: any[]) => {
                return {
                    [this.controlStyle.item.className]: true,
                    [this.controlStyle.selectedItem.className]: selectedItems
                        && selectedItems.find((x) => x === itemData)
                };
            },
            this);
        return child;
    }

}
