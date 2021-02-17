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

export interface ViewResult {
    url: UrlHelper;
    result: Disposable;
}

interface Disposable {
    dispose(): void;
}

export type ViewResolution<TView> = Resolved<TView> | NotFound;
export interface Resolved<TView> {
    appliedPath: string[];
    params?: RouteParams;
    view: TView | null;
    resolve?: ViewResolver<TView>;
}

interface NotFound {
    appliedPath: string[];
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
        if (length === 0 && path.length > 0) {
            return null;
        }
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
): Promise<LinkedList<Resolved<TView>>> {
    if (!resolve) {
        return null;
    }

    const result = await resolve(remainingPath);
    if ("view" in result) {
        if (result.appliedPath.length === 0) {
            return {
                head: result,
            };
        }

        return {
            head: result,
            tail: await traverse(
                remainingPath.slice(result.appliedPath.length),
                result.resolve
            ),
        };
    } else {
        return null;
    }
}

export interface ViewContext {
    url: UrlHelper;
    params: RouteParams;
    childRouter<TView>(
        map: ViewResolver<TView> | RouteInput<TView>[]
    ): Router<TView>;
}

type ViewExecutor<TView> = (
    resolution: ViewResolution<TView>,
    url: UrlHelper
) => Disposable;

export function browserRoutes(virtualPath: Path): Rx.Observable<Path> {
    return Rx.timer(0, 50).pipe(
        Ro.map(() => location.pathname),
        Ro.distinctUntilChanged(),
        Ro.map((pathname: string) => pathname.split("/").filter((x) => !!x)),
        Ro.filter((route) => startsWith(route, virtualPath)),
        Ro.map((route) => route.slice(virtualPath.length))
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
    start(executor: ViewExecutor<TView>): Rx.Observable<[ViewResult[], Path]>;
}

export function createRouter<TView>(
    routes$: Rx.Observable<string[]>,
    mapping: ViewResolver<TView> | RouteInput<TView>[]
) {
    const viewResolver = isViewResolver(mapping)
        ? mapping
        : createViewResolver(mapping);

    return {
        start(executor: ViewExecutor<TView>) {
            return startRouter(routes$, viewResolver).pipe(
                Ro.scan(createScanner(executor), [[], []])
            );
        },
    };

    type RouteResolution = [
        LinkedList<Resolved<TView>>,
        LinkedList<Resolved<TView>>,
        Path
    ];
    function createScanner(executor: ViewExecutor<TView>) {
        return function scan(
            [prev]: [ViewResult[], Path],
            next: RouteResolution
        ): [ViewResult[], Path] {
            const [unchanged, added, remaining] = next;
            const offset = length(unchanged);
            const entries = prev.slice(0, offset);
            for (let i = offset; i < prev.length; i++) {
                const curr = prev[i];
                if (curr.result) {
                    curr.result.dispose();
                }
            }
            map(added, execute);

            return [entries, remaining];

            function execute(res: Resolved<TView>, idx: number) {
                const parent = entries[idx + offset - 1];
                const url = new UrlHelper(
                    res.appliedPath,
                    parent && parent.url
                );
                entries[idx + offset] = {
                    url,
                    result: executor(res, url),
                };
            }
        };
    }
}

function startRouter<TView>(
    routes$: Rx.Observable<Path>,
    rootResolve: ViewResolver<TView>
) {
    let prev: LinkedList<Resolved<TView>> = null;
    return routes$.pipe(
        Ro.concatMap(async (route) => {
            const {
                unchanged,
                remainingRoute,
                resolve,
            } = unchangedResolutions<TView>(route, prev);
            const newResolutions = await traverse(
                remainingRoute,
                resolve || rootResolve
            );

            prev = concat(unchanged, newResolutions);
            const appliedLength = reduce(
                (p, n) => p + n.appliedPath.length,
                prev,
                0
            );

            const remainingPath = route.slice(appliedLength);
            return [unchanged, newResolutions, remainingPath];
        }),
        Ro.share()
    );
}

function unchangedResolutions<TView>(
    route: string[],
    prevlist: LinkedList<Resolved<TView>>
): {
    remainingRoute: Path;
    unchanged?: LinkedList<Resolved<TView>>;
    resolve?: ViewResolver<TView>;
} {
    if (!prevlist) {
        return { remainingRoute: route };
    }

    const { head } = prevlist;
    if (isValidResolution(head, route)) {
        const {
            unchanged,
            remainingRoute,
            resolve,
        } = unchangedResolutions<TView>(
            route.slice(head.appliedPath.length),
            prevlist.tail
        );
        return {
            unchanged: cons(head, unchanged),
            remainingRoute,
            resolve: resolve || head.resolve,
        };
    } else {
        return {
            remainingRoute: route,
            resolve: head.resolve,
        };
    }
}

function isValidResolution<TView>(
    result: ViewResolution<TView>,
    remainingPath: string[]
): boolean {
    if (!remainingPath || remainingPath.length === 0) {
        return false;
    }

    if (result && "view" in result) {
        const { appliedPath } = result;
        if (appliedPath.length === 0 && remainingPath.length > 0) {
            return false;
        }
        for (let i = 0; i < appliedPath.length; i++) {
            if (appliedPath[i] !== remainingPath[i]) return false;
        }
        return true;
    }
    return false;
}

export function createViewResolver<TView>(
    routes: RouteInput<TView>[]
): ViewResolver<TView> {
    if (isArrayEmpty(routes)) {
        return null;
    }

    const compiled = compile(routes);
    if (isArrayEmpty(compiled)) {
        return (remainingPath) => {
            return Promise.resolve<ViewResolution<TView>>({
                appliedPath: remainingPath,
            });
        };
    }
    return (remainingPath: string[]) => {
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
        const notFound: NotFound = {
            appliedPath: remainingPath,
        };
        return Promise.resolve(notFound);
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

type ReduceCallBack<T, U> = (prev: U, next: T, idx: number) => U;
function reduce<T, U>(
    callback: ReduceCallBack<T, U>,
    list: LinkedList<T>,
    seed: U
): U {
    if (!list) {
        return seed;
    }
    let result = seed;
    let l = list;
    let idx = 0;
    while (l) {
        result = callback(result, l.head, idx++);
        l = l.tail;
    }
    return result;
}

function length<T>(x: LinkedList<T>): number {
    if (!x) {
        return 0;
    }
    return 1 + length(x.tail);
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
        const comp = typeof component === "function" ? component() : component;
        const view = "view" in comp ? comp.view : comp;
        return {
            view,
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

function isSameResolution<TView>(x: Resolved<TView>, y: Resolved<TView>) {
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
