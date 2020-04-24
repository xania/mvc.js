import * as Rx from "rxjs";
import UrlHelper from "./url-helper";
import { MaybePromise } from "./types";

export type Route = any[];
export type ActionResolution<TAction> = {
    action: TAction;
    appliedRoute: Route;
    remainingRoute: Route;
    params: { [key: string]: any };
};
export type ActionResolverInput<TAction> =
    | { [route: string]: TAction }
    | ActionResolver<TAction>;

export class ActionMap<TAction> {
    private map: { route: Route; action: MaybePromise<TAction> }[] = [];

    public set(path: string, action: MaybePromise<TAction>): this {
        this.map.push({ route: path.split("/").filter((x) => !!x), action });
        return this;
    }

    resolve = (route: Route, context: IActionContext) => {
        for (let entry of this.map) {
            let match = routeTemplate(entry.route).match(route);
            if (match) {
                return {
                    action: entry.action,
                    appliedRoute: route.slice(0, entry.route.length),
                    remainingRoute: route.slice(entry.route.length),
                    params: match,
                } as ActionResolution<TAction>;
            }
        }

        return null as ActionResolution<TAction>;
    };

    public route = (path: string, action: TAction) => {
        this.set(path, action);
        return this;
    };
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
                } else if (path) {
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
        },
    };
}

export type ActionResolver<TAction> = (
    route: Route,
    context: IActionContext
) => MaybePromise<ActionResolution<TAction>> | null;

export interface IAction<TActionResult> {
    execute(
        context?: IActionContext
    ): TActionResult | Rx.ObservableInput<TActionResult>;
    resolve?: ActionResolverInput<this>;
}
export type IActionContext = {
    params: { [name: string]: unknown };
    url: UrlHelper;
};

export function lazy<TActionResult>(fn: () => IAction<TActionResult>) {
    let action: IAction<TActionResult> | null = null;
    function getAction() {
        if (action === null) {
            action = fn();
        }
        return action;
    }
    let resolver: ActionResolver<IAction<TActionResult>> | null = null;
    function getResolver() {
        const action = getAction();
        if (resolver === null) {
            resolver = actionResolver(action.resolve);
        }
        return resolver;
    }

    const retval: IAction<TActionResult> = {
        execute(context: IActionContext) {
            return getAction().execute(context);
        },
        resolve(route: Route, context: IActionContext) {
            return getResolver()(route, context);
        },
    };

    return retval;
}

export class ActionNotFound {
    constructor(public fullRoute: Route, public notFound: Route) {}

    render() {
        let basePath = `${this.fullRoute.map((r) => "/" + r).join("")}`;
        let errorPath = `/${this.notFound.map((r) => r + "/").join("")}`;
        console.error(
            `%c${basePath}%c${errorPath}`,
            "color: #BBB",
            "font-size: larger;"
        );
        return false;
    }
}

export function actionResolver<TAction>(
    mappings: ActionResolverInput<TAction>
): ActionResolver<TAction> {
    if (typeof mappings === "function") return mappings;

    if (mappings) {
        if (typeof mappings === "function") return mappings;

        let actionMap = new ActionMap<TAction>();
        try {
            for (let route in mappings) {
                const mapping = mappings[route];
                actionMap.set(route, mapping);
            }
            return actionMap.resolve;
        } catch (ex) {
            debugger;
        }
    }
}

export function action<TActionResult>(
    execute: (context: IActionContext) => MaybePromise<TActionResult>,
    mappings?: ActionResolverInput<TActionResult>
) {
    return {
        execute,
        resolve:
            typeof mappings === "function"
                ? mappings
                : actionResolver(mappings),
    };
}

export function composeResolve<TActionResult>(
    x: ActionResolverInput<TActionResult>,
    y: ActionResolverInput<TActionResult>
) {
    const xResolver = actionResolver(x);
    const yResolver = actionResolver(y);

    return function resolve(route: Route, context: IActionContext) {
        const action = xResolver(route, context) || yResolver(route, context);

        return action;
    };
}

export function createContext(
    parentContext: IActionContext,
    route: Route,
    params: { [key: string]: any }
): IActionContext {
    const url: UrlHelper = parentContext.url.createChild(route);
    // new UrlHelper(router, appliedRoute, parentContext.url);
    return { url, params: { ...parentContext.params, ...params } };
}
