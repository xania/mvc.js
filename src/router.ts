import * as Rx from "rxjs";
import * as Ro from "rxjs/operators";
import { Route, ActionResolver, ActionNotFound, ActionResolution, IActionContext } from "./action.js"
import { isPromise } from 'rxjs/internal/util/isPromise.js';
import { isInteropObservable } from 'rxjs/internal/util/isInteropObservable.js';
import { fromPromise } from 'rxjs/internal/observable/fromPromise.js';
import { fromObservable } from 'rxjs/internal/observable/fromObservable.js';
import UrlHelper from "./url-helper.js";
import { ChainCache } from "./chain-cache.js";

type Subscription = { unsubscribe(); };
export type ActionResult = { dispose(); activate?(): Subscription | Subscription[] }

export class Router {
    private actions$: Rx.Observable<Route>;
    private active$: Rx.Subject<Route>;

    constructor(passive$: Rx.Observable<Route>) {
        this.active$ = new Rx.Subject<Route>();
        this.actions$ = Rx.merge(passive$, this.active$);
    }

    start<TAction, TActionResult extends ActionResult>(rootActionResult: TActionResult, viewEngine: ViewEngine<TAction, TActionResult>): Rx.Observable<Activation> {
        const router = this;

        function resolveRoute(resolver: ActionResolver<TAction>, route: Route): Rx.Observable<ActionResolution<TAction>> {
            return toObservable(resolver && resolver(route));
        }

        const routeCache = new ChainCache<RouteResult<TActionResult>>(d => {
            return d && d.actionResult && d.actionResult.dispose();
        });

        function expandRoute(routeEntry: RouteEntry<TAction, TActionResult>, routeIndex: number): Rx.Observable<RouteEntry<TAction, TActionResult>> {
            const { remainingRoute, resolver } = routeEntry;

            if (remainingRoute.length === 0) {
                return Rx.empty();
            }

            return resolveRoute(resolver, remainingRoute)
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
                        const url: UrlHelper = new UrlHelper(router, appliedRoute, routeEntry.url);

                        if (next && routeCompare(next.appliedRoute, appliedRoute)) {
                            return Rx.of(<RouteEntry<TAction, TActionResult>>{
                                action,
                                routeResult: next,
                                url,
                                remainingRoute: nextRemainingRoute,
                                resolver: viewEngine.actionResolver(action)
                            });
                        }

                        try {
                            let nextResult$ = viewEngine.execute(resolution.action, { url, params: resolution.params });

                            return toObservable(nextResult$)
                                .pipe(
                                    Ro.map(nextResult => {
                                        const nextRouteResult = routeResult(appliedRoute, nextResult);
                                        routeCache.setAt(routeIndex, nextRouteResult);
                                        const nextRouteEntry: RouteEntry<TAction, TActionResult> = {
                                            action,
                                            routeResult: nextRouteResult,
                                            url,
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
                )

                function catchError(error) {
                    viewEngine.catch(error, remainingRoute, routeEntry)

                    return Rx.of(<RouteEntry<TAction, TActionResult>>{
                        ...routeEntry,
                        remainingRoute: []
                    });
                }
        }

        const rootRouteResult = routeResult([], rootActionResult);
        const rootUrl = new UrlHelper(this, []);

        return router.actions$
            .pipe(
                Ro.distinctUntilChanged(routeCompare),
                Ro.switchMap((remainingRoute) => {
                    var rootEntry = <RouteEntry<TAction, TActionResult>>{
                        url: rootUrl,
                        appliedRoute: [],
                        routeResult: rootRouteResult,
                        remainingRoute,
                        resolver: viewEngine.resolve
                    };

                    return Rx.of(rootEntry).pipe(
                        Ro.expand(expandRoute),
                        Ro.filter(entry => entry.remainingRoute.length === 0 /* is last entry */),
                        Ro.map(entry => router.activate(entry.routeResult.actionResult, entry.url.toAbsolute()))
                    );
                }),
                Ro.reduce((old, active) => {
                    old && old.deactivate();
                    return active;
                })
            );
    }

    activate(actionResult: ActionResult, route: Route): Activation {
        if (actionResult && actionResult.activate) {
            const subscriptions = actionResult.activate();
            if (Array.isArray(subscriptions)) {
                if (subscriptions.length > 0)
                    return new Activation(subscriptions)
            } else if (subscriptions) {
                return new Activation([subscriptions])
            }
        }
        return null;
    }

    public push(route: string | Route) {
        if (typeof route === "string") {
            this.active$.next(route.split('/').filter(x => !!x));
        } else {
            this.active$.next(route);
        }
    }
}

function uid(): string {
    return new Date().getTime().toString();
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

export function toObservable<T>(input: T | Rx.ObservableInput<T>): Rx.Observable<T> {
    if (input === null && input === void 0) {
        return Rx.of(input as T);
    } else if (Rx.isObservable<T>(input)) {
        return input;
    } else if (isInteropObservable(input)) {
        return fromObservable(input, null);
    } else if (isPromise(input)) {
        return fromPromise(input);
    } else {
        return Rx.of(input as T);
    }
}

export type RouteEntry<TAction, TActionResult> = {
    action?: TAction,
    routeResult?: RouteResult<TActionResult>,
    remainingRoute: Route;
    url: UrlHelper,
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

export interface ViewEngine<TAction, TActionResult> {
    execute(action: TAction, context: IActionContext): TActionResult | Rx.ObservableInput<TActionResult>;
    actionResolver(action: TAction): ActionResolver<TAction>;
    resolve(route: Route): ActionResolution<TAction> | Rx.ObservableInput<ActionResolution<TAction>> | null;
    catch(error: Error, route: Route, context: RouteEntry<TAction, TActionResult>);
}

export type ActionResolver<TAction> = (route: Route) => ActionResolution<TAction> | Rx.ObservableInput<ActionResolution<TAction>> | null;

export class Activation {
    constructor(public subscriptions: Subscription[]) {
    }

    deactivate() {
        const { subscriptions } = this;
        for (var i = 0; i < subscriptions.length; i++) {
            subscriptions[i].unsubscribe();
        }
    }
}
