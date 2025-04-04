import * as vscode from 'vscode';
import { LogicalGroup } from '../types';
import { processColor } from '../utils/color';

export class GroupFinderService {
    // Find logical groups in the current document
    static findLogicalGroups(document: vscode.TextDocument): LogicalGroup[] {
        const groups: LogicalGroup[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        const config = vscode.workspace.getConfiguration('vueLogicalGroupSpotlight');
        const colors = config.get<string[]>('colors') || [];
        const defaultOpacity = config.get<number>('defaultOpacity') || 0.1;

        let currentGroup: LogicalGroup | null = null;
        let groupIndex = 0;
        let lastNonEmptyLine = -1;

        // Helper function to check if a line is empty or only contains whitespace
        const isEmptyLine = (line: string): boolean => {
            return line.trim().length === 0;
        };

        // Helper function to add group to the list
        const addGroup = (group: LogicalGroup, endLine: number) => {
            if (group.startLine <= endLine) {
                group.endLine = endLine;
                groups.push(group);
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/\/\/\s*VLG:\s*(.+)/);

            if (match) {
                // If we have a previous group, close it at the last non-empty line
                if (currentGroup) {
                    addGroup(currentGroup, lastNonEmptyLine);
                }

                // Get color from the array or fallback to the first color
                const color = colors[groupIndex % colors.length] || colors[0];
                const groupName = match[1].trim();
                
                // Start a new group with the next color
                currentGroup = {
                    startLine: i,
                    endLine: i + 1,
                    name: groupName,
                    color: processColor(color, defaultOpacity)
                };
                groupIndex++;
                lastNonEmptyLine = i; // Group name line is always considered non-empty
            } else if (!isEmptyLine(line)) {
                lastNonEmptyLine = i;
            }
        }

        // Close the last group if exists
        if (currentGroup) {
            addGroup(currentGroup, lastNonEmptyLine);
        }

        return groups;
    }

    // Find which group contains the current cursor position
    static findCurrentGroup(groups: LogicalGroup[], line: number): LogicalGroup | undefined {
        return groups.find(group => line >= group.startLine && line <= group.endLine);
    }

    // Find the most recent visible group in the editor
    static findVisibleGroup(groups: LogicalGroup[], visibleRange: vscode.Range): LogicalGroup | undefined {
        // Get the visible range
        const topLine = visibleRange.start.line;
        const bottomLine = visibleRange.end.line;
        
        // First, try to find a group whose header is in the visible range
        const visibleHeaderGroup = groups.find(group => 
            group.startLine >= topLine && group.startLine <= bottomLine
        );
        
        if (visibleHeaderGroup) {
            return visibleHeaderGroup;
        }

        // If no header is visible, find the last group that starts before the visible range
        return groups
            .filter(group => group.startLine <= topLine)
            .sort((a, b) => b.startLine - a.startLine)[0];
    }
} 