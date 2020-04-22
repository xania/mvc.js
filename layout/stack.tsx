import { Router } from "../lib/router";
import {
    ActionResolver,
    IAction,
    IActionContext,
    ActionNotFound,
} from "../lib/action";
import { ViewEngine } from "../lib/view-engine";
import tpl, {
    asTemplate,
    ITemplate,
    disposeMany,
    Binding,
    render,
    DomDriver,
    init,
} from "glow.js";
import { BrowserRouter } from "../lib/browser-router";

interface OutletProps {
    resolveModule: ActionResolver<IAction<any>>;
    [key: string]: any;
}

export function RouterOutlet(props: OutletProps) {
    const { resolveModule, ...rest } = props;

    const router = new BrowserRouter();

    return [router, init(<div {...rest}></div>, startRouter)];

    function startRouter(dom: any) {
        const viewEngine = new ViewEngine(executeAction, resolveModule, {});
        return router.start(viewEngine).subscribe();

        function executeAction(action: any, context: IActionContext) {
            const actionContext: IActionContext = context;
            const actionResult: any =
                action &&
                (typeof action === "function"
                    ? action(actionContext)
                    : action.execute(actionContext));

            return SectionResult.create(dom, actionResult);
        }
    }
}

class SectionResult {
    constructor(public target: HTMLElement, public disposables: Binding[]) {}

    static create(dom: any, actionResult: any) {
        let target = null;
        const template = init(
            <Section>{asTemplate(actionResult)}</Section>,
            (x) => {
                target = x;
            }
        );
        const disposables = renderPage(dom, template);

        return new SectionResult(target, disposables);
    }

    activate() {
        const { target } = this;
        target.classList.add("router-page--active");
        return {
            unsubscribe() {
                target.classList.remove("router-page--active");
            },
        };
    }

    dispose() {
        const { disposables } = this;
        disposeMany(disposables);
    }
}

function Section(props: {}, children: any[]) {
    return (
        <section class="router-page">
            <div class="router-page__content">{children}</div>
        </section>
    );
}

const renderPage = (target: HTMLElement, result: ITemplate): Binding[] => {
    if (result instanceof ActionNotFound) {
        return null;
    } else {
        var driver = new ReverseDriver(target);
        return render(driver, asTemplate(result));
    }
};

class ReverseDriver extends DomDriver {
    constructor(public target: HTMLElement) {
        super(target);
    }

    appendChild(child: HTMLElement) {
        this.target.insertBefore(child, this.target.firstChild);
    }
}

declare global {
    namespace JSX {
        interface IntrinsicElements {
            [tag: string]: any;
        }
    }
}
