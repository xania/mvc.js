import * as Rx from "rxjs";
import * as Ro from "rxjs/operators";
import { UrlHelper } from "./url-helper";

type Path = string[];

interface RouteParams {
    [key: string]: any;
}

interface RouteSegment {
    path: Path;
    params: RouteParams;
}

export interface Route<TView> {
    match(path: Path): RouteSegment;
    view?: TView;
    resolve?: ViewResolver<TView>;
}

export interface RouteDescriptor<TView> {
    path: Path;
    view?: TView;
    routes?: RouteInput<TView>[];
}

export interface Component<TView = unknown> {
    view: TView;
    routes?: RouteInput<TView>[];
}

interface ComponentRoute<TView> {
    path: Path;
    component: () => Component<TView>;
}

function isRouteDescriptor(value: any): value is RouteDescriptor<any> {
    return value && "path" in value;
}
function isRoute(value: any): value is Route<any> {
    return value && typeof value.match === "function";
}
function isComponentRoute(value: any): value is ComponentRoute<any> {
    return "component" in value;
}
export type RouteInput<TView> =
    | RouteDescriptor<TView>
    | Route<TView>
    | ComponentRoute<TView>;

interface ViewResult {
    dispose(): void;
}

export interface ViewResolution<TView> {
    appliedPath: string[];
    params: RouteParams;
    view: TView | null;
    resolve?: ViewResolver<TView>;
}

type ViewResolver<TView> = (route: string[]) => Promise<ViewResolution<TView>>;
type LinkedList<T> = {
    head: T;
    tail?: LinkedList<T>;
};

function isViewResolver(value: any): value is ViewResolver<any> {
    return typeof value === "function";
}

type PathTemplate = Path;

function pathMatcher(pathTemplate: PathTemplate) {
    return (path: Path) => {
        const { length } = pathTemplate;
        for (var i = 0; i < length; i++) {
            if (pathTemplate[i] !== path[i]) {
                return null;
            }
        }
        return {
            id: self,
            path: path.slice(0, length),
            params: {},
        };
    };
}

function createRoute<TView>(
    path: PathTemplate,
    view: TView,
    routes?: RouteInput<TView>[]
): Route<TView> {
    const self = {
        match: pathMatcher(path),
        view,
        resolve: createViewResolver(routes),
    };

    return self;
}

async function traverse<TView>(
    remainingPath: Path,
    resolve: ViewResolver<TView>
): Promise<LinkedList<ViewResolution<TView>>> {
    if (isArrayEmpty(remainingPath)) {
        return null;
    }
    const result = await resolve(remainingPath);
    if (result) {
        return {
            head: result,
            tail: await traverse(
                remainingPath.slice(result.appliedPath.length),
                result.resolve
            ),
        };
    } else {
        return {
            head: {
                appliedPath: remainingPath,
                view: null,
                params: {},
            },
        };
    }
}

type Mononoid<T> = (x: T) => T;
interface ViewResolutionFilter<TView>
    extends Mononoid<LinkedList<ViewResolution<TView>>> {}

export interface ViewContext {
    url: UrlHelper;
    params: RouteParams;
}
type ViewExecutor<TView> = (action: TView, context: ViewContext) => ViewResult;

function browserRoutes(basepath: Path): Rx.Observable<Path> {
    return Rx.timer(0, 50).pipe(
        Ro.map(() => location.pathname),
        Ro.distinctUntilChanged(),
        Ro.map((pathname: string) => pathname.split("/").filter((x) => !!x)),
        Ro.filter((route) => startsWith(route, basepath))
    );
}

function startsWith(route: Path, base: Path) {
    if (base.length === 0) return true;

    if (base.length > route.length) return false;

    for (var i = 0; i < base.length; i++) {
        if (pathCompare(base[i], route[i]) === false) return false;
    }

    return true;

    function pathCompare(prev: any, next: any) {
        if (prev !== next) {
            if (typeof prev === "string") return false;

            if (prev.toString() !== next) return false;
        }

        return true;
    }
}

export interface Router<TView> {
    start(executor: ViewExecutor<TView>): Rx.Observable<ViewResult[]>;
    next(path: Path): void;
}

export function createRouter<TView>(
    routes: ViewResolver<TView> | RouteInput<TView>[]
) {
    var routes$ = new Rx.Subject<Path>();
    var browser$ = browserRoutes([]);
    const rootResolve = isViewResolver(routes)
        ? routes
        : createViewResolver(routes);

    return {
        next(route: Path) {
            routes$.next(route);
        },
        start(executor: ViewExecutor<TView>) {
            return start(executor, identity);
        },
        latest(executor: ViewExecutor<TView>) {
            return start(executor, last);
        },
    } as Router<TView>;

    function start(
        executor: ViewExecutor<TView>,
        filter?: ViewResolutionFilter<TView>
    ) {
        return startRouter(
            Rx.merge(routes$, browser$),
            rootResolve,
            filter || identity
        ).pipe(
            Ro.scan(reducer(executor), []),
            Ro.map((entries) => entries.map((entry) => entry.result))
        );
    }

    type Pair = [number, LinkedList<ViewResolution<TView>>];
    function reducer(executor: ViewExecutor<TView>) {
        type Entry = {
            url: UrlHelper;
            result: ViewResult;
        };
        return function (acc: Entry[], [offset, list]: Pair) {
            while (acc.length > offset) {
                const curr = acc.pop();
                if (curr.result) {
                    curr.result.dispose();
                }
            }
            map(list, (res, i) => {
                const parent = acc[i + offset - 1];
                const url = new UrlHelper(
                    res.appliedPath,
                    parent && parent.url
                );
                acc[i + offset] = {
                    url,
                    result: executor(res.view, { params: res.params, url }),
                };
            });
            return acc;
        };
    }

    function identity<T>(value: T): T {
        return value;
    }
}

