import { IAction, ActionResolution, actionResolver, ActionResolverInput, IActionContext, Route } from "./action.js"

const dynamicImport = (0, eval)('u=>import(u)');
export function controllerAction<T>(modulePath: string, actionName?: string, defaultResolver?: ActionResolverInput<IAction<T>>) {
    return {
        async execute(context: IActionContext): Promise<T> {
            try {
                var module = await dynamicImport(modulePath)
                var actionNames = [actionName, "default", "execute"];

                for (var an of actionNames) {
                    const execute = module[an];
                    if (execute && typeof execute === "function")
                        return execute(context);
                }
                return null;
            }
            catch (ex) {
                console.error(ex);
            }
        },
        async resolve(route: Route): Promise<ActionResolution<IAction<T>>> {
            if (!route || route.length === 0)
                return null;

            var module = await dynamicImport(modulePath)
            var actionNames = Object.keys(module).filter(a => a && a !== "default" && typeof module[a] === "function")

            return resolve(route);

            function resolve(route: Route) {
                for (var actionName of actionNames.filter(a => a.toLowerCase() === route[0].toLowerCase())) {
                    const action: IAction<T> = {
                        execute: module[actionName],
                        resolve
                    }
                    return {
                        action,
                        appliedRoute: [actionName],
                        remainingRoute: route.slice(1),
                        params: {}
                    }
                }

                var moduleResolve = actionResolver<IAction<T>>(module["resolve"]);
                if (moduleResolve) {
                    const resolution = moduleResolve(route) as ActionResolution<IAction<T>>;
                    return resolution;
                }
                if (defaultResolver) {
                    const res = actionResolver(defaultResolver);
                    return res(route) as ActionResolution<IAction<T>>;
                }
            }
        }
    }
}