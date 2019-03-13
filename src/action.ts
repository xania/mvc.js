import * as Rx from "rxjs";
import UrlHelper from "./url-helper";

export type Route = any[];
export type ActionResolution<TAction> = {
    action: TAction,
    appliedRoute: Route,
    remainingRoute: Route,
    params: { [key: string]: any }
};
export type ActionResolverInput<TAction> = { [route: string]: TAction } | ActionResolver<TAction>;


export class ActionMap<TAction> {
    private map: { route: Route, action: TAction }[] = [];

    public set(path: string, action: TAction): this {
        this.map.push({ route: path.split("/").filter(x => !!x), action });
        return this;
    }

    resolve = (route: Route) => {
        for (let entry of this.map) {
            let match = routeTemplate(entry.route).match(route);
            if (match) {
                return {
                    action: entry.action,
                    appliedRoute: route.slice(0, entry.route.length),
                    remainingRoute: route.slice(entry.route.length),
                    params: match
                } as ActionResolution<TAction>;
            }
        }

        return null as ActionResolution<TAction>;
    }

    public route = (path: string, action: TAction) => {
        this.set(path, action);
        return this;
    }
}

function routeTemplate(route: string | Route) {
    let routeParts = typeof route === "string" ? route.split("/") : route;
    return {
        match(paths: any[]): { [key: string]: any } {
            let params = {};
            for (let i = 0; i < routeParts.length; i++) {
                let path = paths[i];
                let route = routeParts[i];
                if (path === route) {
                    // ok, continue matching...
                }
                else if (path) {
                    if (route.startsWith(":")) {
                        params[route.substr(1)] = path;
                    } else if (route !== path) {
                        return null;
                    }
                } else {
                    return null;
                }
            }
            return params;
        }
    }
}

export type ActionResolver<TAction> = (route: Route) => ActionResolution<TAction> | Rx.ObservableInput<ActionResolution<TAction>> | null;

export interface IAction<TActionResult> {
    execute(context: IActionContext): TActionResult | Rx.ObservableInput<TActionResult>,
    resolve?: ActionResolverInput<IAction<TActionResult>>
}
export type IActionContext = { params: { [name: string]: any }, url: UrlHelper };

export class ActionNotFound {
    constructor(public fullRoute: Route, public notFound: Route) {
    }

    render() {
        let basePath = `${this.fullRoute.map(r => "/" + r).join("")}`;
        let errorPath = `/${this.notFound.map(r => r + "/").join("")}`;
        console.error(`%c${basePath}%c${errorPath}`, "color: #BBB", "font-size: larger;");
        return false;
    }
}

export function actionResolver<TAction>(mappings: ActionResolverInput<TAction>): ActionResolver<TAction> {
    if (typeof mappings === "function")
        return mappings;

    if (mappings) {
        if (typeof mappings === "function")
            return mappings;

        let actionMap = new ActionMap<TAction>();
        try {
            for (let route in mappings) {
                actionMap.set(route, mappings[route]);
            }
            return actionMap.resolve;
        }
        catch (ex) {
            debugger;
        }
    }
}

export function action<TActionResult>(execute: (context: IActionContext) => TActionResult, mappings?: ActionResolverInput<TActionResult>) {
    return {
        execute,
        resolve: typeof mappings === "function" ? mappings : actionResolver(mappings)
    }
}

export function composeResolve<TActionResult>(x: ActionResolverInput<TActionResult>, y: ActionResolverInput<TActionResult>) {
    const xResolver = actionResolver(x);
    const yResolver = actionResolver(y);

    return function resolve(route: Route) {
        const action = xResolver(route) || yResolver(route);

        return action;
    }
}
