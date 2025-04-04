import * as vscode from 'vscode';
import { LogicalGroup } from '../types';

export class GroupHeaderProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _currentGroup?: LogicalGroup;

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true
        };
        this.updateContent();
    }

    updateGroup(group: LogicalGroup | undefined) {
        this._currentGroup = group;
        this.updateContent();
    }

    private updateContent() {
        if (this._view && this._currentGroup) {
            const style = `
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        background-color: ${this._currentGroup.color};
                        height: 24px;
                        display: flex;
                        align-items: center;
                    }
                    .header {
                        padding: 0 10px;
                        font-size: 12px;
                        font-weight: bold;
                        color: var(--vscode-editor-foreground);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                </style>
            `;
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    ${style}
                </head>
                <body>
                    <div class="header">📌 ${this._currentGroup.name}</div>
                </body>
                </html>
            `;
            this._view.webview.html = html;
        }
    }
} 