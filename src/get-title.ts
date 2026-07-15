import * as siyuan from "siyuan";
import { forwardProxy } from "./api";

const isDesktop = (): boolean => {
    return typeof window !== 'undefined' && !!window.require;
};

export const extractTitle = (
    html: string,
    unescape: (s: string) => string = (s) => s
): string | null => {
    const titleReg = /<title\b[^>]*>(.*?)<\/title>/is;
    const matchRes = html.match(titleReg);

    if (!matchRes) {
        return null;
    }

    let title = matchRes[1].trim();
    title = unescape(title) || title;

    // Charset detection
    const charsetReg = /<meta\b[^>]+charset\s*=\s*['"]?([^\s'">]+)['"]?[^>]*>/i;
    const charsetMatch = html.match(charsetReg);
    const charset = charsetMatch ? charsetMatch[1].toLowerCase() : "utf-8";

    if (charset !== "utf-8") {
        return null;
    }

    return title;
};

export const getTitle = async (href: string): Promise<string | null> => {
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

        const unescape = (typeof window !== 'undefined' && window.Lute?.UnEscapeHTMLStr)
            ? (s: string) => window.Lute!.UnEscapeHTMLStr(s) || s
            : (s: string) => s;

        return extractTitle(html, unescape);
    } catch (error) {
        console.error('Error fetching URL:', error);
        siyuan.showMessage("Error fetching URL: " + error);
        return null;
    }
};
