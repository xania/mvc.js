import { Router, RouteEntry, ActionResult, Activation, pathCompare } from "./router.js"
import { Route } from "./action.js"
import * as Rx from "rxjs";
import * as Ro from "rxjs/operators";

// export const __hot = true;

function browserRoutes(basepath: Route): Rx.Observable<Route> {
    return Rx.timer(0, 50).pipe(
        Ro.map(() => location.pathname),
        Ro.distinctUntilChanged(),
        Ro.map((pathname: string) => pathname.split("/").filter(x => !!x)),
        Ro.filter(route => startsWith(route, basepath)),
        Ro.map(route => route.slice(basepath.length)),
        Ro.tap(console.log)
    );
}

export class BrowserRouter extends Router {
    constructor(public basepath: Route = []) {
        super(browserRoutes(basepath));
    }

    addClickListener(selectors) {
        let router = this;
        let subject = new Rx.Subject();

        if (typeof selectors === "string") {
            document.querySelector(selectors).addEventListener("click", routerClick);
        } else {
            selectors.addEventListener("click", routerClick);
        }

        return subject;

        function routerClick(event) {
            if (event.target) {
                let anchor: HTMLAnchorElement = event.target.closest("a");

                if (anchor && anchor.classList.contains("router-link")) {
                    event.preventDefault();
                    const href = anchor.getAttribute("href")

                    if (href && anchor['pathname'] && location.host === anchor["host"]) {
                        const pathname = anchor['pathname'];
                        pushPath(router.basepath.map(e => "/" + e).join() + pathname);
                        router.push(pathname);
                        subject.next(pathname);

                        event.returnValue = false;
                        return false;
                    }
                }
            }
        }
    }

    activate(actionResult: ActionResult, route: Route): Activation {
        pushPath("/" + this.basepath.concat(route).join("/"));
        return super.activate(actionResult, route);
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