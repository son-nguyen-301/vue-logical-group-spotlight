// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

interface LogicalGroup {
	startLine: number;
	endLine: number;
	name: string;
	color: string;
}

class GroupNameWidget implements vscode.Disposable {
	private readonly _widget: vscode.StatusBarItem;

	constructor() {
		this._widget = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			1000
		);
	}

	updateContent(groupName: string | undefined, color: string | undefined) {
		if (groupName && color) {
			this._widget.text = `📍 ${groupName}`;
			// Convert the color to a hex format without opacity for the status bar
			const hexColor = color.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
			this._widget.backgroundColor = new vscode.ThemeColor(`#${hexColor}`);
			this._widget.show();
		} else {
			this._widget.hide();
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

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let activeEditor = vscode.window.activeTextEditor;
	let decorationTypes: vscode.TextEditorDecorationType[] = [];
	let isEnabled = true;
	let groupNameWidget: GroupNameWidget | undefined;

	// Create decoration type for spotlight with specific color
	const createDecorationType = (color: string) => {
		return vscode.window.createTextEditorDecorationType({
			backgroundColor: color,
			isWholeLine: true,
			overviewRulerColor: color,
			overviewRulerLane: vscode.OverviewRulerLane.Full
		});
	};

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

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const match = line.match(/\/\/\s*LOGICAL GROUP:\s*(.+)/);

			if (match) {
				// If we have a previous group, close it
				if (currentGroup) {
					currentGroup.endLine = i - 1;
					groups.push(currentGroup);
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
			}
		}

		// Close the last group if exists
		if (currentGroup) {
			currentGroup.endLine = lines.length - 1;
			groups.push(currentGroup);
		}

		return groups;
	};

	// Find which group contains the current cursor position
	const findCurrentGroup = (groups: LogicalGroup[], line: number): LogicalGroup | undefined => {
		return groups.find(group => line >= group.startLine && line <= group.endLine);
	};

	// Update decorations for the current editor
	const updateDecorations = () => {
		if (!activeEditor || !isEnabled) {
			if (groupNameWidget) {
				groupNameWidget.updateContent(undefined, undefined);
			}
			return;
		}

		// Dispose of existing decorations
		decorationTypes.forEach(type => type.dispose());
		decorationTypes = [];

		const groups = findLogicalGroups(activeEditor.document);
		
		groups.forEach(group => {
			const decorationType = createDecorationType(group.color);
			const range = new vscode.Range(
				new vscode.Position(group.startLine, 0),
				new vscode.Position(group.endLine, Number.MAX_VALUE)
			);
			activeEditor!.setDecorations(decorationType, [{ range }]);
			decorationTypes.push(decorationType);
		});

		// Update group name widget based on current cursor position
		const currentLine = activeEditor.selection.active.line;
		const currentGroup = findCurrentGroup(groups, currentLine);
		
		if (!groupNameWidget) {
			groupNameWidget = new GroupNameWidget();
			context.subscriptions.push(groupNameWidget);
		}
		
		groupNameWidget.updateContent(
			currentGroup?.name,
			currentGroup ? processColor(currentGroup.color, 1.0, true) : undefined
		);
	};

	// Register the toggle spotlight command
	const disposable = vscode.commands.registerCommand('vue-logical-group-spotlight.toggleSpotlight', () => {
		isEnabled = !isEnabled;
		if (!isEnabled) {
			decorationTypes.forEach(type => type.dispose());
			decorationTypes = [];
			if (groupNameWidget) {
				groupNameWidget.updateContent(undefined, undefined);
			}
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
		editorChangeDisposable,
		documentChangeDisposable,
		configChangeDisposable
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
