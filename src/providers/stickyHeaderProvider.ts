import * as vscode from 'vscode';
import { LogicalGroup } from '../types';

export class StickyHeaderProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private groups: LogicalGroup[] = [];

    updateGroups(newGroups: LogicalGroup[]) {
        this.groups = newGroups;
        this._onDidChangeCodeLenses.fire();
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        return this.groups.map(group => {
            const range = new vscode.Range(
                new vscode.Position(group.startLine, 0),
                new vscode.Position(group.startLine, Number.MAX_VALUE)
            );
            return new vscode.CodeLens(range, {
                title: group.name,
                command: ''
            });
        });
    }
} 