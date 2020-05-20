export class UrlHelper {
    constructor(public path: string[], public parent?: UrlHelper) {}

    route(...path: string[]) {
        const result = fullPath(this);
        result.push.apply(result, path);
        return "/" + result.join("/");
    }
}

function fullPath(url: UrlHelper) {
    const stack: UrlHelper[] = [];
    while (url) {
        stack.push(url);
        url = url.parent;
    }

    const result: string[] = [];
    while (stack.length) {
        const curr = stack.pop();
        result.push.apply(result, curr.path);
    }
    return result;
}