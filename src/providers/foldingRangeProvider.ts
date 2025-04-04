import * as vscode from 'vscode';
import { LogicalGroup } from '../types';
import { GroupFinderService } from '../services/groupFinder';

export class LogicalGroupFoldingRangeProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(
        document: vscode.TextDocument,
        context: vscode.FoldingContext,
        token: vscode.CancellationToken
    ): vscode.FoldingRange[] {
        const groups = GroupFinderService.findLogicalGroups(document);
        return groups.map((group: LogicalGroup) => new vscode.FoldingRange(
            group.startLine,
            group.endLine,
            vscode.FoldingRangeKind.Region
        ));
    }
} 