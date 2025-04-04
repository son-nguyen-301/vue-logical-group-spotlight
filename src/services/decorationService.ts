import * as vscode from 'vscode';
import { LogicalGroup } from '../types';
import { processColor } from '../utils/color';

export class DecorationService {
    private decorationTypes: vscode.TextEditorDecorationType[] = [];

    // Create decoration type for spotlight with specific color
    private createDecorationType(color: string, isGroupName: boolean = false): vscode.TextEditorDecorationType {
        if (isGroupName) {
            const headerColor = processColor(color, 1, true);
            return vscode.window.createTextEditorDecorationType({
                backgroundColor: headerColor,
                color: '#FFFFFF',
                fontWeight: 'bold',
                textDecoration: 'none; padding-left: 24px;'
            });
        }
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
            isWholeLine: true,
            overviewRulerColor: color,
            overviewRulerLane: vscode.OverviewRulerLane.Full
        });
    }

    // Apply decorations for a group
    private applyGroupDecorations(editor: vscode.TextEditor, group: LogicalGroup) {
        // Create and apply header decoration
        const headerRange = new vscode.Range(
            new vscode.Position(group.startLine, 0),
            new vscode.Position(group.startLine, Number.MAX_VALUE)
        );

        const headerBackgroundType = vscode.window.createTextEditorDecorationType({
            backgroundColor: processColor(group.color, 1, true),
            color: '#FFFFFF',
            fontWeight: 'bold',
            isWholeLine: true,
            textDecoration: 'none; display: none; width: 0; overflow: hidden;',
            before: {
                contentText: `VLG: ${group.name}`,
                color: '#FFFFFF',
                fontWeight: 'bold',
                textDecoration: 'underline; cursor: pointer;',
                backgroundColor: processColor(group.color, 1, true)
            }
        });

        editor.setDecorations(headerBackgroundType, [{ 
            range: headerRange,
            hoverMessage: 'Click to edit group name'
        }]);
        this.decorationTypes.push(headerBackgroundType);

        // Create and apply content decoration
        const contentDecorationType = this.createDecorationType(group.color);
        const contentRange = new vscode.Range(
            new vscode.Position(group.startLine + 1, 0),
            new vscode.Position(group.endLine, Number.MAX_VALUE)
        );
        editor.setDecorations(contentDecorationType, [{ range: contentRange }]);
        this.decorationTypes.push(contentDecorationType);
    }

    // Update all decorations
    updateDecorations(editor: vscode.TextEditor, groups: LogicalGroup[]) {
        this.clearDecorations();
        groups.forEach(group => this.applyGroupDecorations(editor, group));
    }

    // Clear all decorations
    clearDecorations() {
        this.decorationTypes.forEach(type => type.dispose());
        this.decorationTypes = [];
    }

    // Dispose all decorations
    dispose() {
        this.clearDecorations();
    }
} 