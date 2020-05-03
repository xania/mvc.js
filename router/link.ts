export function LinkListener() {
    return {
        attachTo(dom: HTMLElement) {
            return addClickListener(dom);
        },
    };
}

function addClickListener(selectors: string | HTMLElement) {
    const target =
        typeof selectors === "string"
            ? document.querySelector(selectors)
            : selectors;
    target.addEventListener("click", routerClick);
    return {
        dispose() {
            target.removeEventListener("click", routerClick);
        },
    };

    function routerClick(event: any) {
        if (event.target) {
            let anchor: HTMLAnchorElement = event.target.closest("a");

            if (anchor && anchor.classList.contains("router-link")) {
                event.preventDefault();
                const href = anchor.getAttribute("href");

                if (
                    href &&
                    anchor["pathname"] &&
                    location.host === anchor["host"]
                ) {
                    const pathname = anchor["pathname"];
                    pushPath(pathname);
                    // router.execute(pathname);
                    // subject.next(pathname);

                    event.returnValue = false;
                    return false;
                }
            }
        }
    }
}

function pushPath(pathname: string) {
    let { pathname: old } = window.location;

    if (old + "/" === pathname) {
        console.log("replaceState", pathname);
        window.history.replaceState(null, null, pathname);
    } else if (old !== pathname) {
        window.history.pushState(null, null, pathname);
    } else {
        // console.error("same as ", pathname);
    }
}
