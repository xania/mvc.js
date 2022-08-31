import { ViewContext, createRouter, Router, Resolved } from "../router";
import "./outlet.scss";
import * as Rx from "rxjs";
import { UrlHelper } from "../router/url-helper";

interface RouterOutletProps<TView> {
  router: Router<TView>;
  loader?: any;
  onResolved?: (paths: string[][]) => void;
}
function render(arg1, arg2) {
  console.log({ arg1, arg2 });
}
interface RenderTarget {}

export function RouterOutlet<TView>(props: RouterOutletProps<TView>) {
  return {
    render(target: RenderTarget) {
      const childRoutes$ = new Rx.BehaviorSubject<string[]>([]);
      const { router, onResolved } = props;
      const subsc = router.start(executeView).subscribe({
        next([viewResults, remaining]) {
          childRoutes$.next(remaining);
          if (typeof onResolved !== "function") {
            return;
          }
          if (viewResults instanceof Array && viewResults.length > 0) {
            onResolved(viewResults.map((e) => e.url.path));
          } else {
            onResolved([]);
          }
        },
      });
      return {
        dispose() {
          subsc.unsubscribe();
        },
      };

      function executeView(resolution: Resolved<unknown>, url: UrlHelper) {
        const { view, params } = resolution;

        const context = {
          url,
          params,
          childRouter(map) {
            return createRouter(router.navigator, childRoutes$, map, this);
          },
        };
        const templates = applyChild(view, context);
        //         const scope = driver.createScope();
        const bindings = render(target, templates);
        return {
          dispose() {
            // disposeMany(bindings);
            // scope.dispose();
          },
        };
      }
    },
  };
}

function applyChild(child, context: ViewContext) {
  return typeof child === "function" ? child(context) : child;
}

// function withLoader(templates: any[], loader: any) {
//   const promises = templates.filter(isPromise);
//   if (promises.length == 0) {
//     return templates;
//   }

//   return asTemplate(Rx.forkJoin(promises).pipe(Ro.startWith(loader)));
// }

function isPromise(x): x is Promise<any> {
  return !!x && typeof x.then == "function";
}