function startRouter<TView>(
    routes$: Rx.Observable<Path>,
    rootResolve: ViewResolver<TView>,
    filter: ViewResolutionFilter<TView>
) {
    let prev: LinkedList<ViewResolution<TView>> = null;
    return routes$.pipe(
        Ro.concatMap(async (route) => {
            let resolutions = filter(
                await traverseReduce(route, rootResolve, prev)
            );
            let acc = prev;
            prev = resolutions;

            let index = 0;
            while (
                resolutions &&
                acc &&
                isSameResolution(acc.head, resolutions.head)
            ) {
                index++;
                acc = acc.tail;
                resolutions = resolutions.tail;
            }

            return [index, resolutions] as [
                number,
                LinkedList<ViewResolution<TView>>
            ];
        }),
        Ro.share()
    );
}

async function traverseReduce<TView>(
    route: string[],
    resolve: ViewResolver<TView>,
    prevlist: LinkedList<ViewResolution<TView>>
): Promise<LinkedList<ViewResolution<TView>>> {
    if (prevlist) {
        const { head } = prevlist;
        if (isValidResolution(head, route)) {
            const result = await traverseReduce<TView>(
                route.slice(head.appliedPath.length),
                head.resolve,
                prevlist.tail
            );
            return cons(head, result);
        }
    }

    return await traverse(route, resolve);
}

function isValidResolution<TView>(
    result: ViewResolution<TView>,
    remaininPath: string[]
): boolean {
    if (!remaininPath || remaininPath.length === 0) {
        return false;
    }

    if (result && result.view) {
        const { appliedPath } = result;
        for (let i = 0; i < appliedPath.length; i++) {
            if (appliedPath[i] !== remaininPath[i]) return false;
        }
        return true;
    }
    return false;
}

export function createViewResolver<TView>(
    routes: RouteInput<TView>[]
): ViewResolver<TView> {
    const compiled = compile(routes);
    return (remainingPath: string[]) => {
        if (!isArrayEmpty(compiled) && !isArrayEmpty(remainingPath)) {
            for (const route of compiled) {
                const segment = route.match(remainingPath);
                if (segment) {
                    const { view } = route;
                    const appliedPath = segment.path;
                    return Promise.resolve<ViewResolution<TView>>({
                        appliedPath,
                        view,
                        params: segment.params,
                        resolve: route.resolve,
                    });
                }
            }
        }
        return Promise.resolve(null as ViewResolution<TView>);
    };

    function compile(routes: RouteInput<TView>[]): Route<TView>[] {
        const results: Route<TView>[] = [];
        if (Array.isArray(routes)) {
            for (const route of routes) {
                if (isRouteDescriptor(route)) {
                    if (isComponentRoute(route)) {
                        results.push(
                            fromComponentRoute(route.path, route.component)
                        );
                    } else {
                        results.push(
                            createRoute(route.path, route.view, route.routes)
                        );
                    }
                } else if (isRoute(route)) {
                    results.push(route);
                } else {
                    console.error("unsupported route", route);
                }
            }
        }
        return results;
    }
}

function isArrayEmpty(arr: any[]) {
    return !Array.isArray(arr) || arr.length === 0;
}

function map<T, U>(
    list: LinkedList<T>,
    project: (t: T, index?: number, source?: LinkedList<T>) => U
): LinkedList<U> {
    return _map(list, 0);

    function _map(l: LinkedList<T>, index: number) {
        if (!l) {
            return null;
        }
        return {
            head: project(l.head, index, list),
            tail: _map(l.tail, index + 1),
        };
    }
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

function concat<T>(x: LinkedList<T>, y: LinkedList<T>): LinkedList<T> {
    if (!x) {
        return y;
    }
    return {
        head: x.head,
        tail: x.tail ? concat(x.tail, y) : y,
    };
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

function memoize<TF extends (...args: any[]) => any>(fn: TF) {
    let result = null;
    let invoked = false;
    return function (...args: Parameters<TF>): ReturnType<TF> {
        if (invoked) {
            return result;
        }
        invoked = true;
        return (result = fn());
    };
}

function fromComponentRoute<TView>(
    path: string[],
    component: () => Component<TView>
): Route<TView> {
    const mem = memoize(() => {
        const comp = component();
        return {
            view: comp.view,
            resolve: createViewResolver(comp.routes),
        };
    });
    return {
        match: pathMatcher(path),
        get view() {
            return mem().view;
        },
        get resolve() {
            return mem().resolve;
        },
    };
}

function isSameResolution<TView>(
    x: ViewResolution<TView>,
    y: ViewResolution<TView>
) {
    if (x.view === null || y.view === null) {
        return false;
    }

    if (x.view !== y.view) {
        return false;
    }

    if (x.appliedPath.length !== y.appliedPath.length) {
        return false;
    }

    for (let i = 0; i < x.appliedPath.length; i++) {
        if (x.appliedPath[i] !== y.appliedPath[i]) {
            return false;
        }
    }

    return true;
}
