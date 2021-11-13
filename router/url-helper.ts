export interface Navigator {
  execute(path: string[]);
}

/* deze gebruiken */
export class UrlHelper {
  constructor(
    public navigator: Navigator,
    public path: string[],
    public parent?: UrlHelper
  ) {}

  stringify(...path: string[]) {
    const result = fullPath(this);
    result.push.apply(result, path);
    return "/" + result.join("/");
  }

  route(...path: string[]) {
    const result = fullPath(this);
    result.push.apply(result, path);
    return result;
  }

  navigate = (...path: string[]) => {
    const route = this.route(...path);
    this.navigator.execute(route);
  };
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
