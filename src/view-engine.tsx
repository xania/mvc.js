import actionResolver from "./action-resolver";
import { toObservable, IViewEngine, RouteEntry } from "./router";
import { IActionContext, ActionResolver, Route, IAction } from "./action";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export class ViewEngine<TAction extends IAction<any>, TViewResult> implements IViewEngine<TAction, TViewResult> {

    constructor(public asActionResult: (a:any) => TViewResult, public resolve: ActionResolver<TAction>, public actionContext?: any) {
    }

    execute(action: ((context: IActionContext) => any) | TAction, context: IActionContext): Observable<TViewResult> {
        const actionContext: IActionContext = { ...context, ...(this.actionContext || {}) };
        const actionResult: any = action && (
            (typeof action === "function")
                ? action(actionContext)
                : action.execute(actionContext)
        );

        return toObservable(actionResult).pipe(
            map(this.asActionResult)
        )
    }

    actionResolver(action: TAction): ActionResolver<TAction> {
        return actionResolver<TAction>(action.resolve)
    }

    catch(error: Error, route: Route, context: RouteEntry<TAction, TViewResult>) {
        console.error(error);
    }
}

