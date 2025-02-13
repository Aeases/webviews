import { ItemView, WorkspaceLeaf, Menu, WorkspaceItem, WorkspaceContainer, App } from 'obsidian'
import { createWebviewTag } from './fns/createWebviewTag'
import { Platform } from 'obsidian'
import { createIframe } from './fns/createIframe'
import { getObsidianCssVars } from './fns/getCurrentCSSvalues'
// @ts-ignore
import { clipboard, remote } from "electron";
const { parse } = require('css-parse');
import WebviewTag = Electron.WebviewTag
import { ModalEditGate } from './ModalEditGate'
import { SettingTab } from './SetingTab'
export class GateView extends ItemView {
    private readonly options: GateFrameOption
    public frame: WebviewTag | HTMLIFrameElement
    private readonly useIframe: boolean = false
    public InjectedCSS: string
    //plugin: OpenGatePlugin
    //shouldNotify: boolean

    constructor(leaf: WorkspaceLeaf, options: GateFrameOption) {
        super(leaf)
        this.navigation = true
        this.options = options
        this.useIframe = Platform.isMobileApp
    }

    

    addActions(): void {
        this.addAction('refresh-ccw', 'Reload', () => {
            if (this.frame instanceof HTMLIFrameElement) {
                this.frame.src = this.frame.src
            } else {
                this.frame.reload()
            }
        })

        this.addAction('home', 'Home page', () => {
            if (this.frame instanceof HTMLIFrameElement) {
                this.frame.src = this.options?.url ?? 'about:blank'
            } else {
                this.frame.loadURL(this.options?.url ?? 'about:blank')
            }
        })
    }

    isWebviewFrame(): boolean {
        return this.frame! instanceof HTMLIFrameElement
    }

    


    onload(): void {
        super.onload()
        this.addActions()

        this.contentEl.empty()
        this.contentEl.addClass('open-gate-view')

        if (this.useIframe) {
            this.frame = createIframe(this.options)
        } else {
            this.frame = createWebviewTag(this.options)
        }

        this.contentEl.appendChild(this.frame as unknown as HTMLElement)

        if (this.frame instanceof HTMLIFrameElement) {
            // do nothing to do
        } else {
            this.frame.addEventListener('will-navigate', this.webViewWillNavigate.bind(this))
            this.frame.addEventListener('console-message', async (event: Electron.ConsoleMessageEvent) => {
                if (event.message.startsWith('open-gate-open:')) {
                    const url = event.message.replace('open-gate-open:', '')
                    window.open(url)
                }
            })

            this.frame.addEventListener('dom-ready', async () => {
                // typescript indicates type
                const frame = this.frame as unknown as WebviewTag
                // @ts-ignore
                const webContents = remote.webContents.fromId(this.frame.getWebContentsId());
                await frame.executeJavaScript(`
                document.addEventListener('click', (e) => {
                    if (e.target instanceof HTMLAnchorElement && e.target.target === '_blank') {
                        e.preventDefault();
                        console.log('open-gate-open:'+e.target.href);
                    }
                });`)
                if (this.options?.restrictKeys == false) {
                    // Pass-through key-presses to obsidian
                    // Courtesy of the Surfing Plugin: https://github.dev/PKM-er/Obsidian-Surfing/tree/main/src
                    webContents.on('before-input-event', (event: any, input: any) => {
                        if (input.type !== 'keyDown') {
                            return;
                        }
    
                        const emulatedKeyboardEvent = new KeyboardEvent('keydown', {
                            code: input.code,
                            key: input.key,
                            shiftKey: input.shift,
                            altKey: input.alt,
                            ctrlKey: input.control,
                            metaKey: input.meta,
                            repeat: input.isAutoRepeat
                        });
    
                        activeDocument.body.dispatchEvent(emulatedKeyboardEvent);
                    })
                }
                if (this.options?.css) {
                    let ParsedCSS = this.options?.css
                    let styles = getObsidianCssVars(this.app)
                    for (let style of styles) {
                        await frame.insertCSS(style)
                    }
                    // TODO: Find a more elegant way of combining styles, preferably insert one string that I can then store in the GateView's class, then when the time comes to swap out the CSS, like at a theme change or CSS edit I can just remove inserted CSS with the saved string, and then insert in new css, and overwrite that string with the new one.
                    await frame.insertCSS(ParsedCSS)
                    
                    
                    this.InjectedCSS = ParsedCSS
                }
            })
        }
    }

    onunload(): void {
        this.frame.remove()
        if (this.frame instanceof HTMLIFrameElement) {
        } else {
            this.frame.removeEventListener('will-navigate', this.webViewWillNavigate.bind(this))
        }
        super.onunload()
    }

    webViewWillNavigate(event: Electron.Event, url: string): void {}

    onPaneMenu(menu: Menu, source: string): void {
        super.onPaneMenu(menu, source)
        menu.addItem((item) => {
            item.setTitle('Reload')
            item.setIcon('refresh-ccw')
            item.onClick(() => {
                if (this.frame instanceof HTMLIFrameElement) {
                    this.frame.src = this.frame.src
                } else {
                    this.frame.reload()
                }
            })
        })
        menu.addItem((item) => {
            item.setTitle('Home page')
            item.setIcon('home')
            item.onClick(() => {
                if (this.frame instanceof HTMLIFrameElement) {
                    this.frame.src = this.options?.url ?? 'about:blank'
                } else {
                    this.frame.loadURL(this.options?.url ?? 'about:blank')
                }
            })
        })

        //menu.addItem((item) => {
        //    item.setTitle('Edit Webview')
        //    item.setIcon('list')
        //    item.onClick(() => {
        //        new ModalEditGate(
        //            this.app,
        //            this.options,
        //            async() => await this.plugin.addGate(this.options)
        //        ).open()
        //    })
        //})

        menu.addItem((item) => {
            item.setTitle('Toggle DevTools')
            item.setIcon('file-cog')
            item.onClick(() => {
                if (this.frame instanceof HTMLIFrameElement) {
                    return
                }

                if (this.frame.isDevToolsOpened()) {
                    this.frame.closeDevTools()
                } else {
                    this.frame.openDevTools()
                }
            })
        })
    }

    getViewType(): string {
        return this.options?.id ?? 'gate'
    }

    getDisplayText(): string {
        return this.options?.title ?? 'Gate'
    }

    getIcon(): string {
        if (this.options?.icon.startsWith('<svg')) {
            return this.options.id
        }

        return this.options?.icon ?? 'globe'
    }
}
