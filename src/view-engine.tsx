import actionResolver from "./action-resolver";
import { toObservable, IViewEngine, RouteEntry } from "./router";
import { IActionContext, ActionResolver, Route, IAction, ActionResolution } from "./action";
import * as Rx from "rxjs";
import * as Ro from "rxjs/operators";

export class ViewEngine<T, TViewResult extends ActionResult> implements IViewEngine<IAction<T>, TViewResult> {

    constructor(
        public execute: (action: ((context: IActionContext) => T) | IAction<T>, context: IActionContext) => TViewResult | Rx.Observable<TViewResult>, 
        public rootResolve: ActionResolver<IAction<T>>, 
        public actionContext?: any) {
    }

    resolveRoute(action: IAction<T>, route: Route, context: IActionContext): Rx.Observable<ActionResolution<IAction<T>>> {
        const resolver: ActionResolver<IAction<T>> = this.actionResolver(action);
        return toObservable(resolver && resolver.call(null, route, context));
    }

    actionResolver(action: IAction<T>): ActionResolver<IAction<T>> {
        const d: any = actionResolver<IAction<T>>(action.resolve)
        return d;
    }

    catch(error: Error, route: Route, context: RouteEntry<IAction<T>, TViewResult>) {
        console.error(error);
    }

    activate(actionResult: TViewResult): Rx.Unsubscribable | Rx.Unsubscribable[] {
        return actionResult && actionResult.activate();
    }
}

type ActionResult = { activate?(): Rx.Unsubscribable | Rx.Unsubscribable[] }
