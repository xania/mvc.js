// import { IAction, ActionResolution, ActionResolverInput, IActionContext, Route } from "./action"

// type ModuleFactory = () => Promise<any>

// export function module<T>(factory: ModuleFactory, defaultResolver?: ActionResolverInput<IAction<T>>) {
//     return {
//         async execute(context: IActionContext): Promise<T> {
//             try {
//                 var module = await factory();
//                 var actionNames = ["default"];

//                 for (var an of actionNames) {
//                     const execute = module[an];
//                     if (execute && typeof execute === "function")
//                         return execute(context);
//                 }
//                 return null;
//             }
//             catch (ex) {
//                 console.error(ex);
//             }
//         },
//         async resolve(route: Route, parentContext: IActionContext): Promise<ActionResolution<IAction<T>>> {
//             if (!route || route.length === 0)
//                 return null;

//             var module = await factory();
//             var actionNames = Object.keys(module).filter(a => a && a !== "default" && typeof module[a] === "function")

//             return resolve(route, parentContext);

//             function resolve(route: Route, parentContext: IActionContext) {
//                 for (var actionName of actionNames.filter(a => a.toLowerCase() === route[0].toLowerCase())) {
//                     const action: IAction<T> = {
//                         execute: module[actionName],
//                         resolve
//                     }
//                     return {
//                         action,
//                         appliedRoute: [actionName],
//                         remainingRoute: route.slice(1),
//                         params: {}
//                     }
//                 }

//                 var moduleResolve = actionResolver<IAction<T>>(module["resolve"]);
//                 if (moduleResolve) {
//                     const resolution = moduleResolve(route, parentContext) as ActionResolution<IAction<T>>;
//                     return resolution;
//                 }
//                 if (defaultResolver) {
//                     const res = actionResolver.call(null, defaultResolver);
//                     return res(route, parentContext) as ActionResolution<IAction<T>>;
//                 }
//             }
//         }
//     }
// }

// export function controllerAction<T>(modulePath: string, actionName?: string, defaultResolver?: ActionResolverInput<IAction<T>>) {
//     return {
//         async execute(context: IActionContext): Promise<T> {
//             try {
//                 var module = await import(modulePath)
//                 var actionNames = [actionName, "default", "execute"];

//                 for (var an of actionNames) {
//                     const execute = module[an];
//                     if (execute && typeof execute === "function")
//                         return execute(context);
//                 }
//                 return null;
//             }
//             catch (ex) {
//                 console.error(ex);
//             }
//         },
//         async resolve(route: Route, parentContext: IActionContext): Promise<ActionResolution<IAction<T>>> {
//             if (!route || route.length === 0)
//                 return null;

//             var module = await import(modulePath)
//             var actionNames = Object.keys(module).filter(a => a && a !== "default" && typeof module[a] === "function")

//             return resolve(route, parentContext);

//             function resolve(route: Route, parentContext: IActionContext) {
//                 for (var actionName of actionNames.filter(a => a.toLowerCase() === route[0].toLowerCase())) {
//                     const action: IAction<T> = {
//                         execute: module[actionName],
//                         resolve
//                     }
//                     return {
//                         action,
//                         appliedRoute: [actionName],
//                         remainingRoute: route.slice(1),
//                         params: {}
//                     }
//                 }

//                 var moduleResolve = actionResolver<IAction<T>>(module["resolve"]);
//                 if (moduleResolve) {
//                     const resolution = moduleResolve(route, parentContext) as ActionResolution<IAction<T>>;
//                     return resolution;
//                 }
//                 if (defaultResolver) {
//                     const res = actionResolver.call(null, defaultResolver);
//                     return res(route, parentContext) as ActionResolution<IAction<T>>;
//                 }
//             }
//         }
//     }
// }
