import { IDriver, disposeMany } from "glow.js";
import { flatTree, renderMany } from "glow.js/lib/tpl";
import {
    RouteInput,
    ViewContext,
    createRouter,
    Router,
    ViewResult,
    ViewResolution,
    Resolved,
} from "../router";
import "./outlet.scss";
import * as Rx from "rxjs";
import { UrlHelper } from "../router/url-helper";

interface RouterOutletProps<TView> {
    router: Router<TView>;
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

            const childRoutes$ = new Rx.Subject<string[]>();
            const { router } = props;
            const subsc = router.start(executeView).subscribe({
                next([_, remaining]) {
                    childRoutes$.next(remaining);
                },
            });
            return {
                dispose() {
                    subsc.unsubscribe();
                    classBinding.dispose();
                },
            };

            function executeView(
                resolution: Resolved<unknown>,
                url: UrlHelper
            ) {
                const { view, params } = resolution;
                const context = {
                    url,
                    params,
                    childRouter(map) {
                        return createRouter(childRoutes$, map);
                    },
                };
                const templates = flatTree([...children, view], (item) =>
                    applyChild(item, context)
                );
                const scope = driver.createScope();
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

function applyChild(child, context: ViewContext) {
    if (typeof child === "function") {
        return child(context);
    } else {
        return child;
    }
}
