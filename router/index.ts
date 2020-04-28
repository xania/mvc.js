import { Route } from "../lib/action";
import * as Rx from "rxjs";
import * as Ro from "rxjs/operators";

interface RouteParams {
    [key: string]: any;
}

interface RouteSegment {
    route: Route;
    params: RouteParams;
}

interface RouteMapping {
    match(route: Route): RouteSegment | null;
    target: Action;
}

interface ActionResult {
    dispose(): void;
}

interface Action {
    execute(): ActionResult;
    resolve: (route: string[]) => Promise<ActionResolution>;
}

export interface ActionResolution {
    appliedRoute: string[];
    params: RouteParams;
    action: Action | null;
}

type ActionResolver = (route: string[]) => Promise<ActionResolution>;
type LinkedList<T> = {
    head: T;
    tail?: LinkedList<T>;
};

type RouteTemplate = Route;

export function createMapping(
    routeTemplate: RouteTemplate,
    target: Action
): RouteMapping {
    const self = {
        match: (route: Route) => {
            const { length } = routeTemplate;
            for (var i = 0; i < length; i++) {
                if (routeTemplate[i] !== route[i]) {
                    return null;
                }
            }
            return {
                id: self,
                route: route.slice(0, length),
                params: {},
            };
        },
        target,
    };

    return self;
}

async function traverse(
    remainingRoute: string[],
    resolve: ActionResolver
): Promise<LinkedList<ActionResolution>> {
    if (isArrayEmpty(remainingRoute)) {
        return null;
    }

    const result = await resolve(remainingRoute);
    if (result) {
        return {
            head: result,
            tail: await traverse(
                remainingRoute.slice(result.appliedRoute.length),
                result.action.resolve
            ),
        };
    } else {
        return {
            head: {
                appliedRoute: remainingRoute,
                action: null,
                params: {},
            },
        };
    }
}

type RouterResult = {
    appliedRoute: string[];
    params: RouteParams;
    action: Action | null;
    result: ActionResult;
};
type Mononoid<T> = (x: T) => T;
type ActionResolutionFilter = Mononoid<LinkedList<ActionResolution>>;

export function createRouter(mappings: RouteMapping[]) {
    var routes$ = new Rx.Subject<Route>();
    const rootResolve = createActionResolver(mappings);

    return {
        next(route: Route) {
            routes$.next(route);
        },
        start(init?: LinkedList<ActionResolution>) {
            return startRouter(routes$, rootResolve, identity, init);
        },
        latest(init?: LinkedList<ActionResolution>) {
            return startRouter(routes$, rootResolve, last, init);
        },
    };

    function identity<T>(value: T): T {
        return value;
    }
}

function startRouter(
    routes$: Rx.Observable<Route>,
    rootResolve: (route: Route) => Promise<any>,
    filter: ActionResolutionFilter,
    init?: LinkedList<ActionResolution>
) {
    let prev = map(init, (x) => execute(x));
    return routes$.pipe(
        Ro.concatMap(async (route) => {
            let resolutions = filter(
                await traverseReduce(route, rootResolve, prev)
            );
            let acc = prev;
            let retval = empty<RouterResult>();
            while (resolutions) {
                if (acc && acc.head.action === resolutions.head.action) {
                    retval = append(acc.head, retval);
                    acc = acc.tail;
                } else {
                    if (acc) {
                        // dispose all of remaining results not matching new route resolutions
                        console.log("dispose: ", acc);
                        acc = null;
                    }
                    // current resultion is not found in acc -> render
                    console.log("render: ", resolutions.head);
                    retval = append(execute(resolutions.head), retval);
                }
                resolutions = resolutions.tail;
            }
            return (prev = retval);
        }),
        Ro.share()
    );

    function execute(resolution: ActionResolution): RouterResult {
        const { action } = resolution;
        return {
            ...resolution,
            result: action && action.execute(),
        };
    }
}

async function traverseReduce(
    route: string[],
    resolve: ActionResolver,
    prevlist: LinkedList<ActionResolution>
): Promise<LinkedList<ActionResolution>> {
    if (prevlist) {
        const { head } = prevlist;
        if (isValidResolution(head, route)) {
            const result = await traverseReduce(
                route.slice(head.appliedRoute.length),
                head.action.resolve,
                prevlist.tail
            );
            return cons(head, result);
        }
    }

    return await traverse(route, resolve);
}

function isValidResolution(
    result: ActionResolution,
    remainingRoute: string[]
): boolean {
    if (!remainingRoute || remainingRoute.length === 0) {
        return false;
    }

    if (result) {
        const { appliedRoute } = result;

        for (let i = 0; i < appliedRoute.length; i++) {
            if (appliedRoute[i] !== remainingRoute[i]) return false;
        }
        return true;
    }
    return false;
}

export function createAction(view: any, mappings?: RouteMapping[]): Action {
    return {
        execute() {
            console.log("execute: ", view);
            return {
                dispose() {
                    console.log("dispose: ", view);
                },
            };
        },
        resolve: createActionResolver(mappings),
    };
}

export function createActionResolver(mappings: RouteMapping[]) {
    return (remainingRoute: string[]) => {
        if (!isArrayEmpty(mappings) && !isArrayEmpty(remainingRoute)) {
            for (const mapping of mappings) {
                const segment = mapping.match(remainingRoute);
                if (segment) {
                    const { target } = mapping;
                    const appliedRoute = segment.route;
                    return Promise.resolve<ActionResolution>({
                        appliedRoute,
                        action: target,
                        params: segment.params,
                    });
                }
            }
        }
        return Promise.resolve(null);
    };
}

function isArrayEmpty(arr: any[]) {
    return !Array.isArray(arr) || arr.length === 0;
}

function map<T, U>(list: LinkedList<T>, project: (t: T) => U): LinkedList<U> {
    if (!list) {
        return null;
    }
    return {
        head: project(list.head),
        tail: map(list.tail, project),
    };
}

function last<T>(list: LinkedList<T>): LinkedList<T> {
    if (!list) {
        return null;
    }
    if (list.tail) {
        return last(list.tail);
    }
    return list;
}

function cons<T>(head: T, tail: LinkedList<T>): LinkedList<T> {
    return { head, tail };
}

function append<T>(head: T, list: LinkedList<T>): LinkedList<T> {
    if (!list) {
        return { head };
    }
    return {
        head: list.head,
        tail: append(head, list.tail),
    };
}

function zip<S, T, R>(
    left: LinkedList<S>,
    right: LinkedList<T>,
    project: (x: S, y: T) => R
): LinkedList<R> {
    if (!left || !right) {
        return null;
    }

    return cons(
        project(left.head, right.head),
        zip(left.tail, right.tail, project)
    );
}

function empty<T>() {
    return null as LinkedList<T>;
}
