import { createRouter, createMapping, createAction } from "../router";

describe("route match", () => {
    test("traverse", (done) => {
        const init = {
            appliedRoute: ["a"],
            params: {},
            action: createAction(1),
        };

        const mappings = [createMapping(["a"], createAction(2))];

        const router = createRouter(mappings);
        router.start({ head: init }).subscribe((x) => {
            expect(x.head.action).toBe(init.action);
            done();
        });
        router.next(["a", "b", "c"]);
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
