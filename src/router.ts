import * as Rx from "rxjs";
import * as Ro from "rxjs/operators";
import { Route, ActionNotFound, ActionResolution, IActionContext, ActionResolver, createContext } from "./action"
import UrlHelper from "./url-helper";
import { ChainCache } from "./chain-cache";

export type ActionResult = { dispose(); activate?(): Rx.Unsubscribable | Rx.Unsubscribable[] }

export class Router {
    private actions$: Rx.Observable<Route>;
    private active$: Rx.Subject<Route>;

    constructor(passive$: Rx.Observable<Route>, public baseRoute: Route = []) {
        this.active$ = new Rx.Subject<Route>();
        this.actions$ = Rx.merge(passive$, this.active$);
    }

    toAbsolute(route: Route) {
        return [ ...this.baseRoute, ...route ];
    }

    start<TAction, TActionResult extends ActionResult>(
        viewEngine: IViewEngine<TAction, TActionResult>
    ): Rx.Observable<Activation> {

        const router = this;

        function resolveRoute(resolver: ActionResolver<TAction>, route: Route, context: IActionContext): Rx.Observable<ActionResolution<TAction>> {
            return toObservable(resolver && resolver.call(null, route, context));
        }

        const routeCache = new ChainCache<RouteResult<TActionResult>>(d => {
            return d && d.actionResult && d.actionResult.dispose();
        });

        function expandRoute(routeEntry: RouteEntry<TAction, TActionResult>, routeIndex: number): Rx.Observable<RouteEntry<TAction, TActionResult>> {
            const { remainingRoute, resolver, actionContext: parentContext } = routeEntry;

            if (remainingRoute.length === 0) {
                return Rx.empty();
            }

            return resolveRoute(resolver, remainingRoute, parentContext)
                .pipe(
                    Ro.mergeMap((resolution: ActionResolution<TAction>) => {
                        if (!resolution) {
                            routeCache.truncateAt(routeIndex);
                            return catchError(new Error("not found"))
                        }

                        const next = routeCache.getAt(routeIndex);
                        const { appliedRoute, action } = resolution;
                        const nextRemainingRoute = remainingRoute.slice(appliedRoute.length)
                        if (nextRemainingRoute.length === 0) {
                            routeCache.truncateAt(routeIndex + 1);
                        }

                        const actionContext = createContext(parentContext, appliedRoute, resolution.params);
                        if (next && routeCompare(next.appliedRoute, appliedRoute)) {
                            return Rx.of(<RouteEntry<TAction, TActionResult>>{
                                action,
                                actionContext,
                                routeResult: next,
                                remainingRoute: nextRemainingRoute,
                                resolver: viewEngine.actionResolver(action)
                            });
                        }

                        try {
                            let nextResult$ = viewEngine.execute(resolution.action, actionContext);

                            return toObservable(nextResult$)
                                .pipe(
                                    Ro.map(nextResult => {
                                        const nextRouteResult = routeResult(appliedRoute, nextResult);
                                        routeCache.setAt(routeIndex, nextRouteResult);
                                        const nextRouteEntry: RouteEntry<TAction, TActionResult> = {
                                            action,
                                            actionContext,
                                            routeResult: nextRouteResult,
                                            remainingRoute: nextRemainingRoute,
                                            resolver: viewEngine.actionResolver(action)
                                        }
                                        return nextRouteEntry;
                                    }),
                                    Ro.catchError(catchError)
                                )
                        }
                        catch (ex) {
                            return catchError(ex);
                        }
                    })
                );

            function catchError(error) {
                viewEngine.catch(error, remainingRoute, routeEntry)

                return Rx.of(<RouteEntry<TAction, TActionResult>>{
                    ...routeEntry,
                    remainingRoute: []
                });
            }
        }

        const rootRouteResult = routeResult([], null);
        const rootContext: IActionContext = { url: new UrlHelper(this, this.baseRoute, 0), params: {} };

        return router.actions$
            .pipe(
                Ro.map(route => startsWith(route, router.baseRoute) ? route.slice(router.baseRoute.length) : []),
                Ro.distinctUntilChanged(routeCompare),
                Ro.switchMap((remainingRoute) => {
                    var rootEntry = <RouteEntry<TAction, TActionResult>>{
                        actionContext: rootContext,
                        appliedRoute: [],
                        routeResult: rootRouteResult,
                        remainingRoute,
                        resolver: viewEngine.rootResolve
                    };

                    return Rx.of(rootEntry).pipe(
                        Ro.expand(expandRoute),
                        Ro.filter(entry => { return entry.remainingRoute.length === 0; } /* is last entry */),
                        Ro.map(entry => activate(entry))
                    );
                }),
                Ro.scan((old, active) => {
                    old && old.deactivate();
                    return active;
                })
            );

        function activate(entry: RouteEntry<TAction, TActionResult>): Activation {
            const actionResult: TActionResult = entry.routeResult.actionResult;
            const route: Route = entry.actionContext.url.toAbsolute();
            const subscriptions = viewEngine.activate(actionResult);
            if (Array.isArray(subscriptions)) {
                if (subscriptions.length > 0)
                    return new Activation(subscriptions, route);
            } else if (subscriptions) {
                return new Activation([subscriptions], route);
            }
            return new Activation([], route);
        }

    }

