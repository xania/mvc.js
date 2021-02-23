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
    onResolved?: (paths: string[][]) => void;
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

            const childRoutes$ = new Rx.BehaviorSubject<string[]>([]);
            const { router, onResolved } = props;
            const subsc = router.start(executeView).subscribe({
                next([viewResults, remaining]) {
                    childRoutes$.next(remaining);

                    if (typeof onResolved !== "function") {
                        return;
                    }
                    if (Array.isArray(viewResults) && viewResults.length > 0) {
                        onResolved(viewResults.map((e) => e.url.path));
                    } else {
                        onResolved([]);
                    }
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
                        return createRouter(childRoutes$, map, this);
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
