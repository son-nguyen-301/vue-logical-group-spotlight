// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GroupFinderService } from './services/groupFinder';
import { DecorationService } from './services/decorationService';
import { GroupHeaderProvider, StickyHeaderProvider, LogicalGroupFoldingRangeProvider } from './providers';
import { GroupNameWidget } from './widgets/groupNameWidget';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let activeEditor = vscode.window.activeTextEditor;
	let isEnabled = true;
	let groupNameWidget: GroupNameWidget | undefined;
	
	const decorationService = new DecorationService();
	const headerProvider = new GroupHeaderProvider();
	const stickyHeaderProvider = new StickyHeaderProvider();
	const foldingRangeProvider = new LogicalGroupFoldingRangeProvider();

	// Register providers
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider({ pattern: '**/*' }, stickyHeaderProvider),
		vscode.window.registerWebviewViewProvider('logicalGroupCurrentHeader', headerProvider),
		vscode.languages.registerFoldingRangeProvider({ pattern: '**/*' }, foldingRangeProvider)
	);

	// Register the select group command
	const selectGroupCommand = vscode.commands.registerCommand('vue-logical-group-spotlight.selectGroup', () => {
		if (groupNameWidget) {
			groupNameWidget.showQuickPick();
		}
	});

	context.subscriptions.push(selectGroupCommand);

	// Update decorations for the current editor
	const updateDecorations = () => {
		if (!activeEditor || !isEnabled) {
			if (groupNameWidget) {
				groupNameWidget.updateContent([], undefined);
			}
			return;
		}

		const groups = GroupFinderService.findLogicalGroups(activeEditor.document);
		decorationService.updateDecorations(activeEditor, groups);

		// Update group name widget based on cursor position
		if (!groupNameWidget) {
			groupNameWidget = new GroupNameWidget();
			context.subscriptions.push(groupNameWidget);
		}

		const currentLine = activeEditor.selection.active.line;
		const currentGroup = GroupFinderService.findCurrentGroup(groups, currentLine);
		groupNameWidget.updateContent(groups, currentGroup);
		stickyHeaderProvider.updateGroups(groups);
	};

	// Register the toggle spotlight command
	const disposable = vscode.commands.registerCommand('vue-logical-group-spotlight.toggleSpotlight', () => {
		isEnabled = !isEnabled;
		if (!isEnabled) {
			decorationService.clearDecorations();
			if (groupNameWidget) {
				groupNameWidget.updateContent([], undefined);
			}
			headerProvider.updateGroup(undefined);
			stickyHeaderProvider.updateGroups([]);
		} else {
			updateDecorations();
		}
		vscode.window.showInformationMessage(`Logical Group Spotlight ${isEnabled ? 'enabled' : 'disabled'}`);
	});

	// Update when cursor position changes
	const selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection(event => {
		if (event.textEditor === activeEditor && isEnabled) {
			updateDecorations();
		}
	});

	// Update when editor scrolls
	const scrollChangeDisposable = vscode.window.onDidChangeTextEditorVisibleRanges(event => {
		if (event.textEditor === activeEditor && isEnabled) {
			updateDecorations();
		}
	});

	// Update decorations when the active editor changes
	const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (isEnabled) {
			updateDecorations();
		}
	});

	// Update decorations when the document changes
	const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document && isEnabled) {
			updateDecorations();
		}
	});

	// Update decorations when configuration changes
	const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('vueLogicalGroupSpotlight') && isEnabled) {
			updateDecorations();
		}
	});

	// Initial spotlight when extension activates
	updateDecorations();

	context.subscriptions.push(
		disposable,
		selectionChangeDisposable,
		scrollChangeDisposable,
		editorChangeDisposable,
		documentChangeDisposable,
		configChangeDisposable,
		decorationService
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