    public execute(route: string | Route) {
        if (typeof route === "string") {
            this.active$.next(route.split('/').filter(x => !!x));
        } else {
            this.active$.next(route);
        }
    }
}

function routeCompare(xv: any[], yv: any[]) {
    if (xv.length !== yv.length)
        return false;

    let i = xv.length;
    while (i--) {
        let prev = xv[i]
        let next = yv[i]

        if (pathCompare(prev, next) === false)
            return false;
    }

    return true;
}

export function pathCompare(prev, next) {
    if (prev !== next) {
        if (typeof prev === "string")
            return false;

        if (prev.toString() !== next)
            return false;
    }

    return true;
}

export function toObservable<T>(input: T | Rx.Subscribable<T> | PromiseLike<T>): Rx.Observable<T> {
    if (input === null && input === void 0) {
        return Rx.of(input as T);
    } else if (Rx.isObservable<T>(input)) {
        return input;
    } else if (isPromise(input)) {
        return Rx.from(input);
    } else if (isSubscribable(input)) {
        return new Rx.Observable(input.subscribe.bind(input))
    }

    return Rx.of(input);

    function isPromise(value): value is PromiseLike<unknown> {
        return !!value && typeof value.subscribe !== 'function' && typeof value.then === 'function';
    }

    function isSubscribable(o: any): o is Rx.Subscribable<unknown> {
        if (o === null || typeof o !== "object")
            return false;

        if (typeof o.subscribe !== "function")
            return false;

        return true;
    }
}

export type RouteEntry<TAction, TActionResult> = {
    action?: TAction,
    actionContext: IActionContext,
    routeResult?: RouteResult<TActionResult>,
    remainingRoute: Route;
    resolver?: ActionResolver<TAction>;
}

function routeResult<TActionResult>(appliedRoute: Route, actionResult: TActionResult): RouteResult<TActionResult> {
    return {
        appliedRoute,
        actionResult
    }
}

export type RouteResult<TActionResult> = {
    appliedRoute: Route,
    actionResult: TActionResult
};
export type Renderer<T> = (value: T | Rx.ObservableInput<T> | ActionNotFound) => Disposable;
export type Disposable = { dispose(); };

type SubscribableOrPromise<T> = Rx.Subscribable<T> | PromiseLike<T>;

export interface IViewEngine<TAction, TComponent> {
    execute(action: TAction, context: IActionContext): TComponent | SubscribableOrPromise<TComponent>;
    activate(actionResult: TComponent): Rx.Unsubscribable | Rx.Unsubscribable[];
    actionResolver(action: TAction): ActionResolver<TAction>;
    rootResolve(route: Route, context: IActionContext): ActionResolution<TAction> | Rx.ObservableInput<ActionResolution<TAction>> | null;
    catch(error: Error, route: Route, context: RouteEntry<TAction, TComponent>);
    resolveRoute(action: TAction, route: Route, context: IActionContext): Rx.Observable<ActionResolution<TAction>>;
}

export class Activation {
    constructor(public subscriptions: Rx.Unsubscribable[], public route: Route) {
    }

    deactivate() {
        const { subscriptions } = this;
        for (var i = 0; i < subscriptions.length; i++) {
            subscriptions[i].unsubscribe();
        }
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
