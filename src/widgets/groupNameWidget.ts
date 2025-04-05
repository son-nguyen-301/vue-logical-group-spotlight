import * as vscode from 'vscode';
import { LogicalGroup } from '../types';
import { processColor } from '../utils/color';

export class GroupNameWidget implements vscode.Disposable {
    private readonly _widget: vscode.StatusBarItem;
    private _currentGroups: LogicalGroup[] = [];

    constructor() {
        this._widget = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            1000
        );
        this._widget.command = 'vue-logical-group-spotlight.selectGroup';
    }

    updateContent(groups: LogicalGroup[], currentGroup: LogicalGroup | undefined) {
        this._currentGroups = groups;
        if (currentGroup) {
            this._widget.text = `$(list-selection) GROUP: ${currentGroup.name}`;
            const hexColor = processColor(currentGroup.color, 1.0, true).replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
            this._widget.backgroundColor = new vscode.ThemeColor(`#${hexColor}`);
            this._widget.tooltip = 'Click to select a group';
            this._widget.show();
        } else {
            this._widget.hide();
        }
    }

    async showQuickPick() {
        if (this._currentGroups.length === 0) {return;}

        const items = this._currentGroups.map(group => ({
            label: group.name,
            description: `Line ${group.startLine + 1}`,
            group
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a group to navigate to'
        });

        if (selected && vscode.window.activeTextEditor) {
            const editor = vscode.window.activeTextEditor;
            const position = new vscode.Position(selected.group.startLine, 0);
            
            // Set cursor position without selection
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.AtTop
            );

            // Focus back to the editor
            await vscode.window.showTextDocument(editor.document, {
                viewColumn: editor.viewColumn,
                selection: editor.selection,
                preserveFocus: false
            });
        }
    }

    dispose() {
        this._widget.dispose();
    }
} 