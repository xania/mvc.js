import { IActionContext } from "./action";

type Route = any[];
type ActionResolution<TAction> = {
    action: TAction,
    appliedRoute: Route,
    remainingRoute: Route,
    params: { [key: string]: any }
};
type ResolutionParams = { [key: string]: any };
type PathTemplate = string | RegExp;
type MappingMatch = { appliedRoute: Route, params: ResolutionParams };
type MaybePromise<T> = T | Promise<T>;
type RouteMapping<TAction> = { match: RouteResolver, action: MaybePromise<TAction> };
type PathResolver = (path: any) => boolean | { [key: string]: any };
type RouteResolver = (route: Route, context: IActionContext) => false | MappingMatch;
type RouteTemplate = PathTemplate[];

type ActionResolver<TAction> = (route: Route, context: IActionContext) => ActionResolution<TAction> | Promise<ActionResolution<TAction>> | null;

type RouteResolverInput = RouteResolver | RouteTemplate;
type RouteMappingInput<T> = RouteMapping<T> | [RouteResolverInput, MaybePromise<T> ]
type RouteMappingObject<T> = { [route: string]: MaybePromise<T> };
type ActionResolverInput<T> = ActionResolver<T> | RouteMappingInput<T>[] | RouteMappingObject<T>

export default function actionResolver<TAction>(input: ActionResolverInput<TAction>): ActionResolver<TAction> {
    if (typeof input === "function")
        return input;
    if (Array.isArray(input)) {
        const mappings = input.map(mappingFromInput);
        return function (route: Route, context: IActionContext) {
            for (var i = 0; i < mappings.length; i++) {
                var mapping = mappings[i];
                var match = mapping.match(route, context);
                if (match) {
                    return {
                        action: mapping.action,
                        remainingRoute: route.slice(match.appliedRoute.length),
                        ...match
                    } as ActionResolution<TAction>;
                }
            }
            return null;
        }
    } else {
        return fromObject<TAction>(input);
    }

    function mappingFromInput(mapping: RouteMappingInput<TAction>) {
        if(Array.isArray(mapping)) {
            const resolver = typeof mapping[0] === "function" ? mapping[0] : routeResolver(mapping[0]);
            return routeMapping(resolver, mapping[1]);
        }
        return mapping;
    }
}

export function routeMapping<TAction>(resolver: RouteResolver, action: MaybePromise<TAction>): RouteMapping<TAction> {
    return {
        match(route: Route, context: IActionContext) {
            return resolver(route, context);
        },
        action
    };
}

export function routeResolver(routeTemplate: RouteTemplate): RouteResolver {
    var pathResolvers = routeTemplate.map(pathResolver);
    return function (route: Route, context: IActionContext) {
        var params: ResolutionParams = {};
        for (let i = 0; i < pathResolvers.length; i++) {
            let path = route[i];
            let pathResolver = pathResolvers[i];
            var match = pathResolver(path);
            if (typeof match === "object") {
                params = { ...params, ...match };
            } else if (!match) {
                return false;
            }
        }
        return { appliedRoute: route.slice(0, routeTemplate.length), params };
    }
}

export function pathResolver(pathTemplate: PathTemplate): PathResolver {
    if (typeof pathTemplate === "string" && pathTemplate.startsWith(":")) {
        var key = pathTemplate.substr(1)
        return (path: any) => {
            return { [key]: path };
        }
    } else if (pathTemplate instanceof RegExp) {
        return (path: any) => {
            return pathTemplate.test(path);
        }
    } else {
        return (path: any) => {
            if (pathTemplate !== path) {
                return false;
            } else {
                return true 
            }
        }
    }
}

function fromObject<TAction>(mappings: RouteMappingObject<TAction>): ActionResolver<TAction> {
    if (mappings) {
        const normalized = Object.keys(mappings).map(fromProperty)
        return actionResolver(normalized);
    }
    return null;

    function fromProperty(key: string) {
        let route = routeResolver(key.split('/'))
        let action = mappings[key];
        return routeMapping(route, action);
    }
}
