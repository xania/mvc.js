import { Router, ActionResult, Activation, pathCompare, IViewEngine } from "./router"
import { Route } from "./action"
import * as Rx from "rxjs";
import * as Ro from "rxjs/operators";

// export const __hot = true;

function browserRoutes(basepath: Route): Rx.Observable<Route> {
    return Rx.timer(0, 50).pipe(
        Ro.map(() => location.pathname),
        Ro.distinctUntilChanged(),
        Ro.map((pathname: string) => pathname.split("/").filter(x => !!x)),
        Ro.filter(route => startsWith(route, basepath))
    );
}

export class BrowserRouter extends Router {
    constructor(basepath: Route = []) {
        super(browserRoutes(basepath), basepath);
    }

    attach(dom) {
        return this.addClickListener(dom);
    }

    addClickListener(selectors: string | HTMLElement) {
        let router = this;

        const target = typeof selectors === "string"
            ? document.querySelector(selectors)
            : selectors
            ;
        target.addEventListener("click", routerClick);
        return {
            dispose() {
                target.removeEventListener("click", routerClick);
            }
        }

        function routerClick(event) {
            if (event.target) {
                let anchor: HTMLAnchorElement = event.target.closest("a");

                if (anchor && anchor.classList.contains("router-link")) {
                    event.preventDefault();
                    const href = anchor.getAttribute("href")

                    if (href && anchor['pathname'] && location.host === anchor["host"]) {
                        const pathname = anchor['pathname'];
                        pushPath(pathname);
                        router.execute(pathname);
                        // subject.next(pathname);

                        event.returnValue = false;
                        return false;
                    }
                }
            }
        }
    }

    start<TAction, TActionResult extends ActionResult>(
        viewEngine: IViewEngine<TAction, TActionResult>
    ): Rx.Observable<Activation> {
        return super.start(viewEngine).pipe(
            Ro.tap(a => {
                pushPath("/" + a.route.join("/"));
            })
        )
    }
}

function pushPath(pathname: string) {
    let { pathname: old } = window.location;

    if ((old + "/") === pathname) {
        console.log("replaceState", pathname);
        window.history.replaceState(null, null, pathname);
    }
    else if (old !== pathname) {
        window.history.pushState(null, null, pathname);
    } else {
        // console.error("same as ", pathname);
    }
}

function startsWith(route: Route, base: Route) {
    if (base.length === 0)
        return true;

    if (base.length > route.length)
        return false;

    for (var i = 0; i < base.length; i++) {
        if (pathCompare(base[i], route[i]) === false)
            return false;
    }

    return true;
}
