import { IDriver, disposeMany } from "glow.js";
import { flatTree, renderMany } from "glow.js/lib/tpl";
import { Router, ViewContext } from "./index";

interface RouterOutletProps {
    router: Router<unknown>;
}

export function RouterOutlet(props: RouterOutletProps, children: any[]) {
    return {
        render(driver: IDriver) {
            const classBinding = driver.createAttribute("class", [
                "router-outlet-container",
            ]);

            const subsc = props.router.start(executeView).subscribe();
            return {
                dispose() {
                    subsc.unsubscribe();
                    classBinding.dispose();
                },
            };

            function executeView(view: unknown, context: ViewContext) {
                const templates = flatTree(children.slice(0), (item) =>
                    applyChild(item, view, context)
                );
                const scope = driver.createScope(0);
                const bindings = renderMany(scope, templates);
                return {
                    dispose() {
                        disposeMany(bindings);
                        scope.dispose();
                    },
                };
            }
        },
    };
}

function applyChild(child, template, context: ViewContext) {
    if (typeof child === "function") {
        return child(template, context);
    } else {
        return child;
    }
}
