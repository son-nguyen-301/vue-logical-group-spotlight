// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

type LogicalGroup = {
	startLine: number;
	endLine: number;
	name: string;
	color: string;
	isCollapsed?: boolean;
}

class GroupNameWidget implements vscode.Disposable {
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
			this._widget.text = `$(list-selection) ${currentGroup.name}`;
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

// Process color with opacity
function processColor(color: string, defaultOpacity: number, isGroupName: boolean = false): string {
	// If the color already includes opacity (rgba or hsla), use it as is
	if (color.includes('rgba') || color.includes('hsla')) {
		if (isGroupName) {
			return color.replace(/[0-9.]+\)$/, '1.0)'); // Full opacity for group name
		}
		return color;
	}
	
	// For hex colors (#RRGGBB)
	if (color.match(/^#[0-9A-Fa-f]{6}$/)) {
		const opacity = Math.round((isGroupName ? 1.0 : defaultOpacity) * 255).toString(16).padStart(2, '0');
		return `${color}${opacity}`;
	}
	
	// For rgb colors
	if (color.startsWith('rgb(')) {
		return color.replace('rgb(', 'rgba(').replace(')', `, ${isGroupName ? 1.0 : defaultOpacity})`);
	}
	
	// For hsl colors
	if (color.startsWith('hsl(')) {
		return color.replace('hsl(', 'hsla(').replace(')', `, ${isGroupName ? 1.0 : defaultOpacity})`);
	}

	return color;
}

class StickyHeaderProvider implements vscode.CodeLensProvider {
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

class GroupHeaderProvider implements vscode.WebviewViewProvider {
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

// Find logical groups in the current document
const findLogicalGroups = (document: vscode.TextDocument): LogicalGroup[] => {
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
};

class LogicalGroupFoldingRangeProvider implements vscode.FoldingRangeProvider {
	provideFoldingRanges(
		document: vscode.TextDocument,
		context: vscode.FoldingContext,
		token: vscode.CancellationToken
	): vscode.FoldingRange[] {
		const groups = findLogicalGroups(document);
		return groups.map((group: LogicalGroup) => new vscode.FoldingRange(
			group.startLine,
			group.endLine,
			vscode.FoldingRangeKind.Region
		));
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let activeEditor = vscode.window.activeTextEditor;
	let decorationTypes: vscode.TextEditorDecorationType[] = [];
	let isEnabled = true;
	let groupNameWidget: GroupNameWidget | undefined;
	const headerProvider = new GroupHeaderProvider();
	const stickyHeaderProvider = new StickyHeaderProvider();
	const foldingRangeProvider = new LogicalGroupFoldingRangeProvider();

	// Register the sticky header provider
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider({ pattern: '**/*' }, stickyHeaderProvider)
	);

	// Register the header provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('logicalGroupCurrentHeader', headerProvider)
	);

	// Register folding range provider
	context.subscriptions.push(
		vscode.languages.registerFoldingRangeProvider(
			{ pattern: '**/*' },
			foldingRangeProvider
		)
	);

	// Register the select group command
	const selectGroupCommand = vscode.commands.registerCommand('vue-logical-group-spotlight.selectGroup', () => {
		if (groupNameWidget) {
			groupNameWidget.showQuickPick();
		}
	});

	context.subscriptions.push(selectGroupCommand);

	// Create decoration type for spotlight with specific color
	const createDecorationType = (color: string, isGroupName: boolean = false) => {
		if (isGroupName) {
			const headerColor = processColor(color, 1, true);
			return vscode.window.createTextEditorDecorationType({
				backgroundColor: headerColor,
				color: '#FFFFFF',
				fontWeight: 'bold',
				textDecoration: 'none; padding-left: 24px;' // Add padding to prevent overlap
			});
		}
		return vscode.window.createTextEditorDecorationType({
			backgroundColor: color,
			isWholeLine: true,
			overviewRulerColor: color,
			overviewRulerLane: vscode.OverviewRulerLane.Full
		});
	};

	// Find which group contains the current cursor position
	const findCurrentGroup = (groups: LogicalGroup[], line: number): LogicalGroup | undefined => {
		return groups.find(group => line >= group.startLine && line <= group.endLine);
	};

	// Find the most recent visible group in the editor
	const findVisibleGroup = (groups: LogicalGroup[], visibleRange: vscode.Range): LogicalGroup | undefined => {
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
	};

	// Update decorations for the current editor
	const updateDecorations = () => {
		if (!activeEditor || !isEnabled) {
			if (groupNameWidget) {
				groupNameWidget.updateContent([], undefined);
			}
			return;
		}

		decorationTypes.forEach(type => type.dispose());
		decorationTypes = [];

		const groups = findLogicalGroups(activeEditor.document);
		
		groups.forEach(group => {
			if (!activeEditor) {return;}

			// Create decoration for the group header
			const headerRange = new vscode.Range(
				new vscode.Position(group.startLine, 0),
				new vscode.Position(group.startLine, Number.MAX_VALUE)
			);

			// Create the background decoration type
			const headerBackgroundType = vscode.window.createTextEditorDecorationType({
				backgroundColor: processColor(group.color, 1, true),
				color: '#FFFFFF',
				fontWeight: 'bold',
				isWholeLine: true,
			});

			// Apply the decoration
			activeEditor.setDecorations(headerBackgroundType, [{ 
				range: headerRange,
			}]);

			decorationTypes.push(headerBackgroundType);

			// Create and apply content decoration
			const contentDecorationType = createDecorationType(group.color);
			const contentRange = new vscode.Range(
				new vscode.Position(group.startLine + 1, 0),
				new vscode.Position(group.endLine, Number.MAX_VALUE)
			);
			activeEditor.setDecorations(contentDecorationType, [{ range: contentRange }]);
			decorationTypes.push(contentDecorationType);
		});

		// Update group name widget based on cursor position
		if (!groupNameWidget) {
			groupNameWidget = new GroupNameWidget();
			context.subscriptions.push(groupNameWidget);
		}

		const currentLine = activeEditor.selection.active.line;
		const currentGroup = findCurrentGroup(groups, currentLine);
		groupNameWidget.updateContent(groups, currentGroup);
		stickyHeaderProvider.updateGroups(groups);
	};

	// Register the toggle spotlight command
	const disposable = vscode.commands.registerCommand('vue-logical-group-spotlight.toggleSpotlight', () => {
		isEnabled = !isEnabled;
		if (!isEnabled) {
			decorationTypes.forEach(type => type.dispose());
			decorationTypes = [];
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
		configChangeDisposable
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
