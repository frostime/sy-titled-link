import * as siyuan from "siyuan";
import { forwardProxy } from "./api";
// import iconv from "iconv-lite";

import { SettingUtils } from "./libs/setting-utils";

const IconUrl = `
<symbol id="iconUrl" viewBox="0 0 1024 1024"><path d="M578.133 675.627c-3.306-3.307-8.746-3.307-12.053 0L442.133 799.573c-57.386 57.387-154.24 63.467-217.6 0-63.466-63.466-57.386-160.213 0-217.6L348.48 458.027c3.307-3.307 3.307-8.747 0-12.054l-42.453-42.453c-3.307-3.307-8.747-3.307-12.054 0L170.027 527.467c-90.24 90.24-90.24 236.266 0 326.4s236.266 90.24 326.4 0L620.373 729.92c3.307-3.307 3.307-8.747 0-12.053l-42.24-42.24z m275.84-505.6c-90.24-90.24-236.266-90.24-326.4 0L403.52 293.973c-3.307 3.307-3.307 8.747 0 12.054l42.347 42.346c3.306 3.307 8.746 3.307 12.053 0l123.947-123.946c57.386-57.387 154.24-63.467 217.6 0 63.466 63.466 57.386 160.213 0 217.6L675.52 565.973c-3.307 3.307-3.307 8.747 0 12.054l42.453 42.453c3.307 3.307 8.747 3.307 12.054 0l123.946-123.947c90.134-90.24 90.134-236.266 0-326.506z"></path><path d="M616.64 362.987c-3.307-3.307-8.747-3.307-12.053 0l-241.6 241.493c-3.307 3.307-3.307 8.747 0 12.053l42.24 42.24c3.306 3.307 8.746 3.307 12.053 0L658.773 417.28c3.307-3.307 3.307-8.747 0-12.053l-42.133-42.24z"></path>
</symbol>
`;


const isDesktop = (): boolean => {
    return typeof window !== 'undefined' && !!window.require;
};

const getTitle = async (href: string): Promise<string | null> => {
    let title = null;

    // Normalize URL
    if (href.startsWith("www.")) {
        href = "https://" + href;
    } else if (!href.startsWith("http")) {
        return null;
    }

    try {
        let html: string;
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.76";

        if (!isDesktop()) {
            // 浏览器环境必须依赖内核 API
            const data = await forwardProxy(
                href, 'GET', null,
                [{ 'User-Agent': userAgent }],
                5000, 'text/html'
            );

            if (!data || (data.status / 100) !== 2) {
                return null;
            }
            html = data?.body;
        } else {
            const response = await fetch(href, {
                method: 'GET',
                headers: {
                    'User-Agent': userAgent
                },
                redirect: 'follow'
            });

            if (!response.ok) {
                return null;
            }
            html = await response.text();
        }

        // Common HTML parsing logic
        const titleReg = /<title\b[^>]*>(.*?)<\/title>/i;
        const matchRes = html.match(titleReg);

        if (matchRes) {
            title = matchRes[1];
            //@ts-ignore - assuming Lute is available in global scope
            title = window.Lute?.UnEscapeHTMLStr(title) || title;

            // Charset detection
            const charsetReg = /<meta\b[^>]*charset=['"]?([^'"]*)['"]?[^>]*>/i;
            const charsetMatch = html.match(charsetReg);
            const charset = charsetMatch ? charsetMatch[1].toLowerCase() : "utf-8";

            if (charset !== "utf-8") {
                title = null;
            }
        }
    } catch (error) {
        console.error('Error fetching URL:', error);
        siyuan.showMessage("Error fetching URL: " + error);
        return null;
    }

    return title;
};



const STORAGE_NAME = 'config.json';

class TitledUrlPlugin extends siyuan.Plugin {
    onOpenMenuLinkBindThis = this.onOpenMenuLink.bind(this);
    onClickBlockIconBindThis = this.onClickBlockIcon.bind(this);

    private settingUtils: SettingUtils;

    onload() {
        this.addIcons(IconUrl);
        this.eventBus.on("open-menu-link", this.onOpenMenuLinkBindThis);
        this.eventBus.on("click-blockicon", this.onClickBlockIconBindThis);

        this.settingUtils = new SettingUtils(this, STORAGE_NAME, null, null, '300px');
        this.settingUtils.addItem({
            key: "replaceTitle",
            value: true,
            type: 'checkbox',
            title: this.i18n.replaceTitle.title,
            description: this.i18n.replaceTitle.description
        });

        try {
            this.settingUtils.load();
        } catch (error) {
            console.error("Error loading settings storage, probably empty config json:", error);
        }

    }

    onunload() {
        this.eventBus.off("open-menu-link", this.onOpenMenuLinkBindThis);
        this.eventBus.off("click-blockicon", this.onClickBlockIconBindThis);
    }

    async onClickBlockIcon({ detail }) {
        let menu = detail.menu;
        let elements: HTMLElement[] = detail.blockElements;
        let protyle = detail.protyle;

        let hasAnchor = false;
        for (let ele of elements) {
            if (ele.querySelector("span[data-type=\"a\"]")) {
                hasAnchor = true;
                break;
            }
        }
        if (!hasAnchor) {
            return;
        }

        // console.log(element, protyle);
        menu.addItem({
            icon: "iconUrl",
            label: this.i18n.GetTitle,
            click: async () => {
                let spans = [];
                for (let ele of elements) {
                    spans.push(...ele.querySelectorAll("span[data-type=\"a\"]"));
                }
                this.replaceHrefAnchor(protyle, ...spans);
            }
        });
    }

    async onOpenMenuLink({ detail }) {
        // console.log(detail);
        let menu = detail.menu;
        let protyle = detail.protyle;
        const hrefSpan = detail.element;

        let dataHref = hrefSpan.getAttribute("data-href");
        if (!dataHref?.startsWith("http") && !dataHref?.startsWith("www.")) {
            return;
        }

        menu.addItem({
            icon: "iconUrl",
            label: this.i18n.GetTitle,
            click: async () => {
                this.replaceHrefAnchor(protyle, hrefSpan);
            }
        });
    }

    async replaceHrefAnchor(protyle, ...elements: HTMLElement[]) {
        const updateProtyle = () => {
            let inputEvent = new Event("input");
            protyle.wysiwyg.element.dispatchEvent(inputEvent);
        };

        const replaceAnchor = async (element) => {
            let dataHref = element.getAttribute("data-href");
            let title = await getTitle(dataHref);
            console.log('Title:', title, '\n\t=>', dataHref);
            if (title) {
                element.innerText = title;
                const replaceTitle = this.settingUtils.get('replaceTitle');
                if (replaceTitle) {
                    element.setAttribute('data-title', title);
                }
            } else {
                siyuan.showMessage(this.i18n.titleNotFound + dataHref, 4000, 'error');
            }
            return
        }

        let allPromises = [];
        for (let element of elements) {
            allPromises.push(replaceAnchor(element));
        }
        await Promise.all(allPromises);
        updateProtyle();
    }
}

module.exports = TitledUrlPlugin;
