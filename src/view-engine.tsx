import actionResolver from "./action-resolver";
import { toObservable, IViewEngine, RouteEntry, Activation } from "./router";
import { IActionContext, ActionResolver, Route, IAction } from "./action";
import * as Rx from "rxjs";
import * as Ro from "rxjs/operators";

export class ViewEngine<T, TViewResult extends ActionResult> implements IViewEngine<IAction<T>, TViewResult> {

    constructor(public asActionResult: (a:any) => TViewResult, public rootResolve: ActionResolver<IAction<T>>, public actionContext?: any) {
    }

    execute(action: ((context: IActionContext) => T) | IAction<T>, context: IActionContext): Rx.Observable<TViewResult> {
        const actionContext: IActionContext = { ...context, ...(this.actionContext || {}) };
        const actionResult: any = action && (
            (typeof action === "function")
                ? action(actionContext)
                : action.execute(actionContext)
        );

        return toObservable(actionResult).pipe(
            Ro.map(this.asActionResult)
        )
    }

    actionResolver(action: IAction<T>): ActionResolver<IAction<T>> {
        return actionResolver<IAction<T>>(action.resolve)
    }

    catch(error: Error, route: Route, context: RouteEntry<IAction<T>, TViewResult>) {
        console.error(error);
    }

    activate(actionResult: TViewResult): Rx.Unsubscribable | Rx.Unsubscribable[] {
        return actionResult && actionResult.activate();
    }
}

type ActionResult = { activate?(): Rx.Unsubscribable | Rx.Unsubscribable[] }

