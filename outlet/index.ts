import { IDriver, disposeMany } from "glow.js";
import { flatTree, renderMany } from "glow.js/lib/tpl";
import { RouteInput, ViewContext, createRouter } from "../router";
import "./outlet.scss";

interface RouterOutletProps<TView> {
    routes: RouteInput<TView>[];
}

export function RouterOutlet<TView>(
    props: RouterOutletProps<TView>,
    children: any[]
) {
    return {
        render(driver: IDriver) {
            const classBinding = driver.createAttribute("class", [
                "router-outlet-container",
            ]);

            const router = createRouter(props.routes);
            const subsc = router.start(executeView).subscribe();
            return {
                dispose() {
                    subsc.unsubscribe();
                    classBinding.dispose();
                },
            };

            function executeView(view: unknown, context: ViewContext) {
                if (view) {
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
                } else {
                    return null;
                }
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
