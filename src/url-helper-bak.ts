type RouterLike = {
    action(route: any[])
}

type Route = any[];

export default class Urlhelper {
    constructor(public router: RouterLike, public baseRoute: Route) {

    }

    get parent() {
        return link(this.router, this.baseRoute.slice(0, this.baseRoute.length - 1));
    }

    get self() {
        return link(this.router, this.baseRoute);
    }

    partial(route: string | Route) {
        return link(this.router, toAbsolute(this.baseRoute, route));
    }

    scope(partial: string | Route) {
        const route = toAbsolute(this.baseRoute, partial);
        return new Urlhelper(this.router, route);
    }
}

function link(router: RouterLike, route: Route) {
    return {
        route,
        go() {
            router.action(route);
        }
    }
}

function toAbsolute(baseRoute: Route, partialRoute: string | Route) {
    if (typeof partialRoute === "string") {
        if (partialRoute.startsWith("/")) {
            return partialRoute.split("/").filter(x => !!x);
        }
        return baseRoute.concat(partialRoute.split("/").filter(x => !!x));
    } else {
        return baseRoute.concat(partialRoute);
    }
}