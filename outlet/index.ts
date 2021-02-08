import { IDriver, disposeMany } from "glow.js";
import { flatTree, renderMany } from "glow.js/lib/tpl";
import {
    RouteInput,
    ViewContext,
    createRouter,
    Router,
    ViewResult,
} from "../router";
import "./outlet.scss";
import * as Rx from "rxjs";
import { UrlHelper } from "../router/url-helper";
import { strings } from "@material/textfield/character-counter/constants";

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

            const notFound$ = new Rx.Subject<string[]>();
            const { router } = props;
            const subsc = router.start(executeView).subscribe();
            return {
                dispose() {
                    subsc.unsubscribe();
                    classBinding.dispose();
                },
            };

            function executeView(
                view: unknown,
                url: UrlHelper,
                params
            ): ViewResult {
                if (view) {
                    const context = {
                        url,
                        params,
                        childRouter(map) {
                            return createRouter(notFound$, map);
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
                } else {
                    notFound$.next(url.path);
                    return null;
                }
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
