import { createRouter, Route, ViewResolution } from "../router";
import * as Ro from "rxjs/operators";
import { UrlHelper } from "../router/url-helper";

interface Action {
  view: any;
  routes: Route<Action>[];
}

export function createAction(view: any, routes?: Route<Action>[]): Action {
  return {
    view,
    routes,
  };
}

function executeAction(resolution: ViewResolution<Action>, url: UrlHelper) {
  return {
    dispose() {
      console.log("dispose");
    },
  };
}

describe("route match", () => {
  test("traverse", (done) => {
    const routes = [
      {
        path: ["a"],
        view: createAction(2),
      },
    ];

    // const router = createRouter(null, null, routes);
    // router
    //   .start(executeAction)
    //   .pipe(Ro.skip(1))
    //   .subscribe((results) => {
    //     expect(results.length).toBe(2);
    //     done();
    //   });
  });

  // test("no mappings", () => {
  //     const resolveRoute = createRouteResolver([]);
  //     const route = ["a", "b", "d"];
  //     const resolution = resolveRoute(route);
  //     expect(resolution.remainingRoute).toHaveLength(3);
  // });

  // test("incomplete match", () => {
  //     const resolveRoute = createRouteResolver([
  //         createMapping(["a"], action(133)),
  //     ]);
  //     const resolution = resolveRoute(["a", "b", "d"]);
  //     expect(resolution.remainingRoute).toHaveLength(2);
  // });

  // test("catched match", () => {
  //     const resolveRoute = createRouteResolver([
  //         createMapping(["a"], action(133)),
  //     ]);
  //     const res1 = resolveRoute(["a", "b", "d"]);
  //     const res2 = resolveRoute(["a", "b", "d"]);
  //     expect(res1.segments[0].action).toBe(res2.segments[0].action);
  // });

  // test("multi level", () => {
  //     const resolveRoute = createRouteResolver([
  //         createMapping(
  //             ["a"],
  //             action(133, [
  //                 createMapping(
  //                     ["b"],
  //                     action(456, [createMapping(["d"], action(789))])
  //                 ),
  //             ])
  //         ),
  //     ]);
  //     const resolution = resolveRoute(["a", "b", "d"]);
  //     expect(resolution.remainingRoute).toHaveLength(0);
  // });
});
