import * as siyuan from "siyuan";
import { forwardProxy } from "./api";
// import iconv from "iconv-lite";


const getTitle = async (href) => {
    console.log(href);
    let title = null;
    if (href.startsWith("http")) {
        let data = await forwardProxy(
            href, 'GET', null,
            [{ 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.76" }],
            5000, 'text/html'
        );
        if (!data || (data.status / 100) !== 2) {
            return null;
        }
        let html = data?.body;
        let charsetReg = /<meta\b[^>]*charset=['"]?([^'"]*)['"]?[^>]*>/;
        //获取 html 的 dom 当中 head 内部的 title 标签的内容
        let titleReg = /<title\b[^>]*>(.*?)<\/title>/;
        let matchRes = html?.match(titleReg);
        if (matchRes) {
            title = matchRes[1];
            matchRes = html?.match(charsetReg);
            let charset = matchRes ? matchRes[1] : "utf-8";
            if (charset !== "utf-8") {
                // title = iconv.decode(title, charset);
            }
        }
    }
    return title;
}

class TitledUrlPlugin extends siyuan.Plugin {
    onOpenMenuLinkBindThis = this.onOpenMenuLink.bind(this);
    onClickBlockIconBindThis = this.onClickBlockIcon.bind(this);

    onload() {
        this.eventBus.on("open-menu-link", this.onOpenMenuLinkBindThis);
        this.eventBus.on("click-blockicon", this.onClickBlockIconBindThis);
    }

    onunload() {
        this.eventBus.off("open-menu-link", this.onOpenMenuLinkBindThis);
        this.eventBus.off("click-blockicon", this.onClickBlockIconBindThis);
    }

    async onClickBlockIcon({ detail }) {
        let menu = detail.menu;
        let elements = detail.blockElements;
        let protyle = detail.protyle;
        // console.log(element, protyle);
        menu.addItem({
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
        if (!dataHref?.startsWith("http")) {
            return;
        }

        menu.addItem({
            label: this.i18n.GetTitle,
            click: async () => {
                this.replaceHrefAnchor(protyle, hrefSpan);
            }
        });
    }

    async replaceHrefAnchor(protyle, ...elements) {
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
