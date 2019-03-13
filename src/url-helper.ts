import { Route } from "./action.js"
declare type RouterLike = { push(route: Route) }

export interface Link {
    route(): Route;
    toString(): string;
    go(): any;
}

export default class UrlHelper {
    constructor(public router: RouterLike, public route: Route, public owner: UrlHelper = null) {
        if (!router)
            throw "argument 'router' is null"
    }

    relative(...route: Route) {
        let { router } = this;
        let self = this;

        function execute() {
            router.push(toAbsolute(route));
        }
        // compat
        execute.go = execute;
        execute.route = () => {
            return toAbsolute(route);
        }
        execute.toString = () => {
            return "/" + toAbsolute(route).join("/");
        }
        return execute;

        function toAbsolute(route: Route) {
            let stack = [route];
            let url: UrlHelper = self;
            while (url) {
                stack.push(url.route);
                url = url.owner;
            }
            const retval = [];
            for (var i = stack.length - 1; i >= 0; i--) {
                retval.push.apply(retval, stack[i]);
            }
            return retval;
        }
    }

    absolute(...route: Route): Link {
        let { router } = this;
        function execute() {
            router.push(route);
        }
        execute.go = execute;
        execute.route = () => route;
        execute.toString = () => { 
            return "/" + route.join("/")
        };
        return execute;
    }

    toAbsolute() {
        let stack = [];
        let url: UrlHelper = this;
        while (url) {
            stack.push(url.route);
            url = url.owner;
        }
        const retval = [];
        for (var i = stack.length - 1; i >= 0; i--) {
            retval.push.apply(retval, stack[i]);
        }
        return retval;
    }

    get self(): Link {
        return this.absolute(...this.toAbsolute());
    }

    get parent(): Link {
        const { owner } = this;
        return owner && owner.self;
    }

}
