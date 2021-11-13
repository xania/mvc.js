import { IActionContext } from "./action";
import { MaybePromise } from "./types";

type Route = any[];
type ActionResolution<TAction> = {
  action: TAction;
  appliedRoute: Route;
  remainingRoute: Route;
  params: { [key: string]: any };
};

type ResolutionParams = { [key: string]: any };
type PathTemplate = string | RegExp;
type MappingMatch = { appliedRoute: Route; params: ResolutionParams };
type RouteMapping<TAction> = {
  match: RouteResolver;
  action: MaybePromise<TAction>;
};
type PathResolver = (path: any) => boolean | { [key: string]: any };
type RouteResolver = (
  route: Route,
  context: IActionContext
) => false | MappingMatch;
type RouteTemplate = PathTemplate[];

type ActionResolver<TAction> = (
  route: Route,
  context: IActionContext
) => ActionResolution<TAction> | Promise<ActionResolution<TAction>> | null;

type RouteResolverInput = RouteResolver | RouteTemplate;
type RouteMappingInput<T> =
  | RouteMapping<T>
  | [RouteResolverInput, MaybePromise<T>];
type RouteMappingObject<T> = { [route: string]: MaybePromise<T> };
type ActionResolverInput<T> =
  | ActionResolver<T>
  | RouteMappingInput<T>[]
  | RouteMappingObject<T>;

export function combine<TAction>(
  ...resolvers: ActionResolver<TAction>[]
): ActionResolver<TAction> {
  return (route: Route, context: IActionContext) => {
    return tryResolve(route, context, 0);
  };

  function tryResolve(route: Route, context: IActionContext, index: number) {
    var resolver = resolvers[index];
    if (!resolver) return null;

    var resolution = resolver(route, context);
    if (!resolution) return tryResolve(route, context, index + 1);

    if (isPromise(resolution)) {
      return resolution.then((r) => {
        return r || tryResolve(route, context, index + 1);
      });
    }

    return resolution;
  }

  function isPromise(value): value is PromiseLike<unknown> {
    return (
      !!value &&
      typeof value.subscribe !== "function" &&
      typeof value.then === "function"
    );
  }
}

export function routeMapping<TAction>(
  resolver: RouteResolver,
  action: MaybePromise<TAction>
): RouteMapping<TAction> {
  return {
    match(route: Route, context: IActionContext) {
      return resolver(route, context);
    },
    action,
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
  };
}

export function pathResolver(pathTemplate: PathTemplate): PathResolver {
  if (typeof pathTemplate === "string" && pathTemplate.startsWith(":")) {
    var key = pathTemplate.substr(1);
    return (path: any) => {
      return { [key]: path };
    };
  } else if (pathTemplate instanceof RegExp) {
    return (path: any) => {
      return pathTemplate.test(path);
    };
  } else {
    return (path: any) => {
      if (pathTemplate !== path) {
        return false;
      } else {
        return true;
      }
    };
  }
}
