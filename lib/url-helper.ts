import { Route } from "./action.js";
declare type RouterLike = {
    execute(route: Route): any;
};

export interface Link {
    route(): Route;
    toString(): string;
    go(): any;
    relative(...route: Route): Link;
}

export default class UrlHelper {
    constructor(
        public router: RouterLike,
        public fullRoute: Route,
        public i: number,
        public owner: UrlHelper = null
    ) {
        if (!router) {
            throw "argument 'router' is null";
        }
    }

    createChild(relativeRoute: Route) {
        return new UrlHelper(
            this.router,
            this.toAbsolute(relativeRoute),
            0,
            this
        );
    }

    relative(...relativeRoute: Route) {
        return this.absolute(...this.toAbsolute(relativeRoute));
    }

    absolute(...route: Route): Link {
        let { router } = this;
        function execute() {
            router.execute(route);
        }
        execute.go = execute;
        execute.route = () => route;
        execute.toString = () => {
            return "/" + route.join("/");
        };
        execute.relative = (...relativeRoute: Route) => {
            return this.absolute(...route, ...relativeRoute);
        };
        return execute;
    }

    toAbsolute(relativeRoute: Route = []) {
        return [...this.fullRoute, ...relativeRoute];
    }

    get self(): Link {
        return this.absolute(...this.fullRoute);
    }

    get parent(): Link {
        const { owner } = this;
        return owner && owner.self;
    }
}
