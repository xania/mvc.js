import { IDriver, disposeMany } from "glow.js";
import { asTemplate, flatTree, render, renderMany } from "glow.js/lib/tpl";
import { ViewContext, createRouter, Router, Resolved } from "../router";
import "./outlet.scss";
import * as Rx from "rxjs";
import * as Ro from "rxjs/operators";
import { UrlHelper } from "../router/url-helper";

interface RouterOutletProps<TView> {
  router: Router<TView>;
  loader?: any;
  onResolved?: (paths: string[][]) => void;
}

export function RouterOutlet<TView>(
  props: RouterOutletProps<TView>,
  children: any[]
) {
  return {
    render(driver: IDriver) {
      const classBinding = driver.createAttribute("class", [
        "router-outlet-container",
      ]);

      const childRoutes$ = new Rx.BehaviorSubject<string[]>([]);
      const { router, onResolved } = props;
      const subsc = router.start(executeView).subscribe({
        next([viewResults, remaining]) {
          childRoutes$.next(remaining);

          if (typeof onResolved !== "function") {
            return;
          }
          if (Array.isArray(viewResults) && viewResults.length > 0) {
            onResolved(viewResults.map((e) => e.url.path));
          } else {
            onResolved([]);
          }
        },
      });
      return {
        dispose() {
          subsc.unsubscribe();
          classBinding.dispose();
        },
      };

      function executeView(resolution: Resolved<unknown>, url: UrlHelper) {
        const { view, params } = resolution;

        const context = {
          url,
          params,
          childRouter(map) {
            return createRouter(childRoutes$, map, this);
          },
        };
        const templates = flatTree([...children, view], (item) =>
          applyChild(item, context)
        );
        const scope = driver.createScope();
        const bindings = render(
          scope,
          withLoader(templates, props.loader || "loading...")
        );
        return {
          dispose() {
            disposeMany(bindings);
            scope.dispose();
          },
        };
      }
    },
  };
}

function applyChild(child, context: ViewContext) {
  return typeof child === "function" ? child(context) : child;
}

function withLoader(templates: any[], loader: any) {
  const promises = templates.filter(isPromise);
  if (promises.length == 0) {
    return templates;
  }

  return asTemplate(Rx.forkJoin(promises).pipe(Ro.startWith(loader)));
}

function isPromise(x): x is Promise<any> {
  return !!x && typeof x.then == "function";
}
